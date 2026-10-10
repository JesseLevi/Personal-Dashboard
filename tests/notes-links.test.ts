import { describe, expect, it } from "vitest";
import {
  extractNoteLinkIds,
  NOTE_LINK_NODE_TYPE,
  type TipTapDocument,
  type TipTapNode,
} from "../lib/notes/document";

// #340 (ADR-0023): extractNoteLinkIds walks the document for noteLink nodes.

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

type LinkNode = TipTapNode & { attrs?: Record<string, unknown> };

function link(noteId: unknown): LinkNode {
  return { type: NOTE_LINK_NODE_TYPE, attrs: { noteId, label: "x" } };
}
function paragraph(...children: LinkNode[]): LinkNode {
  return { type: "paragraph", content: children };
}
function doc(...content: LinkNode[]): TipTapDocument {
  return { type: "doc", content };
}

describe("extractNoteLinkIds", () => {
  it("returns [] for an empty document", () => {
    expect(extractNoteLinkIds(doc())).toEqual([]);
  });

  it("returns [] when there are no link nodes", () => {
    expect(extractNoteLinkIds(doc(paragraph({ type: "text", text: "hi" })))).toEqual([]);
  });

  it("collects ids in document order", () => {
    expect(extractNoteLinkIds(doc(paragraph(link(B)), paragraph(link(A))))).toEqual([B, A]);
  });

  it("de-duplicates repeated links to the same note", () => {
    expect(extractNoteLinkIds(doc(paragraph(link(A), link(A)), paragraph(link(A))))).toEqual([A]);
  });

  it("finds links nested in lists and tables", () => {
    const nested: LinkNode = {
      type: "bulletList",
      content: [{ type: "listItem", content: [paragraph(link(A))] }],
    };
    expect(extractNoteLinkIds(doc(nested))).toEqual([A]);
  });

  it("skips nodes with a missing or non-uuid noteId", () => {
    expect(
      extractNoteLinkIds(doc(paragraph(link(undefined), link("nope"), link(42), link(null), link(B)))),
    ).toEqual([B]);
  });

  it("normalises ids to lower case", () => {
    expect(extractNoteLinkIds(doc(paragraph(link(A.toUpperCase()))))).toEqual([A]);
  });
});
