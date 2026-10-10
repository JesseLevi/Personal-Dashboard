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
    expect(toPlainText(document)).toBe("Naam\tLeeftijd");
  });

  it("preserves a codeBlock's own internal newlines", () => {
    const document = doc({ type: "codeBlock", content: [text("const a = 1;\nconst b = 2;")] });
    expect(toPlainText(document)).toBe("const a = 1;\nconst b = 2;");
  });

  // #235: the two toPlainText table cases the ticket names that weren't
  // already covered above -- a header row (tableHeader, not just tableCell)
  // and empty cells (no blank/doubled lines from a cell with no content).
  it("flattens a table's header row like any other row of cells", () => {
    const document = doc({
      type: "table",
      content: [
        {
          type: "tableRow",
          content: [
            { type: "tableHeader", content: [paragraph(text("Naam"))] },
            { type: "tableHeader", content: [paragraph(text("Leeftijd"))] },
          ],
        },
        {
          type: "tableRow",
          content: [
            { type: "tableCell", content: [paragraph(text("Anna"))] },
            { type: "tableCell", content: [paragraph(text("34"))] },
          ],
        },
      ],
    });
    expect(toPlainText(document)).toBe("Naam\tLeeftijd\nAnna\t34");
  });

  it("drops empty table cells without leaving blank or doubled newlines", () => {
    const document = doc({
      type: "table",
      content: [
        {
          type: "tableRow",
          content: [
            { type: "tableCell", content: [paragraph(text("Naam"))] },
            { type: "tableCell", content: [paragraph()] },
          ],
        },
        {
          type: "tableRow",
          content: [
            { type: "tableCell", content: [paragraph()] },
            { type: "tableCell", content: [paragraph(text("34"))] },
          ],
        },
      ],
    });
    expect(toPlainText(document)).toBe("Naam\n\t34");
  });

  it("puts a cell's own paragraphs on one line and drops rows with no text", () => {
    const document = doc({
      type: "table",
      content: [
        {
          type: "tableRow",
          content: [
            { type: "tableCell", content: [paragraph(text("Eerste")), paragraph(text("Tweede"))] },
            { type: "tableCell", content: [paragraph(text("Derde"))] },
          ],
        },
        {
          type: "tableRow",
          content: [
            { type: "tableCell", content: [paragraph()] },
            { type: "tableCell", content: [paragraph()] },
          ],
        },
      ],
    });
    expect(toPlainText(document)).toBe("Eerste Tweede\tDerde");
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

  it("collapses the tab between cells of a first table row into a space", () => {
    const row = {
      type: "tableRow",
      content: [
        { type: "tableCell", content: [paragraph(text("Product"))] },
        { type: "tableCell", content: [paragraph(text("Aantal"))] },
      ],
    };
    expect(deriveTitle(doc({ type: "table", content: [row] }))).toBe("Product Aantal");
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

describe("task lists (#329)", () => {
  const task = (label: string, ...nested: TipTapNode[]): TipTapNode => ({
    type: "taskItem",
    content: [paragraph(text(label)), ...nested],
  });
  const taskList = (...items: TipTapNode[]): TipTapNode => ({ type: "taskList", content: items });

  it("reads each task item as one line, without a checkbox prefix", () => {
    const document = doc(taskList(task("Melk kopen"), task("Brood kopen")));
    expect(toPlainText(document)).toBe("Melk kopen\nBrood kopen");
  });

  it("flattens nested task lists one line per item", () => {
    const document = doc(taskList(task("Boodschappen", taskList(task("Melk"), task("Kaas")))));
    expect(toPlainText(document)).toBe("Boodschappen\nMelk\nKaas");
  });

  it("derives the title from a leading task item, so search finds checklist text", () => {
    const document = doc(taskList(task("Melk kopen")));
    expect(deriveTitle(document)).toBe("Melk kopen");
    expect(toPlainText(document)).toContain("kopen");
  });
});

// #336: code blocks and collapsible sections.
describe("code blocks and collapsible sections (#336)", () => {
  const summary = (label: string): TipTapNode => ({ type: "detailsSummary", content: label ? [text(label)] : [] });
  const content = (...blocks: TipTapNode[]): TipTapNode => ({ type: "detailsContent", content: blocks });
  const details = (...children: TipTapNode[]): TipTapNode => ({ type: "details", content: children });

  it("includes a code block's raw text, line by line", () => {
    const document = doc(paragraph(text("Intro")), { type: "codeBlock", content: [text("npm i\nnpm test")] });
    expect(toPlainText(document)).toBe("Intro\nnpm i\nnpm test");
  });

  it("includes a details summary and its content", () => {
    const document = doc(details(summary("Meer info"), content(paragraph(text("Verborgen tekst")), paragraph(text("Tweede")))));
    expect(toPlainText(document)).toBe("Meer info\nVerborgen tekst\nTweede");
  });

  it("includes the text of a collapsed section (open: false) and of an open one", () => {
    for (const open of [false, true]) {
      const document = doc({ type: "details", content: [summary("Titel"), content(paragraph(text("Zoekbaar")))], ...{ attrs: { open } } } as TipTapNode);
      expect(toPlainText(document)).toContain("Zoekbaar");
    }
  });

  it("includes a code block nested in a details content", () => {
    const document = doc(details(summary("Snippet"), content({ type: "codeBlock", content: [text("const a = 1;")] })));
    expect(toPlainText(document)).toBe("Snippet\nconst a = 1;");
  });

  it("derives the title from a leading details summary", () => {
    const document = doc(details(summary("Uitklapper"), content(paragraph(text("Inhoud")))));
    expect(deriveTitle(document)).toBe("Uitklapper");
  });

  it("an empty summary adds no stray blank line", () => {
    const document = doc(details(summary(""), content(paragraph(text("Inhoud")))));
    expect(toPlainText(document)).toBe("Inhoud");
  });
});
