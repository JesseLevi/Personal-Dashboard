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

  it("emits the four-state Button token tier (ticket #68: Outline's Hover/Active/Selected re-authored)", () => {
    const css = generateTheme(tokens);
    // Light values, resolved from the re-fetched node 3623:4346.
    expect(css).toContain("--color-surface-hover: var(--color-stone-50);");
    expect(css).toContain("--color-surface-active: var(--color-stone-100);");
    expect(css).toContain("--color-surface-raised-hover: var(--color-stone-300);");
    expect(css).toContain("--color-surface-raised-active: var(--color-stone-400);");
    // Outline: Hover stone-400 -> stone-500, Active stone-700 -> stone-800
    // (ticket #68 — re-fetched, the user re-authored these borders).
    expect(css).toContain("--color-border-hover: var(--color-stone-500);");
    expect(css).toContain("--color-border-active: var(--color-stone-800);");
    expect(css).toContain("--color-priority-urgent-bg-hover: var(--color-red-100);");
    expect(css).toContain("--color-priority-urgent-bg-active: var(--color-red-200);");
  });

  it("drops surface/priority *-selected colour tokens: those styles' Selected reuses the default background and only darkens the text", () => {
    const css = generateTheme(tokens);
    for (const dead of [
      "--color-surface-selected:",
      "--color-surface-raised-selected:",
      "--color-priority-urgent-bg-selected:",
    ]) {
      expect(css).not.toContain(dead);
    }
  });

  it("re-adds border-selected (ticket #68): Outline's Selected gained a real border for the first time since #56", () => {
    const css = generateTheme(tokens);
    // stone-400 — confirmed by re-fetching 3623:4346; shared with Atom/Input-field's
    // existing Selected value (see the border-sharing test below). This is a fresh,
    // independently-fetched fact, not a resurrection of #56's dead `border-selected`
    // (which had no consumer since Selected was text-only everywhere at the time).
    expect(css).toContain("--color-border-selected: var(--color-stone-400);");
  });

  it("shares border-hover/border-selected between Atom/Button/Outline and Atom/Input-field, keeps border-input-active as the one remaining divergence (ticket #68)", () => {
    const css = generateTheme(tokens);
    // Re-fetching both nodes side by side for #68 confirmed Hover and Selected
    // now land on identical pixels (stone-500 / stone-400) — border-input-hover
    // and border-input-selected are deleted, Input-field reads the shared tokens
    // directly. Active is still a real, confirmed divergence (stone-600 vs
    // Button's stone-800), so border-input-active is kept under its own name.
    const light = css.slice(0, css.indexOf('[data-theme="dark"]'));
    expect(light).toContain("--color-border-input-active: var(--color-stone-600);");
    expect(light).not.toContain("--color-border-input-hover:");
    expect(light).not.toContain("--color-border-input-selected:");
    // Not collapsed onto Button/Outline's Active (stone-800) — deliberately kept apart.
    expect(light).not.toContain("--color-border-input-active: var(--color-stone-800);");
  });

  it("emits the motion token layer (ticket #86): duration-base/ease-base, no Figma source, no dark split", () => {
    const css = generateTheme(tokens);
    const light = css.slice(0, css.indexOf('[data-theme="dark"]'));
    expect(light).toContain("--duration-base: 200ms;");
    expect(light).toContain("--ease-base: cubic-bezier(0, 0, 0.2, 1);");
    // Motion has no light/dark split (see semantic.duration/$comment) — it
    // must never leak into the dark override block.
    const darkBlock = css.slice(css.indexOf('[data-theme="dark"]'));
    expect(darkBlock).not.toContain("--duration-base");
    expect(darkBlock).not.toContain("--ease-base");
  });

  it("Sidebar consumes the duration token via the arbitrary-value form, not a bare `duration-base` (ticket #86)", () => {
    // `--ease-*` IS a Tailwind v4 theme namespace, so `ease-base` is a real
    // generated utility. `--duration-*` is NOT one: a bare `duration-base`
    // compiles to no rule at all and silently falls back to
    // `--default-transition-duration` (150ms), so the 200ms token would have
    // had no effect at all while still looking correct in the source. The
    // only thing that catches that is asserting the consuming class here —
    // a static visual baseline can't see it, because both forms are
    // pixel-identical at rest and only differ mid-transition.
    const src = readFileSync("components/organisms/Sidebar.tsx", "utf8");
    expect(src).toContain("duration-[var(--duration-base)]");
    expect(src).not.toMatch(/["'\s]duration-base[\s"']/);
  });

  it("skips the semantic.duration/semantic.easing $comment doc field — it is documentation, not a token", () => {
    const css = generateTheme(tokens);
    expect(css).not.toContain("--$comment");
  });

  it("every semantic duration/easing ref resolves (closed scale, same discipline as colour)", () => {
    for (const [name, ref] of Object.entries<unknown>(tokens.semantic.duration)) {
      if (name.startsWith("$")) continue;
      expect(() => resolveRef(tokens, ref as string)).not.toThrow();
    }
    for (const [name, ref] of Object.entries<unknown>(tokens.semantic.easing)) {
      if (name.startsWith("$")) continue;
      expect(() => resolveRef(tokens, ref as string)).not.toThrow();
    }
  });
});
