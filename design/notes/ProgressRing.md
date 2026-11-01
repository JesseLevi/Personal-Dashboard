# ProgressRing
Figma: none, designed in code (ADR-0034) · Code: `components/atoms/ProgressRing.tsx` (+ `.stories.tsx`)

## Why a component
A board row in the command palette shows how far the board is (ADR-0048). Nothing else in the app draws progress, and a ring is not a `Tag` or a bar. It is a small SVG atom any list row can reuse.

## Anatomy
A 20 px `<svg role="img">` (`size-5`, `viewBox 0 0 20 20`) with two circles of radius 9 and stroke 2: the track in `stroke-stroke-primary`, and the arc in `stroke="currentColor"` with round caps. The arc starts at 12 o'clock (`transform="rotate(-90 …)"`) and runs clockwise. The tone sets the text colour the arc reads.

## Contract
- Props: `value` (0-100, clamped, non-finite counts as 0), `label` (accessible name, required, e.g. "72% afgerond"), `tone` (`blue` default, `green`, `yellow`, `neutral`), `className`.
- Tones: `text-text-highlight-blue|green|yellow`, `text-text-secondary`.
- A value of 0 draws no arc (a round cap would show a dot).

## Deliberate decisions
- `stroke-dasharray` and `stroke-dashoffset` are SVG attributes, never an inline `style`.
- The ring carries its own accessible name; a visible percentage next to it should be `aria-hidden` so it is not read twice.
- Fixed size, no `size` prop: one place uses it. Add the axis when a second size is needed.

## Token gaps and flags
- 20 px has no sizing token; `size-5` is not gated by `check:raw-spacing`. Stroke width 2 and the viewBox are SVG geometry.

## Gotchas
- The track in dark mode is `stroke-primary` (stone-600); check a new tone against it in both themes.
