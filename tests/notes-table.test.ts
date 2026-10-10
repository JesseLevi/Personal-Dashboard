// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { Editor } from "@tiptap/react";
import { CellSelection } from "@tiptap/pm/tables";
import { noteExtensions } from "../lib/notes/extensions";
import { TABLE_COMMANDS, insertTable } from "../lib/notes/table-commands";

// #330: the shared table command list and the resizable TableKit config,
// against the real extension whitelist.

let editor: Editor | null = null;

function make(content = "<p></p>"): Editor {
  editor = new Editor({ extensions: noteExtensions, content });
  return editor;
}

interface Json {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: Json[];
}

function tree(target: Editor) {
  return target.getJSON() as unknown as Json;
}

function dims(target: Editor) {
  const table = tree(target).content?.find((node) => node.type === "table");
  const rows = table?.content ?? [];
  return { rows: rows.length, cols: rows[0]?.content?.length ?? 0, firstCell: rows[0]?.content?.[0]?.type };
}

function command(id: string) {
  const found = TABLE_COMMANDS.find((entry) => entry.id === id);
  if (!found) throw new Error(`unknown table command ${id}`);
  return found;
}

afterEach(() => {
  editor?.destroy();
  editor = null;
});

describe("insertTable", () => {
  it.each([
    [1, 1],
    [3, 4],
    [8, 8],
    [2, 7],
  ])("inserts %i x %i with a header row", (rows, cols) => {
    const target = make();
    insertTable(target, rows, cols);
    expect(dims(target)).toEqual({ rows, cols, firstCell: "tableHeader" });
  });

  it("clamps to 1-8", () => {
    const target = make();
    insertTable(target, 20, 0);
    expect(dims(target)).toMatchObject({ rows: 8, cols: 1 });
  });
});

describe("table commands", () => {
  it("are all disabled outside a table", () => {
    const target = make();
    expect(TABLE_COMMANDS.filter((entry) => entry.isEnabled(target))).toEqual([]);
  });

  it("add and delete rows and columns", () => {
    const target = make();
    insertTable(target, 2, 2);
    command("addRowAfter").run(target);
    command("addColumnBefore").run(target);
    expect(dims(target)).toMatchObject({ rows: 3, cols: 3 });
    command("deleteRow").run(target);
    command("deleteColumn").run(target);
    expect(dims(target)).toMatchObject({ rows: 2, cols: 2 });
  });

  it("toggles the header row and deletes the table", () => {
    const target = make();
    insertTable(target, 2, 2);
    command("toggleHeaderRow").run(target);
    expect(dims(target).firstCell).toBe("tableCell");
    command("deleteTable").run(target);
    expect(dims(target).rows).toBe(0);
  });

  it("merge and split are only enabled when applicable", () => {
    const target = make();
    insertTable(target, 2, 2);
    expect(command("mergeCells").isEnabled(target)).toBe(false);
    expect(command("splitCell").isEnabled(target)).toBe(false);

    const cells: number[] = [];
    target.state.doc.descendants((node, pos) => {
      if (node.type.name === "tableCell" || node.type.name === "tableHeader") cells.push(pos);
    });
    target.view.dispatch(target.state.tr.setSelection(CellSelection.create(target.state.doc, cells[0]!, cells[1]!)));
    expect(command("mergeCells").isEnabled(target)).toBe(true);
    command("mergeCells").run(target);
    expect(command("splitCell").isEnabled(target)).toBe(true);
  });
});

describe("resizable tables", () => {
  it("loads a table without colwidth (pre-#330 note) unchanged", () => {
    const html = "<table><tbody><tr><th><p>A</p></th><th><p>B</p></th></tr><tr><td><p>1</p></td><td><p>2</p></td></tr></tbody></table>";
    const target = make(html);
    const row = tree(target).content?.[0]?.content?.[0];
    expect(row?.content?.map((cell) => cell.attrs?.colwidth ?? null)).toEqual([null, null]);
    expect(dims(target)).toEqual({ rows: 2, cols: 2, firstCell: "tableHeader" });
  });

  it("round-trips colwidth through the document JSON", () => {
    const target = make('<table><tbody><tr><td colwidth="120"><p>A</p></td><td colwidth="200"><p>B</p></td></tr></tbody></table>');
    const json = tree(target);
    const widths = json.content?.[0]?.content?.[0]?.content?.map((cell) => cell.attrs?.colwidth);
    expect(widths).toEqual([[120], [200]]);
    target.destroy();
    editor = new Editor({ extensions: noteExtensions, content: json });
    expect(editor.getJSON()).toEqual(json);
  });

  it("registers the column-resizing plugin", () => {
    const target = make("<p>x</p>");
    expect(target.state.plugins.some((plugin) => String((plugin as unknown as { key: string }).key).includes("tableColumnResizing"))).toBe(true);
  });
});
