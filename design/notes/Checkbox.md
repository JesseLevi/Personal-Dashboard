# Checkbox

- **Code:** `components/atoms/Checkbox.tsx`
- **Node ID:** `3727:4084`

Checked=No/Yes prop; fetched node has no 'delete' state — needs triage before a future ticket adds it (#16). Fixed #45 2026-07-20: (1) check-icon colour was `accent`/purple-figma (#8A38F5), a mix-up with the component-SET node's own dashed purple selection-boundary stroke reported by MCP (a Figma canvas artifact, not a design property) — the real glyph colour, sampled from the exported Checked=Yes PNG, is #79716B, an exact match for the existing stone-500-backed `text-muted` token, so it was reused as-is with no tokens.json/theme.css change; Figma's own role name for this (`color/stroke/secondary`) has no dedicated semantic entry yet — flagged here as the gap for a future real token-sync pass, not papered over. (2) host element changed from `<div role="checkbox">` to a native `<button type="button" role="checkbox">` (same technique as `Button/Toggle`) so Space/Enter + focus work for free from the browser; `checked` stays fully composer-owned (drives `aria-checked` directly), composer supplies its own `onClick` — atom remains a Server Component, no internal state.

## TICKET #80 (2026-07-21)

flex-shrink defence added. Measured in a real browser (Playwright against `pnpm ladle`): inside CardContentIngredient's width-constrained row this atom's stated h-8 w-8 (32x32) rendered as narrow as 27.5x32, a flex item defaulting to flex-shrink:1 with nothing here opting out — same failure class as the Trash Button squash recorded in Atom/Button's own note this ticket. `shrink-0` added to this atom's base classes so it defends its own square footprint regardless of caller layout.

## TICKET #222 point 3 (2026-08-16): checkbox invisible in dark mode

Reported: in dark mode the checkbox's border was indistinguishable from its
surroundings. Root cause is not in this file — `Checkbox.tsx`'s
`border border-stroke-primary bg-surface-highlight-white` classes were never
touched, and were never wrong on their own; the shared `stroke-primary`
token's dark value (`design/tokens.json`) was too close to the surrounding
dark surface to read as a visible border. The user made the token-level call
directly rather than asking for a component-scoped fix: change
`stroke-primary`'s `dark` ref from `stone-700` to `stone-600`, leave `light`
(`stone-300`) untouched. Figma's own dark data still says `stone-700`
(`#44403B`) — this is a deliberate, permanent departure, recorded on the
token via `$pendingFigmaValue.dark` + a `$comment`, not a re-sync item for a
future ticket to "fix" back. See `docs/design-tokens.md`'s dark-mode rule and
`design/tokens.json`'s `stroke-primary` entry for the full reasoning.

**Blast radius, accepted knowingly, not this file's problem to solve:**
`stroke-primary` is the single shared border-role token — Card, Button/
Outline, and InputField all read it too, so all of them get the same,
slightly lighter dark border as a side effect. No component code changed
anywhere; only the one token value did.

**Verification:** visual suite renders light-mode only (0 dark baselines
exist), so it cannot see this change and stayed green with zero regenerated
baselines — expected, not a gap in coverage for this particular fix. Checked
directly instead: real browser (`pnpm ladle`, Playwright) against
`checkbox--states`, `data-theme="dark"` set on `<html>` — both boxes' borders
are now visibly a lighter stone against the dark surface, where before the
border and surface were close enough to read as borderless.

## TICKET #205 (2026-08-12): radius token

`rounded-lg` (8px) → `rounded-control`. Measured via `figma_execute` on both
`Checked=No` (3727:4035) and `Checked=Yes` (3727:4085): `topLeftRadius` (and
the other three corners) bind `radius/control` on both, byte-identical, so
one token covers the whole variant axis. No spacing/gap classes on this
atom to convert — fixed `h-8 w-8` box, centered content, no internal
padding.
