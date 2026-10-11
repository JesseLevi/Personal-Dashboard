// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { Editor } from "@tiptap/react";
import { noteExtensions } from "../lib/notes/extensions";
import { SlashCommand, getSlashStore } from "../lib/notes/slash-command";
import { SLASH_ITEMS, filterSlashItems } from "../lib/notes/slash-items";

// #332: the shared block-insert list, its nl/en filter, and the "/" trigger
// rules against the real extension whitelist.

const ids = (query: string) => filterSlashItems(SLASH_ITEMS, query).map((item) => item.id);

describe("filterSlashItems", () => {
  it("returns every item, in list order, for an empty query", () => {
    expect(ids("")).toEqual(SLASH_ITEMS.map((item) => item.id));
  });

  it("matches Dutch aliases", () => {
    expect(ids("kop")).toEqual(["heading1", "heading2", "heading3"]);
    expect(ids("kop2")).toEqual(["heading2"]);
    expect(ids("lijst")).toEqual(expect.arrayContaining(["bulletList", "orderedList"]));
    expect(ids("taak")).toEqual(["taskList"]);
    expect(ids("tabel")).toEqual(["table"]);
  });

  it("matches English aliases", () => {
    expect(ids("heading")).toEqual(["heading1", "heading2", "heading3"]);
    expect(ids("h2")).toEqual(["heading2"]);
    expect(ids("todo")).toEqual(["taskList"]);
    expect(ids("quote")).toEqual(["blockquote"]);
    expect(ids("divider")).toEqual(["divider"]);
  });

  it("ignores case, accents and spaces", () => {
    expect(ids("KOP 2")).toEqual(["heading2"]);
    expect(ids("Heading 3")).toEqual(["heading3"]);
  });

  it("matches a supplied label and returns nothing for gibberish", () => {
    expect(filterSlashItems(SLASH_ITEMS, "scheidingsteken", (item) => (item.id === "divider" ? ["Scheidingsteken"] : []))).toHaveLength(1);
    expect(ids("zzzz")).toEqual([]);
  });

  it("lists items that START with the query before substring matches", () => {
    const result = ids("code");
    expect(result[0]).toBe("codeBlock");
  });
});

let editor: Editor | null = null;

function make(content = "<p></p>"): Editor {
  editor = new Editor({ extensions: [...noteExtensions, SlashCommand], content });
  return editor;
}

function store(target: Editor) {
  return getSlashStore(target)!;
}

// Suggestion resolves its items a microtask after the keystroke.
async function type(target: Editor, text: string, atEnd = true) {
  if (atEnd) target.commands.focus("end");
  target.commands.insertContent(text);
  await new Promise((resolve) => setTimeout(resolve, 0));
}

afterEach(() => {
  editor?.destroy();
  editor = null;
});

describe("slash trigger", () => {
  it("opens at the start of an empty block and after a space", async () => {
    const first = make();
    await type(first, "/");
    expect(store(first).getSnapshot().open).toBe(true);
    first.commands.setContent("<p>hello</p>");
    await type(first, " /");
    expect(store(first).getSnapshot().open).toBe(true);
  });

  it("does not open inside a word", async () => {
    const target = make("<p>and</p>");
    await type(target, "/or");
    expect(store(target).getSnapshot().open).toBe(false);
  });

  it("does not open inside a code block", async () => {
    const target = make("<pre><code>x</code></pre>");
    await type(target, " /");
    expect(store(target).getSnapshot().open).toBe(false);
  });

  it("filters while typing and /kop2 + select makes an H2 without the typed text", async () => {
    const target = make();
    await type(target, "/kop2");
    const state = store(target).getSnapshot();
    expect(state.items.map((item) => item.id)).toEqual(["heading2"]);
    store(target).select(state.items[0]);
    const json = target.getJSON();
    expect(json.content?.[0]).toMatchObject({ type: "heading", attrs: { level: 2 } });
    expect(target.getText().trim()).toBe("");
    expect(store(target).getSnapshot().open).toBe(false);
  });

  it("shows no items for an unknown query", async () => {
    const target = make();
    await type(target, "/zzzz");
    expect(store(target).getSnapshot()).toMatchObject({ open: true, items: [] });
  });

  it("selecting Table hands off to the size picker instead of inserting", async () => {
    const target = make();
    await type(target, "/tabel");
    const state = store(target).getSnapshot();
    store(target).select(state.items[0]);
    expect(target.getJSON().content?.some((node) => node.type === "table")).toBe(false);
    expect(store(target).getSnapshot()).toMatchObject({ open: false, tablePicker: {} });
  });

  it("does not offer Table inside a table cell", async () => {
    const target = make();
    target.chain().focus().insertTable({ rows: 2, cols: 2 }).run();
    await type(target, "/tabel", false);
    expect(store(target).getSnapshot().items).toEqual([]);
  });
});
