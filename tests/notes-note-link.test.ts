// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { Editor } from "@tiptap/react";
import { noteExtensionsWith } from "../lib/notes/extensions";
import { extractNoteLinkIds, type TipTapDocument } from "../lib/notes/document";
import { NoteLinkSuggestion, getNoteLinkStore, type NoteLinkSuggestionItem } from "../lib/notes/note-link-suggestion";
import { buildNoteLinkResolution, resolveNoteLink } from "../lib/notes/note-link";
import { SLASH_ITEMS } from "../lib/notes/slash-items";
import { SlashCommand } from "../lib/notes/slash-command";

// #341 (ADR-0023): the noteLink node, its resolution, and the "[[" trigger.

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

const NOTES: NoteLinkSuggestionItem[] = [
  { id: A, title: "Boodschappen", category_name: "Huis" },
  { id: B, title: "Boek ideeen", category_name: "Werk" },
];

let editor: Editor | null = null;
afterEach(() => {
  editor?.destroy();
  editor = null;
});

function make(content: string | object = "<p></p>", queries: string[] = []) {
  editor = new Editor({
    extensions: [
      ...noteExtensionsWith({ titles: {}, missing: [] }),
      NoteLinkSuggestion.configure({
        debounce: 0,
        search: async (query) => {
          queries.push(query);
          return NOTES.filter((note) => note.title.toLowerCase().includes(query.trim().toLowerCase()));
        },
      }),
      SlashCommand,
    ],
    content,
  });
  return editor;
}

async function type(target: Editor, text: string) {
  target.commands.focus("end");
  target.commands.insertContent(text);
  // Suggestion resolves its items a few ticks after the keystroke.
  await new Promise((resolve) => setTimeout(resolve, 20));
}

const linkNode = { type: "noteLink", attrs: { noteId: A, label: "Boodschappen" } };

describe("noteLink node", () => {
  it("stores noteId + label, the attributes save_note_content reads", () => {
    const target = make({ type: "doc", content: [{ type: "paragraph", content: [linkNode] }] });
    const json = target.getJSON();
    expect(json.content?.[0]?.content?.[0]).toEqual(linkNode);
    expect(extractNoteLinkIds(json as TipTapDocument)).toEqual([A]);
  });

  it("round-trips through HTML", () => {
    const target = make({ type: "doc", content: [{ type: "paragraph", content: [linkNode] }] });
    const html = target.getHTML();
    expect(html).toContain('data-type="noteLink"');
    target.commands.setContent(html);
    expect(target.getJSON().content?.[0]?.content?.[0]).toEqual(linkNode);
  });

  it("reads as its label in text", () => {
    const target = make({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Zie " }, linkNode] }],
    });
    expect(target.getText()).toBe("Zie Boodschappen");
  });
});

describe("markdown export", () => {
  it("writes a link as [[label]]", async () => {
    const { docToMarkdown } = await import("../lib/notes/markdown");
    const markdown = docToMarkdown({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Zie " }, linkNode] }],
    });
    expect(markdown).toBe("Zie [[Boodschappen]]\n");
  });
});

describe("resolveNoteLink", () => {
  const doc = { type: "doc", content: [{ type: "paragraph", content: [linkNode, { ...linkNode, attrs: { noteId: B, label: "x" } }] }] } as TipTapDocument;
  const resolution = buildNoteLinkResolution(doc, { [A]: "Nieuwe titel" });

  it("shows the current title, not the stored label", () => {
    expect(resolveNoteLink(resolution, A, "Boodschappen")).toEqual({
      state: "link",
      title: "Nieuwe titel",
      href: `/notities/${A}`,
    });
  });

  it("marks an id the server could not resolve as deleted", () => {
    expect(resolution.missing).toEqual([B]);
    expect(resolveNoteLink(resolution, B, "x")).toEqual({ state: "deleted" });
  });

  it("falls back to the label for a link inserted after the note opened", () => {
    expect(resolveNoteLink(resolution, "33333333-3333-4333-8333-333333333333", " Nieuw ")).toMatchObject({
      state: "link",
      title: "Nieuw",
    });
  });
});

describe("[[ trigger", () => {
  it("opens with matching notes, then Enter-style select inserts a link and a space", async () => {
    const queries: string[] = [];
    const target = make("<p></p>", queries);
    await type(target, "[[boo");
    const store = getNoteLinkStore(target)!;
    expect(queries.at(-1)).toBe("boo");
    expect(store.getSnapshot().open).toBe(true);
    expect(store.getSnapshot().items.map((item) => item.id)).toEqual([A]);

    store.select(store.getSnapshot().items[0]!);
    const paragraph = target.getJSON().content?.[0]?.content;
    expect(paragraph?.[0]).toEqual(linkNode);
    expect(target.getText()).not.toContain("[[");
    expect(store.getSnapshot().open).toBe(false);
  });

  it("allows spaces in the query (titles have them)", async () => {
    const target = make();
    await type(target, "[[boek id");
    expect(getNoteLinkStore(target)!.getSnapshot().items.map((item) => item.id)).toEqual([B]);
    expect(getNoteLinkStore(target)!.getSnapshot().open).toBe(true);
  });

  it("does not open inside a code block", async () => {
    const target = make("<pre><code>x</code></pre>");
    await type(target, " [[");
    expect(getNoteLinkStore(target)!.getSnapshot().open).toBe(false);
  });

  it("the slash item types the trigger", async () => {
    const target = make();
    const item = SLASH_ITEMS.find((candidate) => candidate.id === "noteLink")!;
    expect(item.isEnabled?.(target)).toBe(true);
    item.run?.(target);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(getNoteLinkStore(target)!.getSnapshot().open).toBe(true);
  });
});
