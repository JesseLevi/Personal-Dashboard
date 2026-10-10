import type { Editor } from "@tiptap/react";
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
