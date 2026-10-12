"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import type { Editor } from "@tiptap/react";
import type { ResolvedPos } from "@tiptap/pm/model";
import { cn } from "@/lib/ui/cn";
import { Icon } from "@/components/atoms/Icon";
import { canMoveColumn, canMoveRow, moveTableLine, type MoveKind, type TableInfo } from "@/lib/notes/table-commands";

// design: Claude-designed on request (#387)
/**
 * Grip handles for reordering table rows (left edge) and columns (top edge),
 * shown for the hovered cell's row and column (fine pointer) or for the cell the
 * selection sits in (touch, #449). A grip is dragged with the
 * pointer; the drop is one `moveTableLine` call. Keyboard use the
 * move commands in TABLE_COMMANDS. Geometry is measured at runtime and handed
 * to Tailwind as CSS custom properties. Record: design/notes/NoteTableHandles.md.
 */
export interface NoteTableHandlesProps {
  editor: Editor | null;
}

interface Layout {
  table: HTMLTableElement;
  left: number;
  right: number;
  top: number;
  bottom: number;
  rows: { top: number; bottom: number }[];
  cols: { left: number; right: number }[];
  header: boolean;
}

interface Drag {
  kind: MoveKind;
  from: number;
  to: number | null;
}

const FINE_POINTER = "(pointer: fine)";

function subscribeFinePointer(callback: () => void) {
  const query = window.matchMedia(FINE_POINTER);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function measureTable(table: HTMLTableElement): Layout | null {
  const rows = Array.from(table.rows);
  if (rows.length === 0) return null;
  // Merged cells: the move helpers do not support spans, so no handles.
  if (table.querySelector('[colspan]:not([colspan="1"]), [rowspan]:not([rowspan="1"])')) return null;
  const visible = (table.closest(".tableWrapper") ?? table).getBoundingClientRect();
  const tableRect = table.getBoundingClientRect();
  const firstCells = Array.from(rows[0].cells);
  return {
    table,
    left: visible.left,
    right: visible.right,
    top: tableRect.top,
    bottom: tableRect.bottom,
    rows: rows.map((row) => {
      const rect = row.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom };
    }),
    cols: firstCells.map((cell) => {
      const rect = cell.getBoundingClientRect();
      return { left: rect.left, right: rect.right };
    }),
    header: firstCells.length > 0 && firstCells.every((cell) => cell.tagName === "TH"),
  };
}

function infoOf(layout: Layout): TableInfo {
  return {
    rows: layout.rows.length,
    cols: layout.cols.length,
    row: null,
    col: null,
    headerRow: layout.header,
    merged: false,
  };
}

// Index of the row/column under the pointer, clamped to the table.
function indexAt(spans: { start: number; end: number }[], point: number) {
  const hit = spans.findIndex((span) => point >= span.start && point < span.end);
  if (hit >= 0) return hit;
  return point < spans[0].start ? 0 : spans.length - 1;
}

// Cell the editor selection sits in (touch has no hover): the head's enclosing
// cell, or the head cell of a cell selection.
function selectedCell(editor: Editor): HTMLTableCellElement | null {
  const { selection } = editor.state;
  const head = "$headCell" in selection ? (selection.$headCell as ResolvedPos) : selection.$head;
  for (let depth = head.depth; depth > 0; depth--) {
    const role = head.node(depth).type.spec.tableRole;
    if (role === "cell" || role === "header_cell") {
      const dom = editor.view.nodeDOM(head.before(depth));
      return dom instanceof HTMLTableCellElement ? dom : null;
    }
  }
  const after = head.nodeAfter;
  if (after && (after.type.spec.tableRole === "cell" || after.type.spec.tableRole === "header_cell")) {
    const dom = editor.view.nodeDOM(head.pos);
    return dom instanceof HTMLTableCellElement ? dom : null;
  }
  return null;
}

function css(vars: Record<string, string>) {
  return vars as CSSProperties;
}

const gripClass =
  "chrome-touch pointer-events-auto fixed flex touch-none cursor-grab items-center justify-center rounded-control-inner border border-stroke-lines bg-surface-highlight-white text-text-secondary shadow-sm hover:bg-surface-highlight-white-selected active:cursor-grabbing active:bg-surface-highlight-white-hover after:absolute after:content-['']";
// Touch: the visible grip stays small, the hit area grows to 44px.
const rowHitClass = "[@media(pointer:coarse)]:after:-inset-x-4 [@media(pointer:coarse)]:after:-inset-y-3";
const columnHitClass = "[@media(pointer:coarse)]:after:-inset-x-3 [@media(pointer:coarse)]:after:-inset-y-4";

export function NoteTableHandles({ editor }: NoteTableHandlesProps) {
  const t = useTranslations("components.noteTable");
  const finePointer = useSyncExternalStore(
    subscribeFinePointer,
    () => window.matchMedia(FINE_POINTER).matches,
    () => false,
  );
  const [layout, setLayout] = useState<Layout | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [hover, setHover] = useState<{ row: number; col: number } | null>(null);
  const hoverRef = useRef<{ row: number; col: number } | null>(null);
  const layoutRef = useRef<Layout | null>(null);
  const dragRef = useRef<Drag | null>(null);

  const show = useCallback((next: Layout | null) => {
    layoutRef.current = next;
    setLayout(next);
    if (!next) {
      hoverRef.current = null;
      setHover(null);
    }
  }, []);

  const setDragState = useCallback((next: Drag | null) => {
    dragRef.current = next;
    setDrag(next);
  }, []);

  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom;
    function onPointerMove(event: PointerEvent) {
      if (!finePointer || dragRef.current || !editor?.isEditable) return;
      const element = event.target instanceof Element ? event.target : null;
      if (element?.closest("[data-table-handle]")) return;
      const table = element?.closest("table") ?? null;
      if (!table || !dom.contains(table)) {
        if (layoutRef.current) show(null);
        return;
      }
      if (layoutRef.current?.table !== table) show(measureTable(table));
      // Only the grips of the hovered cell's row and column show.
      const cell = element?.closest<HTMLTableCellElement>("td, th");
      const row = cell?.parentElement instanceof HTMLTableRowElement ? cell.parentElement.rowIndex : -1;
      if (!cell || row < 0) return;
      const prev = hoverRef.current;
      if (prev?.row === row && prev.col === cell.cellIndex) return;
      hoverRef.current = { row, col: cell.cellIndex };
      setHover(hoverRef.current);
    }
    // Touch: no hover, so the selection decides which cell's grips show.
    function syncSelection() {
      if (finePointer || dragRef.current || !editor) return false;
      const cell = editor.isEditable ? selectedCell(editor) : null;
      const table = cell?.closest("table") ?? null;
      const row = cell?.parentElement instanceof HTMLTableRowElement ? cell.parentElement.rowIndex : -1;
      if (!cell || !table || row < 0 || !dom.contains(table)) {
        if (layoutRef.current) show(null);
        return true;
      }
      show(measureTable(table));
      const prev = hoverRef.current;
      if (prev?.row !== row || prev.col !== cell.cellIndex) {
        hoverRef.current = { row, col: cell.cellIndex };
        setHover(hoverRef.current);
      }
      return true;
    }
    function remeasure() {
      if (syncSelection()) return;
      const current = layoutRef.current;
      if (!current) return;
      show(current.table.isConnected ? measureTable(current.table) : null);
    }
    document.addEventListener("pointermove", onPointerMove);
    window.addEventListener("scroll", remeasure, true);
    window.addEventListener("resize", remeasure);
    editor.on("transaction", remeasure);
    remeasure();
    return () => {
      document.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("scroll", remeasure, true);
      window.removeEventListener("resize", remeasure);
      editor.off("transaction", remeasure);
    };
  }, [editor, finePointer, show]);

  useEffect(() => {
    if (!drag) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setDragState(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [drag, setDragState]);

  if (!editor || !layout) return null;

  function targetAt(event: ReactPointerEvent, current: Layout, kind: MoveKind, from: number) {
    const spans =
      kind === "row"
        ? current.rows.map((row) => ({ start: row.top, end: row.bottom }))
        : current.cols.map((col) => ({ start: col.left, end: col.right }));
    const to = indexAt(spans, kind === "row" ? event.clientY : event.clientX);
    const ok = kind === "row" ? canMoveRow(infoOf(current), from, to) : canMoveColumn(infoOf(current), from, to);
    return ok ? to : null;
  }

  function onGripDown(event: ReactPointerEvent<HTMLButtonElement>, kind: MoveKind, from: number) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragState({ kind, from, to: null });
  }

  function onGripMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const state = dragRef.current;
    const current = layoutRef.current;
    if (!state || !current) return;
    const to = targetAt(event, current, state.kind, state.from);
    if (to !== state.to) setDragState({ ...state, to });
  }

  function onGripUp(event: ReactPointerEvent<HTMLButtonElement>) {
    const state = dragRef.current;
    const current = layoutRef.current;
    setDragState(null);
    if (!state || !current || !editor) return;
    const to = targetAt(event, current, state.kind, state.from);
    const cell = current.table.rows[0]?.cells[0];
    if (to === null || !cell) return;
    moveTableLine(editor, state.kind, state.from, to, editor.view.posAtDOM(cell, 0));
  }

  const { rows, cols } = layout;
  const rowsMovable = rows.length > 1 && editor.isEditable;
  const colsMovable = cols.length > 1 && editor.isEditable;
  const dragHandlers = {
    onPointerMove: onGripMove,
    onPointerUp: onGripUp,
    onPointerCancel: () => setDragState(null),
  };

  let indicator: CSSProperties | null = null;
  if (drag && drag.to !== null) {
    const forward = drag.to > drag.from;
    if (drag.kind === "row") {
      const edge = forward ? rows[drag.to].bottom : rows[drag.to].top;
      indicator = css({
        "--line-x": `${layout.left}px`,
        "--line-y": `${edge}px`,
        "--line-w": `${layout.right - layout.left}px`,
      });
    } else {
      const edge = forward ? cols[drag.to].right : cols[drag.to].left;
      indicator = css({
        "--line-x": `${edge}px`,
        "--line-y": `${layout.top}px`,
        "--line-h": `${layout.bottom - layout.top}px`,
      });
    }
  }

  return createPortal(
    <div className="pointer-events-none fixed inset-0">
      {rowsMovable &&
        rows.map((row, index) =>
          (layout.header && index === 0) || (hover?.row !== index && !(drag?.kind === "row" && drag.from === index)) ? null : (
            <button
              key={`row-${index}`}
              type="button"
              tabIndex={-1}
              data-table-handle=""
              aria-label={t("rowHandleLabel")}
              style={css({ "--grip-x": `${layout.left}px`, "--grip-y": `${(row.top + row.bottom) / 2}px` })}
              className={cn(
                gripClass,
                rowHitClass,
                "left-[var(--grip-x)] top-[var(--grip-y)] h-6 w-4 -translate-x-1/2 -translate-y-1/2",
                drag?.kind === "row" && drag.from === index && "bg-surface-highlight-white-active",
              )}
              onPointerDown={(event) => onGripDown(event, "row", index)}
              {...dragHandlers}
            >
              <Icon name="GripVertical" size={14} />
            </button>
          ),
        )}
      {colsMovable &&
        cols.map((col, index) => {
          const center = (col.left + col.right) / 2;
          if (center < layout.left || center > layout.right) return null;
          if (hover?.col !== index && !(drag?.kind === "column" && drag.from === index)) return null;
          return (
            <button
              key={`col-${index}`}
              type="button"
              tabIndex={-1}
              data-table-handle=""
              aria-label={t("columnHandleLabel")}
              style={css({ "--grip-x": `${center}px`, "--grip-y": `${layout.top}px` })}
              className={cn(
                gripClass,
                columnHitClass,
                "left-[var(--grip-x)] top-[var(--grip-y)] h-4 w-6 -translate-x-1/2 -translate-y-1/2",
                drag?.kind === "column" && drag.from === index && "bg-surface-highlight-white-active",
              )}
              onPointerDown={(event) => onGripDown(event, "column", index)}
              {...dragHandlers}
            >
              <Icon name="GripHorizontal" size={14} />
            </button>
          );
        })}
      {indicator && drag?.kind === "row" && (
        <span
          aria-hidden="true"
          style={indicator}
          className="fixed left-[var(--line-x)] top-[var(--line-y)] h-0.5 w-[var(--line-w)] -translate-y-1/2 bg-stroke-secondary-active"
        />
      )}
      {indicator && drag?.kind === "column" && (
        <span
          aria-hidden="true"
          style={indicator}
          className="fixed left-[var(--line-x)] top-[var(--line-y)] h-[var(--line-h)] w-0.5 -translate-x-1/2 bg-stroke-secondary-active"
        />
      )}
    </div>,
    document.body,
  );
}
