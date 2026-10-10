// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { Editor } from "@tiptap/react";
import { CharacterCount } from "@tiptap/extensions";
import { noteExtensions } from "../lib/notes/extensions";
import { countWords, readingMinutes, typographyForLocale } from "../lib/notes/writing-comfort";

// #334: locale-aware smart typography, word count, trailing node.

let editor: Editor | null = null;

function make(locale: string, content = "<p></p>"): Editor {
  editor = new Editor({
    extensions: [
      ...noteExtensions,
      typographyForLocale(locale),
      CharacterCount.configure({ wordCounter: countWords }),
    ],
    content,
  });
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

describe("smart typography", () => {
  it("uses Dutch quotes in nl", () => {
    const e = make("nl");
    type(e, 'hallo "wereld"');
    expect(e.getText()).toBe("hallo „wereld”");
  });

  it("uses English quotes in en", () => {
    const e = make("en");
    type(e, 'hello "world"');
    expect(e.getText()).toBe("hello “world”");
  });

  it("turns -- into an em dash", () => {
    const e = make("nl");
    type(e, "a--");
    expect(e.getText()).toBe("a—");
  });

  it("leaves code blocks untouched", () => {
    const e = make("nl", "<pre><code></code></pre>");
    type(e, 'a -- "b"');
    expect(e.getText().trim()).toBe('a -- "b"');
  });
});

describe("trailing node", () => {
  it("keeps an empty paragraph after a code block", () => {
    const e = make("nl", "<pre><code>x</code></pre>");
    expect(e.getJSON().content?.at(-1)?.type).toBe("paragraph");
  });
});

describe("word count", () => {
  it("counts live and across blocks", () => {
    const e = make("nl", "<p>een twee</p><p>drie</p>");
    expect(e.storage.characterCount.words()).toBe(3);
    type(e, " vier");
    expect(e.storage.characterCount.words()).toBe(4);
  });

  it("rounds reading time up with a minimum of one minute", () => {
    expect(readingMinutes(0)).toBe(0);
    expect(readingMinutes(1)).toBe(1);
    expect(readingMinutes(312)).toBe(2);
  });
});
