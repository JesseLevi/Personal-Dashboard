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
    expect(css).toContain("--color-text-highlight-red: var(--color-red-400);");
    expect(css).toContain("--color-text-secondary: var(--color-stone-500);");
  });

  it("emits a custom (non-Tailwind-stock) primitive literally", () => {
    const css = generateTheme(tokens);
    // white is the one custom-ish primitive still in play (special-cased in
    // cssValueForRef to a literal hex rather than a var reference).
    expect(css).toContain("--color-surface-highlight-white: #FFFFFF;");
  });

  it("every semantic token resolves (closed scale), light and dark refs alike", () => {
    for (const def of Object.values<{ light: string; dark?: string }>(tokens.semantic.color)) {
      expect(() => resolveRef(tokens, def.light)).not.toThrow();
      if (def.dark) expect(() => resolveRef(tokens, def.dark)).not.toThrow();
    }
  });

  it("emits a [data-theme=dark] override block for tokens with a dark value", () => {
    const css = generateTheme(tokens);
    expect(css).toContain('[data-theme="dark"] {');
    // surface-secondary (formerly surface-raised) backs Atom/Button (Filled) and has a dark override.
    expect(css).toContain("--color-surface-secondary: var(--color-stone-800);");
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
    // text-placeholder is light-only (no dark variant defined). surface-primary
    // USED to be the example here pre-#204 — it now has a real Figma dark value
    // (fixing the <body> dark-background bug), so it moved to the "renames"
    // test's dark-value coverage instead.
    expect(darkBlock).not.toContain("--color-text-placeholder:");
  });

  it("emits the four-state Button token tier (ticket #68: Outline's Hover/Active/Selected re-authored)", () => {
    const css = generateTheme(tokens);
    // Light values, resolved from the re-fetched node 3623:4346.
    expect(css).toContain("--color-surface-highlight-white-selected: var(--color-stone-100);");
    expect(css).toContain("--color-surface-secondary-hover: var(--color-stone-300);");
    expect(css).toContain("--color-surface-secondary-active: var(--color-stone-400);");
    // Outline: Hover stone-400 -> stone-500, Active stone-700 -> stone-800
    // (ticket #68 — re-fetched, the user re-authored these borders).
    expect(css).toContain("--color-stroke-primary-hover: var(--color-stone-500);");
    expect(css).toContain("--color-stroke-secondary-active: var(--color-stone-800);");
    expect(css).toContain("--color-priority-urgent-bg-hover: var(--color-surface-highlight-red-hover);");
    expect(css).toContain("--color-priority-urgent-bg-active: var(--color-surface-highlight-red-active);");
  });

  it("emits real Selected fill tokens for White/Distructive (ticket #204 — supersedes #56's premise that Selected never carries a background)", () => {
    const css = generateTheme(tokens);
    // #56 (2026-07-20) found Selected touched no background anywhere and
    // removed the *-selected fill tokens it had introduced. #204 (2026-08-11)
    // found that reading came from a state-binding bug (White/Distructive's
    // Hover/Active nodes were shifted one column onto the wrong Figma
    // variable) — Figma's real per-node bindings prove Selected DOES carry a
    // fill on these two styles. These tokens are the fix, not a regression.
    expect(css).toContain("--color-surface-highlight-white-active: var(--color-stone-300);");
    expect(css).toContain("--color-surface-highlight-white-hover: var(--color-stone-200);");
    expect(css).toContain("--color-priority-urgent-bg-selected: var(--color-surface-highlight-red-selected);");
    // Filled's Selected genuinely still has no fill token (Figma defines none
    // for this style) — the one part of #56's premise that #204 reconfirmed.
    expect(css).not.toContain("--color-surface-secondary-selected:");
  });

  it("re-adds stroke-primary-selected (ticket #68): Outline's Selected gained a real border for the first time since #56", () => {
    const css = generateTheme(tokens);
    // stone-400 — confirmed by re-fetching 3623:4346; shared with Atom/Input-field's
    // existing Selected value (see the border-sharing test below). This is a fresh,
    // independently-fetched fact, not a resurrection of #56's dead `border-selected`
    // (which had no consumer since Selected was text-only everywhere at the time).
    expect(css).toContain("--color-stroke-primary-selected: var(--color-stone-400);");
  });

  it("shares stroke-primary-hover/stroke-primary-selected between Atom/Button/Outline and Atom/Input-field, keeps stroke-primary-active as the one remaining divergence (ticket #68)", () => {
    const css = generateTheme(tokens);
    // Re-fetching both nodes side by side for #68 confirmed Hover and Selected
    // now land on identical pixels (stone-500 / stone-400) — border-input-hover
    // and border-input-selected are deleted, Input-field reads the shared tokens
    // directly. Active is still a real, confirmed divergence (stone-600 vs
    // Button's stone-800), so stroke-primary-active (formerly border-input-active)
    // is kept under its own name.
    const light = css.slice(0, css.indexOf('[data-theme="dark"]'));
    expect(light).toContain("--color-stroke-primary-active: var(--color-stone-600);");
    expect(light).not.toContain("--color-stroke-input-hover:");
    expect(light).not.toContain("--color-stroke-input-selected:");
    // Not collapsed onto Button/Outline's Active (stone-800) — deliberately kept apart.
    expect(light).not.toContain("--color-stroke-primary-active: var(--color-stone-800);");
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

  // ---- ticket #203: canonical Figma-variable names + traceability + alias tier ----

  describe("#203: Figma-variable renaming, traceability, and the product-alias tier", () => {
    it("every semantic color token carries a figma path and a figmaVariableId (or an explicit null + reason)", () => {
      for (const [name, def] of Object.entries<{
        figma: string | null;
        figmaVariableId: string | null;
        $comment?: string;
      }>(tokens.semantic.color)) {
        expect(def, `${name} is missing 'figma'`).toHaveProperty("figma");
        expect(def, `${name} is missing 'figmaVariableId'`).toHaveProperty("figmaVariableId");
        if (def.figma === null) {
          // #203's one documented exception was surface-hover; #204 retired it
          // (see the test below), so as of #204 no token should hit this branch
          // at all — kept as a guard in case a future token needs the escape hatch.
          expect(def.figmaVariableId).toBeNull();
          expect(def.$comment, `${name} has figma:null but no reason recorded`).toBeTruthy();
        }
      }
    });

    it("surface-hover is retired (#204): no longer a token, no CSS var", () => {
      expect(tokens.semantic.color).not.toHaveProperty("surface-hover");
      const css = generateTheme(tokens);
      expect(css).not.toContain("--color-surface-hover:");
    });

    it("the figma:null exceptions are `overlay` (#222, a codebase-only scrim) and the 27 agenda palette tokens (#530, ADR-0040 §7)", () => {
      const nullFigma = Object.entries<{ figma: string | null }>(tokens.semantic.color).filter(
        ([, def]) => def.figma === null,
      );
      const names = nullFigma.map(([name]) => name);
      expect(names.filter((name) => !name.startsWith("event-"))).toEqual(["overlay"]);
      expect(names.filter((name) => name.startsWith("event-"))).toHaveLength(27);
    });

    it("accent is retired: no primitive, no semantic entry, no CSS var", () => {
      expect(tokens.semantic.color).not.toHaveProperty("accent");
      expect(tokens.primitive.color).not.toHaveProperty("purple-figma");
      const css = generateTheme(tokens);
      expect(css).not.toContain("--color-accent:");
      expect(css).not.toContain("--color-purple-figma:");
    });

    it("renames every core semantic token onto its Figma variable path (name changes, value does not)", () => {
      const renamed: Record<string, { figma: string; value: string }> = {
        "surface-highlight-white": { figma: "color/surface/highlight/white/default", value: "#FFFFFF" },
        "surface-highlight-white-selected": { figma: "color/surface/highlight/white/selected", value: "#F5F5F4" },
        "surface-primary": { figma: "color/surface/primary/default", value: "#F5F5F4" },
        "surface-secondary": { figma: "color/surface/secondary/default", value: "#E7E5E4" },
        "stroke-primary": { figma: "color/Stroke/primary/default", value: "#D6D3D1" },
        "stroke-lines": { figma: "color/Stroke/lines", value: "#E7E5E4" },
        "stroke-primary-active": { figma: "color/Stroke/primary/active", value: "#57534D" },
        "text-primary": { figma: "color/text/base/primary", value: "#0C0A09" },
        "text-secondary": { figma: "color/text/base/secondary", value: "#79716B" },
        "text-placeholder": { figma: "color/text/base/placeholder", value: "#D6D3D1" },
      };
      for (const [name, expected] of Object.entries(renamed)) {
        const def = tokens.semantic.color[name];
        expect(def, `missing renamed token ${name}`).toBeTruthy();
        expect(def.figma).toBe(expected.figma);
        expect(resolveRef(tokens, def.light).value).toBe(expected.value);
      }
    });

    it("the eight product aliases keep their existing class name but now point at a semantic token, not a primitive", () => {
      const aliases = [
        ["priority-urgent", "text-highlight-red"],
        ["priority-urgent-bg", "surface-highlight-red"],
        ["priority-urgent-bg-hover", "surface-highlight-red-hover"],
        ["priority-urgent-bg-active", "surface-highlight-red-active"],
        ["priority-medium", "text-highlight-blue"],
        ["priority-medium-bg", "surface-highlight-blue"],
        ["priority-low", "text-highlight-green"],
        ["priority-low-bg", "surface-highlight-green"],
        ["tag-highlight", "text-highlight-yellow"],
        ["tag-highlight-bg", "surface-highlight-yellow"],
      ] as const;
      for (const [aliasName, target] of aliases) {
        const def = tokens.semantic.color[aliasName];
        expect(def.light).toBe(`{semantic.color.${target}}`);
      }
    });

    it("emits a single var()-reference line for each alias — no separate dark declaration, since it cascades through the target's own dark override", () => {
      const css = generateTheme(tokens);
      const light = css.slice(0, css.indexOf('[data-theme="dark"]'));
      const dark = css.slice(css.indexOf('[data-theme="dark"]'));
      expect(light).toContain("--color-priority-urgent: var(--color-text-highlight-red);");
      expect(light).toContain("--color-priority-urgent-bg: var(--color-surface-highlight-red);");
      expect(light).toContain("--color-tag-highlight-bg: var(--color-surface-highlight-yellow);");
      // The alias itself never gets its own dark-block line...
      expect(dark).not.toContain("--color-priority-urgent:");
      expect(dark).not.toContain("--color-priority-urgent-bg:");
      // ...but its target does, so the alias still changes colour in dark mode
      // via the cascade, not via a duplicated declaration.
      expect(dark).toContain("--color-surface-highlight-red:");
    });

    it("$pendingFigmaValue: #204's batch is fully resolved; only user-directed dark deviations remain (#222 stroke-primary, the alert-palette highlights)", () => {
      const stillPending = Object.entries(tokens.semantic.color).filter(
        ([, def]) => (def as { $pendingFigmaValue?: unknown }).$pendingFigmaValue,
      );
      expect(stillPending.map(([name]) => name).sort()).toEqual(
        [
          "stroke-primary",
          "text-highlight-red",
          "surface-highlight-red",
          "surface-highlight-red-selected",
          "surface-highlight-red-hover",
          "surface-highlight-red-active",
          "text-highlight-blue",
          "surface-highlight-blue",
          "text-highlight-green",
          "surface-highlight-green",
          "text-highlight-yellow",
          "surface-highlight-yellow",
        ].sort(),
      );
      // Every deviation is dark-only; light still matches Figma.
      for (const [, def] of stillPending) {
        expect(Object.keys((def as { $pendingFigmaValue: object }).$pendingFigmaValue)).toEqual(["dark"]);
      }
    });
  });

  // ---- ticket #204: state-binding fix (White/Distructive) + dark values ----

  describe("#204: Figma value + state-binding resolution", () => {
    it("White/Distructive Hover/Active/Selected read their own dedicated, correctly-bound tokens", () => {
      const css = generateTheme(tokens);
      const light = css.slice(0, css.indexOf('[data-theme="dark"]'));
      expect(light).toContain("--color-surface-highlight-white-hover: var(--color-stone-200);");
      expect(light).toContain("--color-surface-highlight-white-active: var(--color-stone-300);");
      expect(light).toContain("--color-surface-highlight-white-selected: var(--color-stone-100);");
      expect(light).toContain("--color-surface-highlight-red-selected: var(--color-red-100);");
      expect(light).toContain("--color-surface-highlight-red-hover: var(--color-red-200);");
      expect(light).toContain("--color-surface-highlight-red-active: var(--color-red-300);");
    });

    it("highlight colours follow the agenda alert palette in dark mode (surface 950, text 200; red ramp steps up)", () => {
      const css = generateTheme(tokens);
      const dark = css.slice(css.indexOf('[data-theme="dark"]'));
      for (const [name, value] of [
        ["surface-highlight-red", "red-950"],
        ["surface-highlight-red-selected", "red-900"],
        ["surface-highlight-red-hover", "red-800"],
        ["text-highlight-red", "red-200"],
        ["surface-highlight-blue", "blue-950"],
        ["text-highlight-blue", "blue-200"],
        ["surface-highlight-green", "green-950"],
        ["text-highlight-green", "green-200"],
        ["surface-highlight-yellow", "orange-950"],
        ["text-highlight-yellow", "orange-200"],
      ]) {
        expect(dark).toContain(`--color-${name}: var(--color-${value});`);
      }
    });

    it("surface-primary and stroke-lines get real dark values for the first time (fixes the <body> dark-background bug)", () => {
      const css = generateTheme(tokens);
      const dark = css.slice(css.indexOf('[data-theme="dark"]'));
      expect(dark).toContain("--color-surface-primary: var(--color-stone-900);");
      expect(dark).toContain("--color-stroke-lines: var(--color-stone-600);");
    });
  });
});
