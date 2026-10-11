// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { Editor } from "@tiptap/react";
import { noteExtensions } from "../lib/notes/extensions";
import { TABLE_COMMANDS, moveTableLine, tableInfo } from "../lib/notes/table-commands";

// #387: row/column reorder commands and the shared move helper, against the
// real extension whitelist.

let editor: Editor | null = null;

const header = "<tr><th><p>H1</p></th><th><p>H2</p></th><th><p>H3</p></th></tr>";
const body = (n: number) => `<tr><td><p>A${n}</p></td><td><p>B${n}</p></td><td><p>C${n}</p></td></tr>`;
const withHeader = `<table><tbody>${header}${body(1)}${body(2)}</tbody></table>`;
const noHeader = `<table><tbody>${body(1)}${body(2)}${body(3)}</tbody></table>`;

function make(content: string): Editor {
  editor = new Editor({ extensions: noteExtensions, content });
  return editor;
}

interface Json {
  type?: string;
  text?: string;
  content?: Json[];
}

function matrix(target: Editor): string[][] {
  const doc = target.getJSON() as unknown as Json;
  const table = doc.content?.find((node) => node.type === "table");
  return (table?.content ?? []).map((row) =>
    (row.content ?? []).map((cell) => cell.content?.[0]?.content?.[0]?.text ?? ""),
  );
}

function place(target: Editor, text: string) {
  let found = -1;
  target.state.doc.descendants((node, pos) => {
    if (node.isText && node.text === text) found = pos + 1;
  });
  if (found < 0) throw new Error(`no text ${text}`);
  target.commands.setTextSelection(found);
}

function command(id: string) {
  const found = TABLE_COMMANDS.find((entry) => entry.id === id);
  if (!found) throw new Error(`unknown table command ${id}`);
  return found;
}

function enabled(target: Editor, id: string) {
  return command(id).isEnabled(target);
}

afterEach(() => {
  editor?.destroy();
  editor = null;
});

describe("move row commands", () => {
  it("moves a body row up and down", () => {
    const target = make(noHeader);
    place(target, "A2");
    command("moveRowUp").run(target);
    expect(matrix(target).map((row) => row[0])).toEqual(["A2", "A1", "A3"]);
    command("moveRowDown").run(target);
    expect(matrix(target).map((row) => row[0])).toEqual(["A1", "A2", "A3"]);
  });

  it("keeps the whole row intact and the cursor row selected for repeat moves", () => {
    const target = make(noHeader);
    place(target, "A3");
    command("moveRowUp").run(target);
    command("moveRowUp").run(target);
    expect(matrix(target)).toEqual([
      ["A3", "B3", "C3"],
      ["A1", "B1", "C1"],
      ["A2", "B2", "C2"],
    ]);
    expect(enabled(target, "moveRowUp")).toBe(false);
  });

  it("disables at the table edges", () => {
    const target = make(noHeader);
    place(target, "A1");
    expect(enabled(target, "moveRowUp")).toBe(false);
    expect(enabled(target, "moveRowDown")).toBe(true);
    place(target, "A3");
    expect(enabled(target, "moveRowUp")).toBe(true);
    expect(enabled(target, "moveRowDown")).toBe(false);
  });

  it("is one undo step", () => {
    const target = make(noHeader);
    place(target, "A2");
    command("moveRowUp").run(target);
    target.commands.undo();
    expect(matrix(target).map((row) => row[0])).toEqual(["A1", "A2", "A3"]);
  });
});

describe("header row protection", () => {
  it("never moves the header row", () => {
    const target = make(withHeader);
    place(target, "H2");
    expect(enabled(target, "moveRowUp")).toBe(false);
    expect(enabled(target, "moveRowDown")).toBe(false);
  });

  it("never moves a row into the header position", () => {
    const target = make(withHeader);
    place(target, "A1");
    expect(enabled(target, "moveRowUp")).toBe(false);
    expect(enabled(target, "moveRowDown")).toBe(true);
    command("moveRowUp").run(target);
    expect(matrix(target)[0]).toEqual(["H1", "H2", "H3"]);
  });

  it("refuses a drag into or out of row 0", () => {
    const target = make(withHeader);
    expect(moveTableLine(target, "row", 2, 0)).toBe(false);
    expect(moveTableLine(target, "row", 0, 2)).toBe(false);
    expect(matrix(target)[0]).toEqual(["H1", "H2", "H3"]);
  });

  it("treats row 0 as an ordinary row once the header is toggled off", () => {
    const target = make(noHeader);
    place(target, "A1");
    expect(moveTableLine(target, "row", 0, 2)).toBe(true);
    expect(matrix(target).map((row) => row[0])).toEqual(["A2", "A3", "A1"]);
  });
});

describe("move column commands", () => {
  it("moves a column left and right, header cell included", () => {
    const target = make(withHeader);
    place(target, "B1");
    command("moveColumnLeft").run(target);
    expect(matrix(target)[0]).toEqual(["H2", "H1", "H3"]);
    expect(matrix(target)[1]).toEqual(["B1", "A1", "C1"]);
    command("moveColumnRight").run(target);
    expect(matrix(target)[0]).toEqual(["H1", "H2", "H3"]);
  });

  it("disables at the table edges", () => {
    const target = make(withHeader);
    place(target, "H1");
    expect(enabled(target, "moveColumnLeft")).toBe(false);
    expect(enabled(target, "moveColumnRight")).toBe(true);
    place(target, "C2");
    expect(enabled(target, "moveColumnLeft")).toBe(true);
    expect(enabled(target, "moveColumnRight")).toBe(false);
  });

  it("is one undo step", () => {
    const target = make(withHeader);
    place(target, "C1");
    command("moveColumnLeft").run(target);
    target.commands.undo();
    expect(matrix(target)[0]).toEqual(["H1", "H2", "H3"]);
  });
});

describe("outside a table and merged cells", () => {
  it("disables every move outside a table", () => {
    const target = make(`<p>plain</p>${noHeader}`);
    place(target, "plain");
    for (const id of ["moveRowUp", "moveRowDown", "moveColumnLeft", "moveColumnRight"]) {
      expect(enabled(target, id)).toBe(false);
    }
  });

  it("disables moves when the table has merged cells", () => {
    const merged = `<table><tbody><tr><td colspan="2"><p>M</p></td><td><p>X</p></td></tr>${body(1)}${body(2)}</tbody></table>`;
    const target = make(merged);
    place(target, "A1");
    expect(tableInfo(target.state)?.merged).toBe(true);
    expect(enabled(target, "moveRowDown")).toBe(false);
    expect(enabled(target, "moveColumnRight")).toBe(false);
  });
});

describe("moveTableLine on a table the caret is not in", () => {
  it("moves a row of the table whose cell position is given", () => {
    const target = make(`<p>plain</p>${noHeader}`);
    place(target, "plain");
    let cell = -1;
    target.state.doc.descendants((node, pos) => {
      if (node.isText && node.text === "A3") cell = pos;
    });
    expect(moveTableLine(target, "row", 2, 0, cell)).toBe(true);
    expect(matrix(target).map((row) => row[0])).toEqual(["A3", "A1", "A2"]);
  });
});
