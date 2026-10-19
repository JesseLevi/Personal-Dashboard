# InputField
Figma: `Input-field` · node `3705:4402` (states: Default / Hover / Active / Selected, e.g. `3705:4386`, `3784:4736`, `3826:6708`, `3740:4576`) · Code: `components/atoms/InputField.tsx`

## Anatomy
Server Component. Outer `flex-col gap-stack-sm`: optional `label`, then the bordered box (`flex-row items-start gap-stack-md rounded-control-outer border border-stroke-primary bg-surface-highlight-white p-component-xs`) holding a content column (leading icon + control, then the optional `button` row) and an optional trailing-icon column.

- Figma `Field`+`Title` is `label`, which requires `id` (type-enforced: an RSC cannot `useId`). `Leading-icon` is `leadingIcon`; `Trekking-icon` is a misnomer for the TRAILING icon, so `trailingIcon`; `Content` is the native placeholder / value; the `Button` SLOT is the `button` named slot (not a hardcoded `Button` instance).
- Control variants: single-line `<input>` (default); `multiline` renders `<textarea>` (fixed `h-36` = 144 px, matching Omschrijving `3779:4852`; with `button` it is `h-[124px]` and the text row uses `flex-1 min-h-0`); `options` renders a native `<select>` (`placeholderOption` becomes a disabled hidden `<option value="">`; pair with `trailingIcon="ChevronDown"`, the atom does not hardcode a chevron).
- State mapping to CSS (Figma labels states, not CSS hooks): Hover is `hover:border-stroke-primary-hover`, Active is `active:border-stroke-primary-active`, Selected is `focus-within:border-stroke-primary-selected`. Default/Hover/Selected are shared Figma variables with Button/Outline; Active is `Stroke/primary/active` (stone-600) versus Button/Outline's `Stroke/secondary/active` (stone-800): two distinct, correctly bound variables, not one ramp read inconsistently. No ring or outline is used, and not the retired `accent`.
- Token bindings (all four states byte-identical): box `gap-stack-md` and `rounded-control-outer` and `p-component-xs`; root `gap-stack-sm`; leading+text row `gap-inline-sm` and `pl-component-sm` and `py-` / `pt-component-sm`; trailing column `py-component-sm pr-component-sm`.

## Deliberate decisions
- `items-start` on the box (not `items-center`): Figma's row has no alignItems override, and centring the 32 px leading+text column inside the 40 px trailing-icon row added a phantom ~4 px offset. Still load-bearing when `button` makes the content column taller. (#44, #78)
- The leading+text row uses symmetric `py-component-sm` (intrinsic height 40) so the box hugs a stable 48 px for all four icon combinations. Figma's raw padding is 8/0/0/8 and its four fetched states all show a trailing icon, so the no-trailing-icon case is structurally undemonstrable; this is a deliberate deviation. With `button` present the bottom padding drops to `pt-component-sm` (Figma's real top/left-only value), and the box is unchanged without `button`. (#78, #149)
- `options` is a native `<select>`, not `Dropdown`: Figma models Personen / Eenheid as this same field with a chevron. A native select gives the OS picker on mobile, full keyboard / screen-reader semantics and a compact closed state with no JS; `appearance-none` leaves only the atom's own `trailingIcon`. (#149)
- Status / Prioriteit / Grootte are Figma `Input-field` instances with `Text:false`, but they are built on the `Dropdown` atom (same title + bordered box), not by adding a hidden-input mode here. See `design/notes/CardDetailPanel.md`. (#94)
- Click-anywhere without JS: the content row and the trailing-icon column are real `<label htmlFor={id}>` elements, so a click anywhere inside delegates to the control (focus, open picker, or a `readOnly` input's `onClick`). `id` is destructured and re-applied to the control. The `button` slot is deliberately NOT inside either label: a different interactive descendant's text would leak into the field's accessible name. Accepted consequence: the box's `p-1` and the `gap-3` margin don't delegate. A labelled field has three labels (title, content row, trailing icon), none nested. (#166)
- `onTrailingIconClick` + `trailingIconLabel` (a paired discriminated union) swap the trailing `<label>` for a real `<button type="button">` with its own `aria-label`, for the `/notities` search clear (X): a distinct action from focusing. It reuses Button's tokens rather than nesting a `Button` (no `Button/*` wrapper exists in the node): `rounded-control`, `hover:bg-surface-secondary-hover active:bg-surface-secondary-active`, plus `chrome-touch`. Callers passing neither prop keep the plain label. (#231)
- `boxClassName` is a narrow escape hatch for a composed molecule whose real focusable control isn't a descendant of the box (`ImageUploadField`: the real file input is a sibling, so the box's `:hover` / `:focus-within` never fire; pass `peer-*` variants instead). Every other caller leaves it unset. (#166)
- `leading` (a node) takes the place of `leadingIcon` for a leading element that is not an icon; the agenda event panel's category select puts a colour dot there. Callers passing neither keep today's markup. (#532)
- Stories: `States`, `IconCombinations` (stacks none / leading / trailing / both and doubles as the equal-height regression check), `ClearableSearch`. Selected is not faked in `States`.

## Token gaps and flags
- Button-row `gap-2` (`Slot` `itemSpacing` 8) and trailing-icon column `gap-2` (`Trekking-icon-container` `itemSpacing` 8) have no bound variable, so they stay raw with a `spacing-flag:`. (#205)
- `p-0` on the native `<input>` / `<select>` / `<textarea>` resets UA padding and is not a Figma value (Figma text nodes carry no CSS padding); flagged with `spacing-flag:`, no "zero" token invented. (#218)
- Not modelled: Figma's `Text` boolean, which can hide the whole input row leaving only the `button` slot. A future field needing "InputField's box, no native input, no Dropdown disclosure" would need it.
- The Selected state's `:focus-within` mapping is this atom's own interpretation (its sample shows typed, stone-950 content). A 1 px border colour change is a weak keyboard-focus affordance and Figma offers nothing stronger; none was invented. Flagged for design confirmation. (#53, #58)
- Dark values for the whole border ramp are Figma-sourced (`Semantics _ Style_Dark`); no `dark:` utilities in the component. (#204)
- Shared `stroke-primary` dark value is lightened to `stone-600` for Checkbox; this border gets it too. See `design/notes/Checkbox.md`. (#222)

## Gotchas
- Plain `InputField` / `multiline` without `button` must render pixel-identically to before #149; check the full visual suite when touching the padding or height rules.
- The content column's `self-stretch` is what lets a fixed multiline height reach the text row (the box's `items-start` otherwise leaves an auto-height child unstretched).

## Open
- `docs/open-questions.md#notes-search-clear-button-states-undesigned`
