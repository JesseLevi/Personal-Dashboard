// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { Editor } from "@tiptap/react";
import type CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { noteExtensions } from "../lib/notes/extensions";
import { toPlainText, type TipTapDocument } from "../lib/notes/document";
import { loadCodeLanguage, rehighlightCodeBlocks, CODE_LANGUAGE_IDS } from "../lib/notes/code-languages";
import { SLASH_ITEMS } from "../lib/notes/slash-items";

// #336: code blocks (CodeBlockLowlight, node name unchanged) and the
// collapsible section (Details), against the real extension whitelist.

let editor: Editor | null = null;

function make(content: string | object = "<p></p>"): Editor {
  editor = new Editor({ extensions: noteExtensions, content: content as never });
  return editor;
}

afterEach(() => {
  editor?.destroy();
  editor = null;
});

// A note saved before #336, when StarterKit's plain codeBlock was the node.
const OLD_DOC = {
  type: "doc",
  content: [
    { type: "paragraph", content: [{ type: "text", text: "Voor" }] },
    { type: "codeBlock", attrs: { language: null }, content: [{ type: "text", text: "const a = 1;\nconst b = 2;" }] },
    { type: "codeBlock", attrs: { language: "javascript" }, content: [{ type: "text", text: "let x = 1;" }] },
    { type: "codeBlock", content: [{ type: "text", text: "no attrs at all" }] },
  ],
};

describe("code blocks", () => {
  it("loads pre-#336 stored codeBlock JSON unchanged", () => {
    const target = make(OLD_DOC);
    const blocks = target.getJSON().content!.filter((node) => node.type === "codeBlock");
    expect(blocks).toHaveLength(3);
    expect((blocks[0].content![0] as { text: string }).text).toBe("const a = 1;\nconst b = 2;");
    expect(blocks[1].attrs!.language).toBe("javascript");
    expect(toPlainText(target.getJSON() as TipTapDocument)).toContain("const a = 1;");
  });

  it("persists the language attribute through getJSON", () => {
    const target = make("<p></p>");
    target.chain().focus().setCodeBlock({ language: "python" }).run();
    expect(target.getJSON().content![0]).toMatchObject({ type: "codeBlock", attrs: { language: "python" } });
    target.commands.updateAttributes("codeBlock", { language: "sql" });
    expect(target.getJSON().content![0].attrs!.language).toBe("sql");
  });

  it("highlights only after the grammar is lazily registered", async () => {
    // Without a mounted <EditorContent>, TipTap renders React node views as a bare placeholder.
    // Drop the code block's node view so the plain <pre><code> carries the highlight decorations.
    const extensions = noteExtensions.map((extension) =>
      extension.name === "codeBlock" ? (extension as typeof CodeBlockLowlight).extend({ addNodeView: () => null }) : extension,
    );
    const target = new Editor({
      extensions,
      content: {
        type: "doc",
        content: [{ type: "codeBlock", attrs: { language: "json" }, content: [{ type: "text", text: '{"a": 1}' }] }],
      },
    });
    editor = target;
    expect(target.view.dom.querySelector(".hljs-attr")).toBeNull();
    expect(await loadCodeLanguage("json")).toBe(true);
    rehighlightCodeBlocks(target);
    expect(target.view.dom.querySelector(".hljs-attr")).not.toBeNull();
    expect((target.getJSON().content![0].content![0] as { text: string }).text).toBe('{"a": 1}');
    expect(await loadCodeLanguage("json")).toBe(false);
  });

  it("registers every language of the fixed set and ignores unknown ones", async () => {
    for (const id of CODE_LANGUAGE_IDS) await loadCodeLanguage(id);
    expect(await loadCodeLanguage("cobol")).toBe(false);
    expect(await loadCodeLanguage(null)).toBe(false);
  });

  it("does not highlight a block without a language", () => {
    const target = make({ type: "doc", content: [OLD_DOC.content[1], OLD_DOC.content[3]] });
    expect(target.view.dom.querySelector("[class*=hljs-]")).toBeNull();
  });
});

describe("collapsible section", () => {
  const detailsItem = SLASH_ITEMS.find((item) => item.id === "details")!;

  it("is offered as a slash item and inserts summary + content", () => {
    const target = make("<p></p>");
    detailsItem.run!(target);
    const json = target.getJSON();
    expect(json.content![0].type).toBe("details");
    expect(json.content![0].content!.map((node) => node.type)).toEqual(["detailsSummary", "detailsContent"]);
  });

  it("persists the open state as the `open` attribute", () => {
    const target = make("<p></p>");
    detailsItem.run!(target);
    expect(target.getJSON().content![0].attrs!.open).toBe(false);
    target.commands.command(({ tr }) => {
      tr.setNodeMarkup(0, undefined, { open: true });
      return true;
    });
    expect(target.getJSON().content![0].attrs!.open).toBe(true);
  });

  it("loads stored details JSON and exposes its text, open or not", () => {
    const stored = {
      type: "doc",
      content: [
        {
          type: "details",
          attrs: { open: false },
          content: [
            { type: "detailsSummary", content: [{ type: "text", text: "Samenvatting" }] },
            { type: "detailsContent", content: [{ type: "paragraph", content: [{ type: "text", text: "Verborgen inhoud" }] }] },
          ],
        },
      ],
    };
    const target = make(stored);
    expect(toPlainText(target.getJSON() as TipTapDocument)).toBe("Samenvatting\nVerborgen inhoud");
  });

  it("renders a toggle button that flips aria-expanded and the stored open state", () => {
    const target = make('<details><summary>Titel</summary><div data-type="detailsContent"><p>Binnen</p></div></details>');
    const button = target.view.dom.querySelector("[data-type=details] > button") as HTMLButtonElement;
    expect(button.tagName).toBe("BUTTON");
    expect(button.getAttribute("aria-expanded")).toBe("false");
    button.click();
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(target.getJSON().content![0].attrs!.open).toBe(true);
  });
});
