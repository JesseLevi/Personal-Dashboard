// Shared logic for the token -> theme pipeline (ADR-0010). Unit-tested in tests/tokens.test.ts.

/** Resolve a "{primitive.color.x}" reference against the tokens object. */
export function resolveRef(tokens, ref) {
  const match = /^\{([^}]+)\}$/.exec(ref);
  if (!match) return ref;
  const path = match[1].split(".");
  let node = tokens;
  for (const key of path) {
    node = node?.[key];
    if (node === undefined) throw new Error(`Unresolvable token reference: ${ref}`);
  }
  return node;
}

/**
 * Resolve a semantic ref to the CSS value it emits. Two ref shapes:
 *  - "{primitive.color.X}": the historical case — resolve to the primitive
 *    entry's own var (or literal value for a custom, non-Tailwind-stock primitive).
 *  - "{semantic.color.X}": the alias tier (ADR-0010 amendment, #203) — a
 *    product-facing name (`priority-urgent` etc.) that points at ANOTHER
 *    semantic token rather than a primitive. Emitting `var(--color-X)` here
 *    (never resolving X's own light/dark value) is what makes the alias
 *    single-line and dark-mode-free: the browser re-resolves that var at
 *    compute time, so X's own `[data-theme="dark"]` override cascades
 *    through automatically — no separate dark declaration needed for the
 *    alias itself. Decided by the ref's own path, not by sniffing the
 *    resolved target's shape, since a semantic entry ({light,dark,figma,...})
 *    and a primitive entry ({value,tailwind}) don't share a duck-typed field
 *    to branch on safely.
 */
function cssValueForRef(tokens, ref) {
  const path = /^\{([^}]+)\}$/.exec(ref)[1].split(".");
  if (path[0] === "semantic" && path[1] === "color") {
    resolveRef(tokens, ref); // throws on a dangling alias (closed scale, same as primitives)
    return `var(--color-${path[2]})`;
  }
  const target = resolveRef(tokens, ref);
  if (!target.tailwind) return target.value;
  return target.tailwind === "white" ? "#FFFFFF" : `var(--color-${target.tailwind})`;
}

/**
 * A semantic color entry is either a plain ref string (light-only, no dark
 * variant defined) or a `{ light, dark }` object carrying both. Normalizing
 * here keeps the two call sites (light emission, dark emission) simple.
 */
function lightRef(def) {
  return typeof def === "string" ? def : def.light;
}
function darkRef(def) {
  return typeof def === "string" ? null : (def.dark ?? null);
}

/**
 * Generate the Tailwind v4 @theme CSS from tokens.json content.
 * Primitives that exist in the stock Tailwind palette are referenced via their
 * CSS variable; custom primitives and all semantic tokens get explicit vars.
 *
 * Dark-mode overrides (ADR-0010 + ticket #42): any semantic color entry
 * carrying a `dark` ref gets a second declaration inside a
 * `[data-theme="dark"] { ... }` block, placed immediately after the `@theme`
 * block in the same generated file. That attribute selector — not a `.dark`
 * class, not `prefers-color-scheme` — is deliberate: it's exactly what
 * @ladle/react's Light/Dark toggle sets on `<html>` (see its
 * init-side-effects.ts). The block is deliberately left OUTSIDE any
 * `@layer` (Tailwind's `@theme` output compiles into `@layer theme`), so per
 * the CSS Cascade Layers spec it wins over the `@theme` block's `:root`
 * declarations unconditionally — regardless of specificity or source order,
 * an unlayered rule always beats a layered one. Verified against the actual
 * compiled `pnpm ladle:build` output (2026-07-20): the light `:root,:host`
 * vars sit inside `@layer theme`, this block is unlayered and comes last.
 * No `dark:`-prefixed utility classes are needed in component markup as a
 * result — components keep using plain semantic classes (`bg-surface-secondary`
 * etc.) and the CSS variable itself is what changes underneath them.
 */
export function generateTheme(tokens) {
  const lightLines = [];
  const darkLines = [];

  for (const [name, def] of Object.entries(tokens.primitive.color)) {
    if (!def.tailwind) lightLines.push(`  --color-${name}: ${def.value};`);
  }

  for (const [name, def] of Object.entries(tokens.semantic.color)) {
    lightLines.push(`  --color-${name}: ${cssValueForRef(tokens, lightRef(def))};`);
    const dark = darkRef(def);
    if (dark) darkLines.push(`  --color-${name}: ${cssValueForRef(tokens, dark)};`);
  }

  // Motion tokens (ticket #86): unlike colour, these have no Figma source and
  // no light/dark split (see design/tokens.json's own semantic.duration /
  // semantic.easing $comments), so there's no cssValueForRef/lightRef/darkRef
  // indirection to reuse — each semantic name resolves straight to its
  // primitive's literal value and gets its own explicit CSS var, landing in
  // Tailwind v4's theme block. Only `--ease-*` is a real Tailwind namespace
  // (so `ease-base` is a generated utility); `--duration-*` is not, so
  // `--duration-base` is consumed via `duration-[var(--duration-base)]` —
  // see design/tokens.json's semantic.duration $comment.
  for (const [name, ref] of Object.entries(tokens.semantic.duration ?? {})) {
    if (name.startsWith("$")) continue; // skip the "$comment" doc field, not a token
    lightLines.push(`  --duration-${name}: ${resolveRef(tokens, ref).value};`);
  }
  for (const [name, ref] of Object.entries(tokens.semantic.easing ?? {})) {
    if (name.startsWith("$")) continue;
    lightLines.push(`  --ease-${name}: ${resolveRef(tokens, ref).value};`);
  }

  // Radius (ticket #205, Semantics / Responsive): identical between Figma's
  // Mobile and Desktop modes, so each semantic name gets exactly one @theme
  // declaration. Each aliases a primitive.radius entry, which in turn (like
  // the color primitives' `tailwind` field) just points at Tailwind's own
  // stock --radius-sm/md/lg/xl/3xl var rather than re-declaring the pixel
  // value — that's how e.g. control-outer and card can share radius/xl (both
  // 12px) as one primitive without duplicating "12px" in two places.
  for (const [name, def] of Object.entries(tokens.semantic.radius ?? {})) {
    if (name.startsWith("$")) continue; // skip the "$comment" doc field, not a token
    const target = resolveRef(tokens, def.value);
    lightLines.push(`  --radius-${name}: var(--radius-${target.tailwind});`);
  }

  // Spacing (ticket #205): component/inline/stack tiers are identical across
  // Mobile/Desktop too. Emitted as calc(var(--spacing) * N) rather than a
  // literal px/rem — Tailwind v4 ships one base --spacing multiplier
  // (0.25rem), not per-step vars (see design/tokens.json's primitive.spacing
  // $comment), so this is Tailwind's own documented extension pattern for a
  // named spacing value that stays pegged to that base unit. `ref` is always
  // a "{primitive.spacing.N}" string — resolveRef validates it (throws on a
  // dangling reference) and N is read directly off the ref's own last path
  // segment, since the primitive key IS the multiplier by construction.
  function spacingMultiplier(ref) {
    resolveRef(tokens, ref);
    return Number(/^\{([^}]+)\}$/.exec(ref)[1].split(".").pop());
  }
  for (const group of [
    tokens.semantic.spacing?.component,
    tokens.semantic.spacing?.inline,
    tokens.semantic.spacing?.stack,
  ]) {
    for (const [name, def] of Object.entries(group ?? {})) {
      lightLines.push(`  --spacing-${name}: calc(var(--spacing) * ${spacingMultiplier(def.value)});`);
    }
  }

  // Layout (ticket #205): most entries are single-valued like the groups
  // above, but page-top/page-left/page-right-equal genuinely differ between
  // Mobile and Desktop (see design/tokens.json's semantic.spacing.layout
  // $comment) — those carry `mobile`/`desktop` refs instead of a plain
  // `value`. The Mobile figure is the @theme (base) declaration; the Desktop
  // figure is collected separately and emitted below inside an unlayered
  // @media block, mirroring the [data-theme="dark"] trick beneath.
  const responsiveLines = [];
  for (const [name, def] of Object.entries(tokens.semantic.spacing?.layout ?? {})) {
    if ("desktop" in def) {
      lightLines.push(`  --spacing-${name}: calc(var(--spacing) * ${spacingMultiplier(def.mobile)});`);
      responsiveLines.push(`    --spacing-${name}: calc(var(--spacing) * ${spacingMultiplier(def.desktop)});`);
    } else {
      lightLines.push(`  --spacing-${name}: calc(var(--spacing) * ${spacingMultiplier(def.value)});`);
    }
  }

  const lines = [
    "/* GENERATED by scripts/generate-theme.mjs from design/tokens.json — do not edit (ADR-0010). */",
    "@theme {",
    ...lightLines,
    "}",
    "",
  ];

  if (darkLines.length > 0) {
    lines.push(
      '/* Dark-mode overrides: [data-theme="dark"] is set by @ladle/react\'s Light/Dark',
      "   toggle (and would be the hook for a future app-level theme switch). Left",
      "   OUTSIDE any @layer on purpose: Tailwind's @theme output above compiles into",
      "   @layer theme, and per the CSS Cascade Layers spec an unlayered rule always",
      "   overrides a layered one, regardless of specificity or source order — no",
      "   dark: utility classes needed in components. */",
      '[data-theme="dark"] {',
      ...darkLines,
      "}",
      "",
    );
  }

  if (responsiveLines.length > 0) {
    lines.push(
      "/* Responsive layout overrides (ticket #205, Semantics / Responsive): only",
      "   page-top/page-left/page-right-equal differ between Figma's Mobile and",
      "   Desktop modes — the @theme block above already carries the Mobile (base)",
      "   value, this raises it to Desktop past breakpoint/md (768px, same value as",
      "   Tailwind's own `md` breakpoint). Same unlayered-@media-on-:root trick as",
      '   the [data-theme="dark"] block above: Tailwind\'s @theme output compiles',
      "   into @layer theme, so an unlayered rule wins unconditionally past 768px",
      "   regardless of specificity or source order — no md: prefix needed on the",
      "   component utility classes that consume these vars. */",
      "@media (min-width: 768px) {",
      "  :root {",
      ...responsiveLines,
      "  }",
      "}",
      "",
    );
  }

  return lines.join("\n");
}
