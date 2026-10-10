"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import type { Editor } from "@tiptap/react";
import { cn } from "@/lib/ui/cn";
import { Button } from "@/components/atoms/Button";
import { Dropdown } from "@/components/atoms/Dropdown";
import type { IconName } from "@/components/atoms/Icon";
import { SlashStore, getSlashStore } from "@/lib/notes/slash-command";
import { insertTable } from "@/lib/notes/table-commands";
import { TableSizeGrid } from "./TableSizePicker";

// design: Claude-designed on request (#332)
/**
 * The "/" block menu: `SlashMenuPanel` is the presentational listbox (a
 * labelless `Dropdown` of transparent `Button` rows, no new atom), `SlashMenu`
 * connects it to the editor's `SlashStore` (lib/notes/slash-command.ts),
 * positions it at the caret inside the visual viewport (so it clears the
 * mobile keyboard and the bottom EditingBar) and hosts the table size grid
 * (#330) for the Table item. Focus never leaves the editor while the list is
 * open; roles, keyboard contract and placement: design/notes/NoteEditor.md (#332).
 */
export interface SlashMenuRow {
  id: string;
  icon: IconName;
  label: string;
}

export interface SlashMenuPanelProps {
  rows: SlashMenuRow[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onHover?: (index: number) => void;
  label: string;
  noResultsLabel: string;
  /** Prefix of the option ids, for aria-activedescendant. */
  idPrefix: string;
}

export function optionId(idPrefix: string, rowId: string) {
  return `${idPrefix}-${rowId}`;
}

export function SlashMenuPanel({
  rows,
  selectedIndex,
  onSelect,
  onHover,
  label,
  noResultsLabel,
  idPrefix,
}: SlashMenuPanelProps) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>("[aria-selected=true]")
      ?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex, rows]);

  return (
    <Dropdown role="listbox" aria-label={label} className="shadow-sm">
      <div ref={listRef} className="contents">
        {rows.length === 0 ? (
          <p role="status" className="px-component-sm py-component-xs text-base font-semibold text-text-placeholder">
            {noResultsLabel}
          </p>
        ) : (
          rows.map((row, index) => (
            <Button
              key={row.id}
              id={optionId(idPrefix, row.id)}
              role="option"
              aria-selected={index === selectedIndex}
              variant="transparent"
              align="left"
              icon={row.icon}
              tabIndex={-1}
              className="aria-selected:bg-surface-secondary-hover aria-selected:text-text-primary"
              onMouseMove={() => onHover?.(index)}
              onClick={() => onSelect(index)}
            >
              {row.label}
            </Button>
          ))
        )}
      </div>
    </Dropdown>
  );
}

// Runtime geometry only (same exception as EditingBarMenu's `measure`):
// handed to Tailwind as custom properties so no spacing is inline.
const EDGE = 8;
const GAP = 4;

interface Placement {
  openUp: boolean;
  style: CSSProperties;
}

// Places the panel under (or, when it does not fit, above) the caret inside
// the VISUAL viewport: iOS shrinks that one, not the layout viewport, when
// its keyboard opens (#263). The fixed mobile EditingBar, when it sits below
// the caret, also counts as the bottom edge.
function place(anchor: DOMRect, panel: HTMLElement | null): Placement {
  const viewport = window.visualViewport;
  const top = viewport?.offsetTop ?? 0;
  let bottom = top + (viewport?.height ?? window.innerHeight);
  const bar = document.querySelector<HTMLElement>("[role=toolbar]")?.getBoundingClientRect();
  if (bar && bar.top >= anchor.bottom) bottom = Math.min(bottom, bar.top);
  const height = panel?.offsetHeight ?? 0;
  const width = panel?.offsetWidth ?? 0;
  const below = bottom - anchor.bottom - GAP - EDGE;
  const above = anchor.top - top - GAP - EDGE;
  const openUp = below < height && above > below;
  const left = Math.max(EDGE, Math.min(anchor.left, window.innerWidth - width - EDGE));
  return {
    openUp,
    style: {
      "--menu-x": `${left}px`,
      "--menu-y": `${openUp ? window.innerHeight - anchor.top : anchor.bottom}px`,
      "--menu-max": `${Math.max(openUp ? above : below, 0)}px`,
    } as CSSProperties,
  };
}

function usePlacement(getRect: () => DOMRect | null, active: boolean, dependency: unknown) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const getRectRef = useRef(getRect);
  getRectRef.current = getRect;

  useLayoutEffect(() => {
    if (!active) {
      setPlacement(null);
      return;
    }
    function update() {
      const rect = getRectRef.current();
      if (rect) setPlacement(place(rect, panelRef.current));
    }
    update();
    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [active, dependency]);

  return { panelRef, placement };
}

const panelClasses = (placement: Placement | null) =>
  cn(
    "fixed z-20 w-max min-w-56 max-w-[calc(100vw-2rem)] max-h-[var(--menu-max)] overflow-y-auto rounded-control-outer",
    "left-[var(--menu-x)]",
    placement?.openUp ? "bottom-[var(--menu-y)] pb-stack-xs" : "top-[var(--menu-y)] pt-stack-xs",
  );

const EMPTY_STORE = new SlashStore();

export interface SlashMenuProps {
  editor: Editor | null;
}

export function SlashMenu({ editor }: SlashMenuProps) {
  const t = useTranslations("components.slashMenu");
  const idPrefix = useId();
  const listId = `${idPrefix}-list`;
  const store = getSlashStore(editor) ?? EMPTY_STORE;
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const rows: SlashMenuRow[] = state.items.map((item) => ({
    id: item.id,
    icon: item.icon,
    label: t(`items.${item.id}`),
  }));

  const list = usePlacement(() => state.anchor?.() ?? null, state.open, state.items);
  const pickerRect = state.tablePicker?.anchor ?? null;
  const picker = usePlacement(() => pickerRect, state.tablePicker !== null, pickerRect);

  // Combobox semantics on the editor itself, which keeps DOM focus.
  const selectedRow = rows[state.selectedIndex];
  useEffect(() => {
    const dom = editor?.view.dom;
    if (!dom || !state.open) return;
    dom.setAttribute("aria-haspopup", "listbox");
    dom.setAttribute("aria-expanded", "true");
    dom.setAttribute("aria-controls", listId);
    if (selectedRow) dom.setAttribute("aria-activedescendant", optionId(idPrefix, selectedRow.id));
    return () => {
      for (const name of ["aria-haspopup", "aria-expanded", "aria-controls", "aria-activedescendant"]) {
        dom.removeAttribute(name);
      }
    };
  }, [editor, state.open, listId, idPrefix, selectedRow]);

  // The size grid takes focus from the editor; outside pointer closes it.
  useEffect(() => {
    if (!state.tablePicker) return;
    picker.panelRef.current?.querySelector<HTMLButtonElement>("[tabindex='0']")?.focus();
    function onPointerDown(event: PointerEvent) {
      if (picker.panelRef.current?.contains(event.target as Node)) return;
      store.closeTablePicker();
    }
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [state.tablePicker, picker.panelRef, store]);

  return (
    <>
      {state.open &&
        createPortal(
          // Mouse/touch on the list must not blur the editor (iOS keeps its keyboard).
          <div
            ref={list.panelRef}
            id={listId}
            style={list.placement?.style}
            className={panelClasses(list.placement)}
            onMouseDown={(event) => event.preventDefault()}
          >
            <SlashMenuPanel
              rows={rows}
              selectedIndex={state.selectedIndex}
              onSelect={(index) => state.items[index] && store.select(state.items[index])}
              onHover={(index) => index !== state.selectedIndex && store.set({ selectedIndex: index })}
              label={t("label")}
              noResultsLabel={t("noResults")}
              idPrefix={idPrefix}
            />
          </div>,
          document.body,
        )}
      {state.tablePicker &&
        editor &&
        createPortal(
          <div
            ref={picker.panelRef}
            role="dialog"
            aria-label={t("items.table")}
            style={picker.placement?.style}
            className={panelClasses(picker.placement)}
          >
            <Dropdown className="shadow-sm">
              <TableSizeGrid
                onChoose={(rows, cols) => {
                  store.closeTablePicker();
                  insertTable(editor, rows, cols);
                }}
                onDismiss={() => {
                  store.closeTablePicker();
                  editor.commands.focus();
                }}
              />
            </Dropdown>
          </div>,
          document.body,
        )}
    </>
  );
}
