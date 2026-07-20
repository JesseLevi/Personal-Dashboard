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

  it("emits the four-state Button token tier (ticket #56: Default/Hover/Active, Selected is text-only)", () => {
    const css = generateTheme(tokens);
    // Light values, resolved from the re-fetched node 3623:4346.
    expect(css).toContain("--color-surface-hover: var(--color-stone-50);");
    expect(css).toContain("--color-surface-active: var(--color-stone-100);");
    expect(css).toContain("--color-surface-raised-hover: var(--color-stone-300);");
    expect(css).toContain("--color-surface-raised-active: var(--color-stone-400);");
    expect(css).toContain("--color-border-hover: var(--color-stone-400);");
    expect(css).toContain("--color-border-active: var(--color-stone-700);");
    expect(css).toContain("--color-priority-urgent-bg-hover: var(--color-red-100);");
    expect(css).toContain("--color-priority-urgent-bg-active: var(--color-red-200);");
  });

  it("drops the *-selected colour tokens: Selected reuses the default background and only darkens the text", () => {
    const css = generateTheme(tokens);
    for (const dead of [
      "--color-surface-selected:",
      "--color-surface-raised-selected:",
      "--color-border-selected:",
      "--color-priority-urgent-bg-selected:",
    ]) {
      expect(css).not.toContain(dead);
    }
  });

  it("keeps Atom/Input-field's own border-hover/border-active tokens distinct from Atom/Button's shared scale (ticket #58)", () => {
    const css = generateTheme(tokens);
    // Re-fetching Input-field's node for #58 confirmed it still does NOT
    // share Button/Outline's Hover (stone-400) / Active (stone-700) pixels —
    // it has its own stone-500 / stone-600 pair. That's a deliberate,
    // confirmed divergence now (the #56-era ordering bug is fixed: Hover is
    // correctly lighter than Active), not a stale/unbound node, so these
    // tokens are not provisional and are not expected to collapse onto
    // Button's scale. See docs/design-tokens.md and design/figma-map.json.
    const light = css.slice(0, css.indexOf('[data-theme="dark"]'));
    expect(light).toContain("--color-border-input-hover: var(--color-stone-500);");
    expect(light).toContain("--color-border-input-active: var(--color-stone-600);");
    // Not collapsed onto Button's Outline hover/active (stone-400/stone-700).
    expect(light).not.toContain("--color-border-input-hover: var(--color-stone-400);");
    expect(light).not.toContain("--color-border-input-active: var(--color-stone-700);");
  });
});
