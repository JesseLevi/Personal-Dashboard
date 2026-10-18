# ButtonToggle
Figma: `Button/Toggle` (Development > Molecules > Toggles) · node `4160:33335` · Code: `components/molecules/ButtonToggle.tsx`

Rebuilt from scratch as a molecule in #265. The retired atom (node `3623:4345`, now orphaned in Figma) was icon-only with uniform 32 px segments; this one is a different component with text-labelled, variable-width segments. Do not adapt the old atom's approach. (#265)

## Anatomy
Root `flex w-full flex-col gap-stack-sm`: optional `Titel` text, then the `Container` (`role="radiogroup"`, `relative flex w-full gap-inline-xs rounded-card bg-surface-highlight-white p-component-xs`). Inside: an absolutely-positioned `ActiveBackground` indicator span plus one `Button variant="transparent"` per item (icon + label), `role="radio"`.

Props: `items` (`value`, `icon`, `label`), required `defaultValue`, `onValueChange`, and `title` XOR `aria-label`.

Bindings measured via `boundVariables`:

| Element | Binding | Class |
|---|---|---|
| Root gap | `spacing/stack/stack-sm` | `gap-stack-sm` |
| Container padding / segment gap | `spacing/component/padding-xs` / 4 px | `p-component-xs` / `gap-inline-xs` |
| Container radius | `radius/card` | `rounded-card` (not `radius/control-outer`: same 12 px, different token) |
| Container fill | `color/surface/highlight/white/default` | `bg-surface-highlight-white` |
| ActiveBackground radius | `radius/control` | `rounded-control` |
| Title | `text-base/semibold`, stone-500 | `text-base font-semibold text-text-secondary` |

## Deliberate decisions
- Indicator position AND size are measured at runtime (`offsetLeft/Top/Width/Height` of the active radio, relative to the same padding-edge origin), written imperatively via `indicatorRef.current.style` (`transform: translate`, `width`, `height`). Variable-width labels rule out a static offset table. This is the same pattern as `SidePanel` drag-to-close for runtime-pixel values Tailwind cannot express. `useLayoutEffect` (not a plain effect) avoids a flash at 0x0; a `ResizeObserver` on the row re-measures on font load or responsive parent resize. (#265)
- Equal full-width segments: root and track are `w-full` (Figma root is FIXED 368 with `layoutGrow: 1`, Container FILL, each segment `layoutGrow: 1`); segments use `grow basis-0`, not `flex-1`, so they don't contest `Button`'s own `shrink-0` (#80) via the shorthand-vs-longhand emission-order hazard. The story wraps in a `w-[368px]` box (the real SettingsPanel content width). (#265)
- Segments stay fill-less in every state: they are `Button variant="transparent"` (which has real Hover/Active fills, #107) with `hover:bg-transparent! active:bg-transparent!`. Each segment is `relative` to paint above the indicator, so any segment background would cover it (measured: hover greys the pill, active makes it vanish). Figma gives segments no State axis and specifies only the indicator. The `!` important modifier is used because a plain override and the cva variant's own hover utility have equal specificity and would depend on stylesheet emission order. (#107, #265)
- Stacking: the indicator is `absolute` but deliberately has no `z-index`; segments are `relative`, so DOM order (indicator first) puts segments on top, matching Figma's layer order. (#265)
- Accessibility: WAI-ARIA Radio Group (`role="radiogroup"` + `role="radio"` / `aria-checked`, roving `tabIndex`, Left/Right/Up/Down/Home/End selection with wraparound), deliberately not the `aria-pressed` / toolbar idiom: this is "exactly one of N". `Button` is not `forwardRef`, so roving focus walks the DOM from the event's `currentTarget`. `defaultValue` is required (Figma never shows an all-unselected track). (#60, #265)
- `iconOnlyBelowMd` hides the labels below `md` (`max-md:sr-only` span, so the label stays the accessible name). `iconOnlyBelowLg` does the same below `lg` (`max-lg:sr-only`); the Agenda header uses it, because four labelled segments do not fit a phone or a tablet in portrait. (#486, #509)
- `title` (visible, supplies `aria-labelledby` via `useId`) XOR `aria-label` (no visible title), the same required-one-of idiom as `Dropdown`'s `label` / `id`. (#265)
- Client Component with internal selection state: which segment is selected is the group's own behaviour, identical for every caller (same reasoning as `Dropdown`; contrast `Checkbox`, whose `checked` varies per call site and stays composer-owned). (#43, #45)

## Token gaps and flags
- ActiveBackground fill is `#D9D9D9`, unbound, matching no Tailwind stone step (stone-200 `#E7E5E4`, stone-300 `#D6D3D1`). It is Figma's default new-shape fill, i.e. never styled. Used `bg-surface-secondary` (stone-200) as the nearest static neutral surface; not `surface-secondary-hover` (pixel-closer but a hover-role token). Stands until Figma applies a real fill. (#265)
- The Slot's 4 px inter-segment gap binds no variable (the Slot is `layoutMode: NONE`, children manually positioned); modelled as flex `gap-inline-xs`.
- Indicator duration/easing (`duration-200 ease-out`, `motion-reduce:transition-none`) are not Figma-sourced (a static frame); same honestly flagged choice as `Dropdown`'s open/close animation, no project motion token exists.

## Gotchas
- Stories (`WithTitle` NL+EN with real `settingsPanel` strings, `WithoutTitle`, `VariableWidthSegments`) carry the visual baselines; `VariableWidthSegments` deliberately mismatches label lengths to prove per-segment indicator sizing.

## Open
- `docs/open-questions.md#no-pointer-affordance` (should segments have any pointer affordance)
- `docs/open-questions.md#sidebar-motion-timing-unsourced` (indicator still hardcodes `duration-200 ease-out`)
