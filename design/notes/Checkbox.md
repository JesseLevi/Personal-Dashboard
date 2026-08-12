# Checkbox

- **Code:** `components/atoms/Checkbox.tsx`
- **Node ID:** `3727:4084`

Checked=No/Yes prop; fetched node has no 'delete' state — needs triage before a future ticket adds it (#16). Fixed #45 2026-07-20: (1) check-icon colour was `accent`/purple-figma (#8A38F5), a mix-up with the component-SET node's own dashed purple selection-boundary stroke reported by MCP (a Figma canvas artifact, not a design property) — the real glyph colour, sampled from the exported Checked=Yes PNG, is #79716B, an exact match for the existing stone-500-backed `text-muted` token, so it was reused as-is with no tokens.json/theme.css change; Figma's own role name for this (`color/stroke/secondary`) has no dedicated semantic entry yet — flagged here as the gap for a future real token-sync pass, not papered over. (2) host element changed from `<div role="checkbox">` to a native `<button type="button" role="checkbox">` (same technique as `Button/Toggle`) so Space/Enter + focus work for free from the browser; `checked` stays fully composer-owned (drives `aria-checked` directly), composer supplies its own `onClick` — atom remains a Server Component, no internal state.

## TICKET #80 (2026-07-21)

flex-shrink defence added. Measured in a real browser (Playwright against `pnpm ladle`): inside CardContentIngredient's width-constrained row this atom's stated h-8 w-8 (32x32) rendered as narrow as 27.5x32, a flex item defaulting to flex-shrink:1 with nothing here opting out — same failure class as the Trash Button squash recorded in Atom/Button's own note this ticket. `shrink-0` added to this atom's base classes so it defends its own square footprint regardless of caller layout.

## TICKET #205 (2026-08-12): radius token

`rounded-lg` (8px) → `rounded-control`. Measured via `figma_execute` on both
`Checked=No` (3727:4035) and `Checked=Yes` (3727:4085): `topLeftRadius` (and
the other three corners) bind `radius/control` on both, byte-identical, so
one token covers the whole variant axis. No spacing/gap classes on this
atom to convert — fixed `h-8 w-8` box, centered content, no internal
padding.
