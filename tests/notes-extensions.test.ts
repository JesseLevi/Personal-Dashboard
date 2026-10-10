// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { Editor } from "@tiptap/react";
import { noteExtensions } from "../lib/notes/extensions";
import { toPlainText, type TipTapDocument } from "../lib/notes/document";

// #329: markdown input rules and task-list behaviour against the real
// extension whitelist. Typing is simulated through ProseMirror's own
// `handleTextInput` hook, the path a keystroke takes in the browser.

let editor: Editor | null = null;

function make(content = "<p></p>"): Editor {
  editor = new Editor({ extensions: noteExtensions, content });
  editor.commands.focus("end");
  return editor;
}

function type(target: Editor, text: string) {
  for (const char of text) {
    const { from, to } = target.state.selection;
    const handled = target.view.someProp("handleTextInput", (handler) =>
      handler(target.view, from, to, char, () => target.state.tr.insertText(char, from, to)),
    );
    if (!handled) target.view.dispatch(target.state.tr.insertText(char, from, to));
  }
}

afterEach(() => {
  editor?.destroy();
  editor = null;
});

describe("markdown input rules", () => {
  it.each([
    ["# ", "heading", { level: 1 }],
    ["## ", "heading", { level: 2 }],
    ["### ", "heading", { level: 3 }],
    ["- ", "bulletList", undefined],
    ["1. ", "orderedList", undefined],
    ["[] ", "taskList", undefined],
    ["[ ] ", "taskList", undefined],
  ] as const)("%j creates %s", (input, node, attrs) => {
    const target = make();
    type(target, input);
    expect(target.isActive(node, attrs)).toBe(true);
  });

  it("[x] creates a checked task item", () => {
    const target = make();
    type(target, "[x] ");
    const item = target.getJSON().content?.[0]?.content?.[0] as { attrs?: { checked?: boolean } } | undefined;
    expect(item?.attrs?.checked).toBe(true);
  });

  it("limits headings to levels 1-3", () => {
    const target = make();
    type(target, "#### ");
    expect(target.isActive("heading")).toBe(false);
  });
});

describe("task lists", () => {
  const nested =
    '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><div><p>Boodschappen</p>' +
    '<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><div><p>Melk</p></div></li></ul>' +
    "</div></li></ul>";

  it("round-trips nested task lists and their checked state through JSON", () => {
    const target = make(nested);
    const json = target.getJSON() as TipTapDocument;
    const reloaded = new Editor({ extensions: noteExtensions, content: json });
    expect(reloaded.getHTML()).toBe(target.getHTML());
    expect(toPlainText(json)).toBe("Boodschappen\nMelk");
    reloaded.destroy();
  });

  it("toggles the list type through commands", () => {
    const target = make("<p>Item</p>");
    target.chain().toggleTaskList().run();
    expect(target.isActive("taskList")).toBe(true);
    target.chain().toggleBulletList().run();
    expect(target.isActive("bulletList")).toBe(true);
    expect(target.isActive("taskList")).toBe(false);
  });

  it("loads an existing H1 + bullet list note unchanged", () => {
    const legacy = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Titel" }] },
        {
          type: "bulletList",
          content: [
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Een" }] }] },
          ],
        },
      ],
    };
    const target = make();
    target.commands.setContent(legacy);
    const json = target.getJSON() as TipTapDocument;
    expect(json.content[0]).toMatchObject({ type: "heading", attrs: { level: 1 } });
    expect(json.content[1]?.type).toBe("bulletList");
    expect(toPlainText(json)).toBe("Titel\nEen");
  });
});
