import { describe, expect, it } from "vitest";
import { tiptapDocumentSchema } from "../lib/notes/schemas";

const GOOD = "/api/note-image/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222";
const image = (src: unknown) => ({ type: "image", attrs: { src, alt: null } });
const paragraph = { type: "paragraph", content: [{ type: "text", text: "hi" }] };

describe("tiptapDocumentSchema image src", () => {
  it("keeps an image with the note-image route and all its attrs", () => {
    const doc = { type: "doc", content: [paragraph, image(GOOD)] };
    expect(tiptapDocumentSchema.parse(doc)).toEqual(doc);
  });

  it.each([
    "https://example.com/a.png",
    "javascript:alert(1)",
    "data:image/png;base64,AAAA",
    "/api/note-image/x/y",
    undefined,
    42,
  ])("strips an image with src %j", (src) => {
    const parsed = tiptapDocumentSchema.parse({ type: "doc", content: [image(src), paragraph] });
    expect(parsed.content).toEqual([paragraph]);
  });

  it("strips invalid images nested inside other nodes and keeps the rest", () => {
    const parsed = tiptapDocumentSchema.parse({
      type: "doc",
      content: [{ type: "blockquote", content: [image("https://evil.test/x.png"), image(GOOD)] }],
    });
    expect(parsed.content).toEqual([{ type: "blockquote", content: [image(GOOD)] }]);
  });
});
