import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { generateTheme, resolveRef } from "../scripts/tokens-lib.mjs";

const tokens = JSON.parse(readFileSync("design/tokens.json", "utf8"));

describe("token → theme pipeline (ADR-0010)", () => {
  it("resolves primitive references", () => {
    expect(resolveRef(tokens, "{primitive.color.red-400}").value).toBe("#FF6467");
  });

  it("throws on dangling references instead of silently emitting garbage", () => {
    expect(() => resolveRef(tokens, "{primitive.color.nope}")).toThrow(/Unresolvable/);
  });

  it("emits stock-palette semantics as Tailwind var references", () => {
    const css = generateTheme(tokens);
    expect(css).toContain("--color-priority-urgent: var(--color-red-400);");
    expect(css).toContain("--color-text-muted: var(--color-stone-500);");
  });

  it("emits custom primitives literally", () => {
    const css = generateTheme(tokens);
    expect(css).toContain("--color-purple-figma: #8A38F5;");
    expect(css).toContain("--color-accent: #8A38F5;");
  });

  it("every semantic token resolves (closed scale)", () => {
    for (const ref of Object.values<string>(tokens.semantic.color)) {
      expect(() => resolveRef(tokens, ref)).not.toThrow();
    }
  });
});
