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

  it("every semantic token resolves (closed scale), light and dark refs alike", () => {
    for (const def of Object.values<unknown>(tokens.semantic.color)) {
      if (typeof def === "string") {
        expect(() => resolveRef(tokens, def)).not.toThrow();
        continue;
      }
      const { light, dark } = def as { light: string; dark?: string };
      expect(() => resolveRef(tokens, light)).not.toThrow();
      if (dark) expect(() => resolveRef(tokens, dark)).not.toThrow();
    }
  });

  it("emits a [data-theme=dark] override block for tokens with a dark value", () => {
    const css = generateTheme(tokens);
    expect(css).toContain('[data-theme="dark"] {');
    // surface-raised is used by Atom/Button (Filled style) and has a dark override.
    expect(css).toContain("--color-surface-raised: var(--color-stone-800);");
  });

  it("places the dark override block outside (after) the @theme block, unlayered — it must win over @layer theme's :root vars per the CSS Cascade Layers spec, independent of specificity/order", () => {
    const css = generateTheme(tokens);
    const themeCloseIndex = css.indexOf("}");
    const darkBlockIndex = css.indexOf('[data-theme="dark"]');
    expect(darkBlockIndex).toBeGreaterThan(themeCloseIndex);
    expect(css.slice(0, darkBlockIndex)).not.toContain("@layer");
  });

  it("omits tokens without a dark override from the dark block", () => {
    const css = generateTheme(tokens);
    const darkBlock = css.slice(css.indexOf('[data-theme="dark"]'));
    // surface-muted is light-only (plain string ref, no dark variant defined yet).
    expect(darkBlock).not.toContain("--color-surface-muted:");
  });

  it("emits the per-state Button token tier added for ticket #52 (Default/Hover/Selected)", () => {
    const css = generateTheme(tokens);
    // Light values, resolved from the re-fetched node 3623:4346.
    expect(css).toContain("--color-surface-selected: var(--color-stone-50);");
    expect(css).toContain("--color-surface-raised-hover: var(--color-stone-400);");
    expect(css).toContain("--color-surface-raised-selected: var(--color-stone-300);");
    expect(css).toContain("--color-border-hover-strong: var(--color-stone-700);");
    expect(css).toContain("--color-border-selected: var(--color-stone-400);");
    expect(css).toContain("--color-priority-urgent-bg-hover: var(--color-red-200);");
    expect(css).toContain("--color-priority-urgent-bg-selected: var(--color-red-100);");
  });

  it("keeps border-hover at stone-500 for Atom/Input-field even though Atom/Button's Outline hover diverged to stone-700 (border-hover-strong)", () => {
    const css = generateTheme(tokens);
    expect(css).toContain("--color-border-hover: var(--color-stone-500);");
  });

  it("retains surface-hover in the theme even though ticket #52 removed its only consumer (Atom/Button moved to surface-raised-hover)", () => {
    const css = generateTheme(tokens);
    expect(css).toContain("--color-surface-hover: var(--color-stone-300);");
  });
});
