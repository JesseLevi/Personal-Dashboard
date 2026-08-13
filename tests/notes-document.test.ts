import { describe, expect, it } from "vitest";
import { deriveTitle, toPlainText, type TipTapDocument, type TipTapNode } from "../lib/notes/document";

// #228: pure-function tests for lib/notes/document.ts's deriveTitle/
// toPlainText, the "benoemd vitest-doel" the ticket calls out by name. Covers
// every edge case the ticket lists explicitly, plus a few structural cases
// (multi-paragraph, hardBreak, nested lists) to pin toPlainText's line-join
// behaviour that deriveTitle relies on.

function text(value: string): TipTapNode {
  return { type: "text", text: value };
}
function paragraph(...children: TipTapNode[]): TipTapNode {
  return { type: "paragraph", content: children };
}
function doc(...content: TipTapNode[]): TipTapDocument {
  return { type: "doc", content };
}

describe("toPlainText", () => {
  it("returns an empty string for an empty document", () => {
    expect(toPlainText(doc())).toBe("");
  });

  it("returns an empty string for a document with only an empty paragraph", () => {
    expect(toPlainText(doc(paragraph()))).toBe("");
  });

  it("flattens a single paragraph to its text", () => {
    expect(toPlainText(doc(paragraph(text("Boodschappen"))))).toBe("Boodschappen");
  });

  it("joins multiple paragraphs with one newline each", () => {
    const document = doc(paragraph(text("Eerste regel")), paragraph(text("Tweede regel")));
    expect(toPlainText(document)).toBe("Eerste regel\nTweede regel");
  });

  it("treats a hardBreak as a line break within a block", () => {
    const document = doc(paragraph(text("Regel een"), { type: "hardBreak" }, text("Regel twee")));
    expect(toPlainText(document)).toBe("Regel een\nRegel twee");
  });

  it("flattens a heading like any other line-ending block", () => {
    const document = doc({ type: "heading", content: [text("Titel")] }, paragraph(text("Body")));
    expect(toPlainText(document)).toBe("Titel\nBody");
  });

  it("flattens nested list items without duplicating blank lines", () => {
    const document = doc({
      type: "bulletList",
      content: [
        { type: "listItem", content: [paragraph(text("Melk"))] },
        { type: "listItem", content: [paragraph(text("Eieren"))] },
      ],
    });
    expect(toPlainText(document)).toBe("Melk\nEieren");
  });

  it("flattens a table's cells onto their own lines, not run together", () => {
    const document = doc({
      type: "table",
      content: [
        {
          type: "tableRow",
          content: [
            { type: "tableCell", content: [paragraph(text("Naam"))] },
            { type: "tableCell", content: [paragraph(text("Leeftijd"))] },
          ],
        },
      ],
    });
    expect(toPlainText(document)).toBe("Naam\nLeeftijd");
  });

  it("preserves a codeBlock's own internal newlines", () => {
    const document = doc({ type: "codeBlock", content: [text("const a = 1;\nconst b = 2;")] });
    expect(toPlainText(document)).toBe("const a = 1;\nconst b = 2;");
  });
});

describe("deriveTitle", () => {
  it("derives an empty title from an empty document", () => {
    expect(deriveTitle(doc())).toBe("");
  });

  it("derives an empty title from a document with only an empty paragraph", () => {
    expect(deriveTitle(doc(paragraph()))).toBe("");
  });

  it("derives the title from a document that starts with a heading", () => {
    const document = doc({ type: "heading", content: [text("Vergadernotities")] }, paragraph(text("Body")));
    expect(deriveTitle(document)).toBe("Vergadernotities");
  });

  it("derives the title from a document that starts with a table", () => {
    const document = doc({
      type: "table",
      content: [
        {
          type: "tableRow",
          content: [{ type: "tableCell", content: [paragraph(text("Boodschappenlijst"))] }],
        },
      ],
    });
    expect(deriveTitle(document)).toBe("Boodschappenlijst");
  });

  it("derives the title from a document that starts with a codeBlock, up to its first internal line", () => {
    const document = doc({ type: "codeBlock", content: [text("npm install\nnpm run build")] });
    expect(deriveTitle(document)).toBe("npm install");
  });

  it("truncates a first line longer than the card display cap, with an ellipsis", () => {
    const longLine = "a".repeat(250);
    const document = doc(paragraph(text(longLine)));
    const title = deriveTitle(document);
    expect(title.length).toBe(200);
    expect(title.endsWith("…")).toBe(true);
    expect(title.startsWith("a".repeat(199))).toBe(true);
  });

  it("does not truncate a first line at or under the cap", () => {
    const exactLine = "b".repeat(200);
    expect(deriveTitle(doc(paragraph(text(exactLine))))).toBe(exactLine);
  });
});
