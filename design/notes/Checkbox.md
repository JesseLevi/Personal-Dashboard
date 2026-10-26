# Checkbox
Figma: `Checkbox` · node `3727:4084` (Checked=No `3727:4035`, Checked=Yes `3727:4085`) · Code: `components/atoms/Checkbox.tsx`

## Anatomy
Fixed `h-8 w-8` square, centered content, no padding. Figma's `Checked=No/Yes` axis is the `checked` prop; Yes renders `Icon` `Check` at 20 px in `text-text-secondary`. Border `border-stroke-primary`, fill `bg-surface-highlight-white`, radius `rounded-control`.

## Deliberate decisions
- Host is a native `<button type="button" role="checkbox">`, not a `<div role="checkbox">`, so focus and Space/Enter activation come from the browser (same technique as `Button/Toggle`). `checked` is fully composer-owned (drives `aria-checked`), the composer supplies its own `onClick`; the atom stays a Server Component with no internal state. (#45)
- Check-icon colour is `text-text-secondary` (the stone-500 glyph sampled from the exported Checked=Yes PNG). The purple `accent` (#8A38F5) the MCP reported was the component-SET node's own dashed selection stroke, a Figma canvas artifact, not a design property. (#45, #203)
- `shrink-0` is in the base classes. In CardContentIngredient's width-constrained row the box rendered as narrow as 27.5x32 (flex-shrink default); the atom defends its own square footprint regardless of caller layout. (#80)
- `rounded-lg` became `rounded-control`: radius binds `radius/control` on both Checked values, byte-identical. (#205)
- Dark-mode border visibility is fixed at token level, not here: `stroke-primary` dark was changed `stone-700` to `stone-600` (light stays `stone-300`). Figma's dark data still says `stone-700`; this is a permanent departure recorded on the token (`$pendingFigmaValue.dark` + `$comment`), not a re-sync item. Card, Button/Outline and InputField read the same token and get the same lighter dark border. (#222)

## Token gaps and flags
- Figma's role name for the glyph colour (`color/stroke/secondary`, #79716B) has no dedicated semantic entry; the existing `text-secondary` token matches the pixel. Flagged for a future token-sync pass.
- Fetched node has no "delete" state; needs triage before a ticket adds it. (#16)

## Gotchas
- The visual suite renders light mode only (no dark baselines), so dark-border regressions are invisible to it; check `basis--invoer--checkbox--states` with `data-theme="dark"` on `<html>` manually.
