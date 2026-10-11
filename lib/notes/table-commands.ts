import type { Editor } from "@tiptap/react";
import { TextSelection, type EditorState } from "@tiptap/pm/state";
import { isInTable, moveTableColumn, moveTableRow, rowIsHeader, selectedRect } from "@tiptap/pm/tables";
import type { IconName } from "@/components/atoms/Icon";

// The one list of table actions (#330). The desktop table menu
// (components/organisms/TableMenu.tsx) renders it today; the mobile
// EditingBar (#333) reads the same list. Labels live under the i18n
// namespace `components.noteTable.commands.<id>`.
export const MAX_TABLE_SIZE = 8;

export interface TableCommand {
  id: string;
  icon: IconName;
  destructive?: boolean;
  isEnabled: (editor: Editor) => boolean;
  run: (editor: Editor) => void;
}

export function insertTable(editor: Editor, rows: number, cols: number) {
  const clamp = (value: number) => Math.min(MAX_TABLE_SIZE, Math.max(1, Math.round(value)));
  editor.chain().focus().insertTable({ rows: clamp(rows), cols: clamp(cols), withHeaderRow: true }).run();
}

// #387: reordering. Index maths and header protection live here so the menu
// commands and the drag handles (NoteTableHandles) share one rule set.
export interface TableInfo {
  rows: number;
  cols: number;
  /** Row of the caret or of a one-row selection; null when the selection spans several rows. */
  row: number | null;
  col: number | null;
  headerRow: boolean;
  /** Merged cells: prosemirror-tables' move helpers do not handle spans, so moves are off. */
  merged: boolean;
}

export function tableInfo(state: EditorState): TableInfo | null {
  if (!isInTable(state)) return null;
  const rect = selectedRect(state);
  const { map, table } = rect;
  return {
    rows: map.height,
    cols: map.width,
    row: rect.bottom - rect.top === 1 ? rect.top : null,
    col: rect.right - rect.left === 1 ? rect.left : null,
    headerRow: rowIsHeader(map, table, 0),
    merged: new Set(map.map).size < map.width * map.height,
  };
}

function inRange(index: number, size: number) {
  return Number.isInteger(index) && index >= 0 && index < size;
}

export function canMoveRow(info: TableInfo, from: number, to: number) {
  if (info.merged || from === to || !inRange(from, info.rows) || !inRange(to, info.rows)) return false;
  return !(info.headerRow && (from === 0 || to === 0));
}

export function canMoveColumn(info: TableInfo, from: number, to: number) {
  return !info.merged && from !== to && inRange(from, info.cols) && inRange(to, info.cols);
}

export type MoveKind = "row" | "column";

/**
 * Moves one row or column in a single transaction (one undo step). `cellPos`
 * (a position inside a cell) first points the selection into that table, for
 * handles of a table the caret is not in; the library reads the selection.
 */
export function moveTableLine(editor: Editor, kind: MoveKind, from: number, to: number, cellPos?: number): boolean {
  return editor
    .chain()
    .focus()
    .command(({ state, tr, dispatch }) => {
      if (cellPos !== undefined) {
        tr.setSelection(TextSelection.near(tr.doc.resolve(cellPos)));
        // The chainable state only re-reads selection/doc when `tr` is read.
        if (state.tr !== tr) return false;
      }
      const info = tableInfo(state);
      if (!info) return false;
      if (kind === "row" ? !canMoveRow(info, from, to) : !canMoveColumn(info, from, to)) return false;
      const move = kind === "row" ? moveTableRow({ from, to }) : moveTableColumn({ from, to });
      return move(state, dispatch);
    })
    .run();
}

function stepCommand(id: string, icon: IconName, kind: MoveKind, delta: -1 | 1): TableCommand {
  const target = (editor: Editor) => {
    const info = tableInfo(editor.state);
    const index = info && (kind === "row" ? info.row : info.col);
    if (!info || index === null || index === undefined) return null;
    const to = index + delta;
    const ok = kind === "row" ? canMoveRow(info, index, to) : canMoveColumn(info, index, to);
    return ok ? { from: index, to } : null;
  };
  return {
    id,
    icon,
    isEnabled: (editor) => target(editor) !== null,
    run: (editor) => {
      const move = target(editor);
      if (move) moveTableLine(editor, kind, move.from, move.to);
    },
  };
}

export const TABLE_COMMANDS: TableCommand[] = [
  {
    id: "addRowBefore",
    icon: "Plus",
    isEnabled: (editor) => editor.can().addRowBefore(),
    run: (editor) => editor.chain().focus().addRowBefore().run(),
  },
  {
    id: "addRowAfter",
    icon: "Plus",
    isEnabled: (editor) => editor.can().addRowAfter(),
    run: (editor) => editor.chain().focus().addRowAfter().run(),
  },
  {
    id: "addColumnBefore",
    icon: "Plus",
    isEnabled: (editor) => editor.can().addColumnBefore(),
    run: (editor) => editor.chain().focus().addColumnBefore().run(),
  },
  {
    id: "addColumnAfter",
    icon: "Plus",
    isEnabled: (editor) => editor.can().addColumnAfter(),
    run: (editor) => editor.chain().focus().addColumnAfter().run(),
  },
  {
    id: "deleteRow",
    icon: "Minus",
    isEnabled: (editor) => editor.can().deleteRow(),
    run: (editor) => editor.chain().focus().deleteRow().run(),
  },
  {
    id: "deleteColumn",
    icon: "Minus",
    isEnabled: (editor) => editor.can().deleteColumn(),
    run: (editor) => editor.chain().focus().deleteColumn().run(),
  },
  stepCommand("moveRowUp", "ArrowUp", "row", -1),
  stepCommand("moveRowDown", "ArrowDown", "row", 1),
  stepCommand("moveColumnLeft", "ArrowLeft", "column", -1),
  stepCommand("moveColumnRight", "ArrowRight", "column", 1),
  {
    id: "toggleHeaderRow",
    icon: "Heading",
    isEnabled: (editor) => editor.can().toggleHeaderRow(),
    run: (editor) => editor.chain().focus().toggleHeaderRow().run(),
  },
  {
    id: "mergeCells",
    icon: "Columns3",
    isEnabled: (editor) => editor.can().mergeCells(),
    run: (editor) => editor.chain().focus().mergeCells().run(),
  },
  {
    id: "splitCell",
    icon: "ArrowRightLeft",
    isEnabled: (editor) => editor.can().splitCell(),
    run: (editor) => editor.chain().focus().splitCell().run(),
  },
  {
    id: "deleteTable",
    icon: "Trash",
    destructive: true,
    isEnabled: (editor) => editor.can().deleteTable(),
    run: (editor) => editor.chain().focus().deleteTable().run(),
  },
];
