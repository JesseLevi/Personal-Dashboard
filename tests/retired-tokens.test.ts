import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildPattern, findHits } from "../scripts/check-retired-tokens.mjs";

const { retired } = JSON.parse(readFileSync("design/retired-tokens.json", "utf8"));
const hits = (s: string) => findHits(s, buildPattern(retired)).map((h: { match: string }) => h.match);

describe("retired-token gate (#285)", () => {
  it("flags retired colour usage in utility and CSS-var form", () => {
    expect(hits("className='hover:bg-surface text-text-muted'")).toEqual(["bg-surface", "text-text-muted"]);
    expect(hits("background: var(--color-surface);")).toEqual(["--color-surface"]);
    expect(hits("border-border-hover/50")).toEqual(["border-border-hover"]);
  });

  it("does not flag live names or non-colour utilities", () => {
    expect(hits("bg-surface-secondary text-text-primary border-stroke-primary")).toEqual([]);
    expect(hits("var(--color-surface-highlight-white) border border-2 border-t text-sm")).toEqual([]);
    expect(hits("context-text prefix-bg-surface")).toEqual([]);
  });
});
