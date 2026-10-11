// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { Editor } from "@tiptap/react";
import { noteExtensions } from "../lib/notes/extensions";
import { deriveTitle, extractNoteLinkIds, toPlainText, type TipTapDocument } from "../lib/notes/document";
import { docToMarkdown } from "../lib/notes/markdown";
import { tiptapDocumentSchema } from "../lib/notes/schemas";
import { MIN_TOC_HEADINGS, pickActiveId } from "../lib/notes/toc";

// #342: heading ids + table of contents. An existing note (no ids) must load
// unchanged, get ids, and every consumer of the stored document must ignore
// the new attributes.

let editor: Editor | null = null;
afterEach(() => {
  editor?.destroy();
  editor = null;
});

const text = (value: string) => ({ type: "text", text: value });
const heading = (level: number, value: string) => ({ type: "heading", attrs: { level }, content: [text(value)] });
const paragraph = (value: string) => ({ type: "paragraph", content: [text(value)] });

/** A note saved before #342: headings carry only `level` (and TextAlign's null). */
const OLD_DOC: TipTapDocument = {
  type: "doc",
  content: [
    heading(1, "Plan"),
    paragraph("Intro"),
    heading(2, "Boodschappen"),
    paragraph("Melk"),
    heading(3, "Details"),
  ],
};

/** Editor creation assigns ids in a deferred `create` handler, so wait one tick. */
async function load(doc: unknown = OLD_DOC): Promise<Editor> {
  editor = new Editor({ extensions: noteExtensions, content: doc as never });
  await new Promise((resolve) => setTimeout(resolve, 10));
  return editor;
}

describe("heading ids on an old document", () => {
  it("loads with all content intact and gives every heading an id", async () => {
    const json = (await load()).getJSON() as TipTapDocument;
    expect(json.content.map((node) => node.type)).toEqual(["heading", "paragraph", "heading", "paragraph", "heading"]);
    const ids = json.content.filter((n) => n.type === "heading").map((n) => n.attrs?.id);
    expect(ids.every((id) => typeof id === "string" && id.length > 0)).toBe(true);
    expect(new Set(ids).size).toBe(3);
  });

  it("keeps toPlainText and deriveTitle unaffected by the ids", async () => {
    const json = (await load()).getJSON() as TipTapDocument;
    expect(toPlainText(json)).toBe(toPlainText(OLD_DOC));
    expect(deriveTitle(json)).toBe(deriveTitle(OLD_DOC));
    expect(deriveTitle(json)).toBe("Plan");
  });

  it("keeps note-link extraction and markdown export unaffected", async () => {
    const withLink: TipTapDocument = {
      type: "doc",
      content: [
        heading(2, "Titel"),
        { type: "paragraph", content: [{ type: "noteLink", attrs: { noteId: "11111111-1111-4111-8111-111111111111", label: "Ander" } }] },
      ],
    };
    const json = (await load(withLink)).getJSON() as TipTapDocument;
    expect(extractNoteLinkIds(json)).toEqual(extractNoteLinkIds(withLink));
    expect(docToMarkdown(json)).toBe(docToMarkdown(withLink));
    expect(docToMarkdown(json)).toContain("## Titel");
    expect(docToMarkdown(json)).not.toMatch(/data-toc-id|[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab]/);
  });

  it("passes the server-side document schema with the new attributes", async () => {
    expect(tiptapDocumentSchema.safeParse((await load()).getJSON()).success).toBe(true);
  });
});

describe("heading ids on edit", () => {
  it("gives a newly added heading an id and keeps existing ids stable", async () => {
    const target = await load();
    const before = (target.getJSON() as TipTapDocument).content.filter((n) => n.type === "heading").map((n) => n.attrs?.id);
    target.commands.insertContentAt(target.state.doc.content.size, heading(2, "Nieuw"));
    const after = (target.getJSON() as TipTapDocument).content.filter((n) => n.type === "heading").map((n) => n.attrs?.id);
    expect(after.slice(0, 3)).toEqual(before);
    expect(after).toHaveLength(4);
    expect(after[3]).toBeTruthy();
    expect(new Set(after).size).toBe(4);
  });

  it("does not put ids on non-heading nodes", async () => {
    const json = (await load()).getJSON() as TipTapDocument;
    for (const node of json.content.filter((n) => n.type !== "heading")) {
      expect(node.attrs?.id).toBeUndefined();
    }
  });

  it("exposes the non-empty headings through the extension storage", async () => {
    const target = await load({ type: "doc", content: [heading(1, "A"), { type: "heading", attrs: { level: 2 } }, heading(2, "B")] });
    const items = target.storage.tableOfContents.content.map((item: { textContent: string }) => item.textContent);
    expect(items).toEqual(["A", "B"]);
  });

  it("does not attach the extension's own window scroll listener", async () => {
    const added: string[] = [];
    const original = window.addEventListener.bind(window);
    window.addEventListener = ((type: string, ...rest: unknown[]) => {
      added.push(type);
      return (original as (...args: unknown[]) => void)(type, ...rest);
    }) as typeof window.addEventListener;
    try {
      await load();
    } finally {
      window.addEventListener = original;
    }
    expect(added).not.toContain("scroll");
  });
});

describe("pickActiveId", () => {
  const tops = [
    { id: "a", top: -400 },
    { id: "b", top: -20 },
    { id: "c", top: 300 },
  ];
  it("picks the last heading at or above the threshold", async () => {
    expect(pickActiveId(tops, 100)).toBe("b");
    expect(pickActiveId(tops, 300)).toBe("c");
  });
  it("falls back to the first heading before any has been reached", async () => {
    expect(pickActiveId([{ id: "a", top: 500 }], 100)).toBe("a");
  });
  it("picks the last heading at the bottom of the page and null for none", async () => {
    expect(pickActiveId(tops, 100, true)).toBe("c");
    expect(pickActiveId([], 100)).toBeNull();
  });
  it("shows the rail from three headings", async () => {
    expect(MIN_TOC_HEADINGS).toBe(3);
  });
});
