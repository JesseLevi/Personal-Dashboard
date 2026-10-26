# ColorSwatches
Claude-designed (#532), ADR-0040, no Figma node · Code: `components/molecules/ColorSwatches.tsx` (also exports `ColorDot`) · Palette: `lib/agenda/colors.ts`

A new molecule, by exception to ADR-0034: Atlas had no colour picker, and nothing existing fits a choice of nine colours (`ButtonToggle` is text segments, `Dropdown` is a popover list, a native `<select>` cannot show a colour). It adds no token: every fill is an existing `event-<colour>-accent`.

## Anatomy
- `role="radiogroup"` with the caller's `label` as its name, holding nine `role="radio"` buttons in palette order (red, orange, amber, green, teal, blue, violet, pink, stone).
- Each radio is a `size-10` round hit area with a `size-6` swatch inside. Selected: `border-stroke-primary-selected` ring. Hover: `border-stroke-primary-hover`. Focus-visible: the `outline-stroke-secondary-active` outline with offset, the same as the calendar's focusable items, because `globals.css` removes the browser outline.
- `aria-label` per colour from `components.colorSwatches.colors.*` (Rood, Oranje, Geel, Groen, Mint, Blauw, Paars, Roze, Grijs).
- `ColorDot`: the small decorative `size-4` dot used in category rows and the event panel's select (through `InputField`'s `leading` slot).

## Deliberate decisions
- **Roving tabindex**, as the radio pattern asks: Tab enters on the selected swatch, arrows (and Home/End) move focus and select, wrapping at the ends. Selecting is immediate; there is no confirm step.
- **Class names are listed statically** (`SWATCH_CLASSES`), so Tailwind sees every token. A new palette colour needs a line here, in `AgendaCalendarTheme`, and in the panel's `TINT_CLASSES`.
- Colour is not the only cue for the selection: the ring is a shape. The swatches have no text; the names are the accessible names.

## Token gaps and flags
- None. `rounded-full` is a structural choice, not a scale value.

## Gotchas
- The nine swatches wrap inside the 22 rem settings panel (seven on the first line); a wider container keeps one line.
- Disabled dims with `opacity-60` (no disabled token exists).
- Dark values come from the tokens; check `agenda--color-swatches--default` in the dark suite.
