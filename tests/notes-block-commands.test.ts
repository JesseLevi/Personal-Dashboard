// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { Editor } from "@tiptap/react";
import { noteExtensions } from "../lib/notes/extensions";
import {
  blockTypeId,
  canMoveBlock,
  deleteBlock,
  duplicateBlock,
  isConvertibleBlock,
  moveBlock,
  selectBlockStart,
  topLevelBlockAt,
} from "../lib/notes/block-commands";

// #335: the generic top-level block commands behind the drag handle, block
// menu and Mod-Shift-Up/Down, against the real extension whitelist.

let editor: Editor | null = null;

function make(content: string): Editor {
  editor = new Editor({ extensions: noteExtensions, content });
  return editor;
}

const texts = (target: Editor) => target.state.doc.children.map((child) => child.textContent || child.type.name);
const posOf = (target: Editor, index: number) => {
  let pos = 0;
  for (let i = 0; i < index; i += 1) pos += target.state.doc.child(i).nodeSize;
  return pos;
};

afterEach(() => {
  editor?.destroy();
  editor = null;
});

describe("topLevelBlockAt", () => {
  it("resolves the document child around a nested position", () => {
    const e = make("<p>one</p><ul><li><p>two</p></li></ul>");
    const block = topLevelBlockAt(e.state.doc, posOf(e, 1) + 4);
    expect(block?.node.type.name).toBe("bulletList");
    expect(block?.from).toBe(posOf(e, 1));
  });
});

describe("moveBlock", () => {
  it("moves a block down and up, and reports the edges", () => {
    const e = make("<p>one</p><h2>two</h2><p>three</p>");
    expect(canMoveBlock(e, "up", 0)).toBe(false);
    expect(moveBlock(e, "up", 0)).toBe(false);
    expect(moveBlock(e, "down", 0)).toBe(true);
    expect(texts(e)).toEqual(["two", "one", "three"]);
    expect(moveBlock(e, "up", posOf(e, 1))).toBe(true);
    expect(texts(e)).toEqual(["one", "two", "three"]);
    expect(canMoveBlock(e, "down", posOf(e, 2))).toBe(false);
  });

  it("moves any block type, tables included, and keeps the cursor in the block", () => {
    const e = make("<table><tr><td><p>cell</p></td></tr></table><p>after</p>");
    e.commands.setTextSelection(4);
    expect(moveBlock(e, "down")).toBe(true);
    expect(e.state.doc.child(1).type.name).toBe("table");
    expect(e.state.selection.$from.node(1).type.name).toBe("table");
  });

  it("is a single undo step", () => {
    const e = make("<p>one</p><p>two</p>");
    moveBlock(e, "down", 0);
    expect(texts(e)).toEqual(["two", "one"]);
    e.commands.undo();
    expect(texts(e)).toEqual(["one", "two"]);
  });

  it("runs from Mod-Shift-ArrowDown / ArrowUp", () => {
    const e = make("<p>one</p><p>two</p>");
    e.commands.setTextSelection(2);
    const press = (key: string) =>
      e.view.someProp("handleKeyDown", (handler) =>
        handler(e.view, new KeyboardEvent("keydown", { key, ctrlKey: true, shiftKey: true })),
      );
    expect(press("ArrowDown")).toBe(true);
    expect(texts(e)).toEqual(["two", "one"]);
    expect(press("ArrowUp")).toBe(true);
    expect(texts(e)).toEqual(["one", "two"]);
  });
});

describe("duplicateBlock", () => {
  it("inserts a copy after the block, undoable in one step", () => {
    const e = make("<h1>title</h1><p>body</p>");
    expect(duplicateBlock(e, 0)).toBe(true);
    expect(texts(e)).toEqual(["title", "title", "body"]);
    expect(e.state.doc.child(1).type.name).toBe("heading");
    e.commands.undo();
    expect(texts(e)).toEqual(["title", "body"]);
  });

  it("copies a list with all its items", () => {
    const e = make("<ul><li><p>a</p></li><li><p>b</p></li></ul>");
    duplicateBlock(e, 0);
    expect(e.state.doc.childCount).toBe(3);
    expect(e.state.doc.child(1).childCount).toBe(2);
  });
});

describe("deleteBlock", () => {
  it("removes the block and restores it on undo", () => {
    const e = make("<p>one</p><p>two</p><p>three</p>");
    expect(deleteBlock(e, posOf(e, 1))).toBe(true);
    expect(texts(e)).toEqual(["one", "three"]);
    e.commands.undo();
    expect(texts(e)).toEqual(["one", "two", "three"]);
  });

  it("leaves an empty paragraph when the only block goes", () => {
    const e = make("<h1>only</h1>");
    expect(deleteBlock(e, 0)).toBe(true);
    expect(e.state.doc.childCount).toBe(1);
    expect(e.state.doc.child(0).type.name).toBe("paragraph");
    expect(e.state.doc.textContent).toBe("");
  });
});

describe("details and code blocks (#336)", () => {
  const detailsJson = {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "intro" }] },
      {
        type: "details",
        attrs: { open: true },
        content: [
          { type: "detailsSummary", content: [{ type: "text", text: "Titel" }] },
          { type: "detailsContent", content: [{ type: "paragraph", content: [{ type: "text", text: "inhoud" }] }] },
        ],
      },
      { type: "codeBlock", attrs: { language: null }, content: [{ type: "text", text: "let a = 1" }] },
    ],
  };

  it("moves, duplicates and deletes a details block whole, with undo", () => {
    editor = new Editor({ extensions: noteExtensions, content: detailsJson });
    const e = editor;
    expect(moveBlock(e, "up", posOf(e, 1))).toBe(true);
    expect(e.state.doc.child(0).type.name).toBe("details");
    e.commands.undo();
    expect(e.state.doc.child(1).type.name).toBe("details");

    duplicateBlock(e, posOf(e, 1));
    expect(e.state.doc.child(2).type.name).toBe("details");
    expect(e.state.doc.child(2).childCount).toBe(2);
    deleteBlock(e, posOf(e, 2));
    expect(e.state.doc.child(2).type.name).toBe("codeBlock");
  });

  it("moves a code block and keeps Turn into for it but not for details", () => {
    editor = new Editor({ extensions: noteExtensions, content: detailsJson });
    const e = editor;
    const [, details, code] = e.state.doc.children;
    expect(isConvertibleBlock(details)).toBe(false);
    expect(blockTypeId(code)).toBe("codeBlock");
    expect(moveBlock(e, "up", posOf(e, 2))).toBe(true);
    expect(e.state.doc.child(1).type.name).toBe("codeBlock");
  });
});

describe("block type helpers", () => {
  it("names the block type and gates tables out of Turn into", () => {
    const e = make("<h2>h</h2><ul><li><p>a</p></li></ul><table><tr><td><p>c</p></td></tr></table>");
    const [heading, list, table] = e.state.doc.children;
    expect(blockTypeId(heading)).toBe("heading2");
    expect(blockTypeId(list)).toBe("bulletList");
    expect(isConvertibleBlock(table)).toBe(false);
    expect(blockTypeId(table)).toBeNull();
  });

  it("selectBlockStart puts the cursor inside the block", () => {
    const e = make("<p>one</p><ul><li><p>two</p></li></ul>");
    selectBlockStart(e, posOf(e, 1));
    expect(e.state.selection.$from.node(1).type.name).toBe("bulletList");
  });
});
