import { describe, expect, it } from "vitest";
import { cardText, eventText, noteText, recipeText, shoppingItemText } from "@/lib/embeddings/canonical";
import {
  MAX_SOURCE_CHARS,
  OVERLAP_CHARS,
  TARGET_CHARS,
  chunkSource,
  chunkText,
  contentHash,
} from "@/lib/embeddings/chunk";

const MAX_TEXT_CHARS = 20_000;

describe("canonical text", () => {
  it("joins a note's title and plain text, and skips empty parts", () => {
    expect(noteText({ title: " Plan ", content_text: "Eerste regel" })).toBe("Plan\n\nEerste regel");
    expect(noteText({ title: "", content_text: "   " })).toBe("");
  });

  it("orders recipe ingredients and steps by position", () => {
    expect(
      recipeText({
        title: "Pasta",
        ingredients: [
          { name: "tomaat", position: 2 },
          { name: "pasta", position: 1 },
        ],
        steps: [
          { instruction: "Kook", position: 1 },
          { instruction: "Eet", position: 2 },
        ],
      }),
    ).toBe("Pasta\n\npasta\ntomaat\n\nKook\nEet");
  });

  it("puts sorted label names after the card's description", () => {
    expect(cardText({ title: "Bel", description: null, labels: ["b", "a"] })).toBe("Bel\n\na, b");
  });

  it("leaves dates out of an event, so repeats hash alike", () => {
    const row = { title: "Zwemmen", location: "Bad", description: null };
    expect(eventText(row)).toBe("Zwemmen\n\nBad");
    expect(contentHash("m", eventText(row))).toBe(contentHash("m", eventText({ ...row })));
  });

  it("uses only the name of a basket item", () => {
    expect(shoppingItemText({ name: " pindakaas " })).toBe("pindakaas");
  });
});

describe("chunkText", () => {
  it("gives nothing for empty or blank text", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText(" \n\n ")).toEqual([]);
  });

  it("keeps a short text in one chunk", () => {
    expect(chunkText("Titel\n\nEen alinea.\n\nNog een.")).toEqual(["Titel\n\nEen alinea.\n\nNog een."]);
  });

  it("splits one long paragraph under the target, with overlap", () => {
    const words = Array.from({ length: 900 }, (_, i) => `woord${i}`).join(" ");
    const chunks = chunkText(words);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(TARGET_CHARS);
    const lastWordOfFirst = chunks[0]!.split(" ").at(-1)!;
    expect(chunks[1]!.includes(lastWordOfFirst)).toBe(true);
  });

  it("splits a long text at headings", () => {
    const body = "x".repeat(700);
    const chunks = chunkText(`# Een\n\n${body}\n\n## Twee\n\n${body}`);
    expect(chunks).toHaveLength(2);
    expect(chunks[1]!.startsWith("## Twee")).toBe(true);
  });

  it("does not split a short text at a heading", () => {
    expect(chunkText("# Een\n\nkort\n\n## Twee\n\nkort")).toHaveLength(1);
  });

  it("caps a source and keeps every chunk under the provider limit", () => {
    const chunks = chunkText("a".repeat(MAX_SOURCE_CHARS * 3));
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.length).toBeLessThanOrEqual(Math.ceil(MAX_SOURCE_CHARS / (TARGET_CHARS - OVERLAP_CHARS)) + 1);
    for (const chunk of chunks) expect(chunk.length).toBeLessThan(MAX_TEXT_CHARS);
  });
});

describe("content hash", () => {
  it("is stable, and differs per model and per text", () => {
    expect(contentHash("m", "tekst")).toBe(contentHash("m", "tekst"));
    expect(contentHash("m", "tekst")).toMatch(/^[0-9a-f]{64}$/);
    expect(contentHash("n", "tekst")).not.toBe(contentHash("m", "tekst"));
    expect(contentHash("m", "anders")).not.toBe(contentHash("m", "tekst"));
  });

  it("numbers chunks from zero and hashes each", () => {
    const chunks = chunkSource("# Een\n\n" + "x".repeat(700) + "\n\n## Twee\n\n" + "y".repeat(700), "m");
    expect(chunks.map((c) => c.index)).toEqual([0, 1]);
    expect(chunks[0]!.hash).toBe(contentHash("m", chunks[0]!.text));
  });
});
