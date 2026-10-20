# Button
Figma: `Button/Default` component set · node `3623:4346` (5 Styles x 4 States x 2 Alignments = 40 variants, e.g. Filled/Default/Center `3623:4344`) · Code: `components/atoms/Button.tsx`

Colour-state conventions (role / role-hover / role-active, Selected composing with Hover and Active, ramp-step name is not the CSS state name) live in `docs/design-tokens.md`, including the full per-state matrix. This note keeps only what is Button-specific.

## Anatomy
Root: `chrome-touch inline-flex shrink-0 items-center gap-1 rounded-control text-base font-semibold transition-colors`, containing a `Leading + Text` span (`gap-inline-sm`, icon then children) and an optional trailing `Icon`.

- `variant` is Figma `Style`: `filled` (default) / `outline` / `white` / `transparent` / `destructive` (Figma spells it "Distructive"; the code API is `destructive`). (#13)
- State is never a prop: Hover is `hover:`, Active (pressed) is `active:`, Selected is the caller's standard `aria-pressed` attribute.
- Figma `With icon` / `With text` / `Trekking icon` (its misnomer for trailing) are the presence of `icon` / `children` / `trailingIcon`.
- `size`: `default` (`h-10 px-component-sm`), `small` (`h-8 px-component-sm`, labelled only, 32 px high: the segment of `ButtonToggle size="small"` and the Agenda header's toggle), `compact` (`size-8 justify-center`, 32x32, icon-only), and an internal-only `iconOnlyDefault` (`size-10 justify-center`, 40x40) that is resolved automatically for icon-only buttons. Figma has no Size property; the sizes are structural, with width = height stated directly instead of emerging from padding arithmetic.
- `align` (Figma `Alignment`): `center` (default, `justify-center`) or `left` (`justify-between`: leading group at the start, a trailing icon pushed to the far edge of a stretched button, collapsing to flex-start with no trailing icon). Resolved in JS and only for the labelled sizes, so it never coexists with icon-only's own `justify-center`.
- Props union: icon-only (no `children`) requires `aria-label` (`Icon` is `aria-hidden`) and forbids `trailingIcon` and `align`; `size="compact"` is only valid icon-only (a fixed 32x32 box would clip a label), and `size="small"` only labelled (an icon-only button stays 40x40 or compact). Each is a type error rather than a silent guess, because Figma samples none of those combinations. (#69, #75, #99, #107)

## Deliberate decisions
- Selected uses `aria-pressed:` rather than `active:`: CSS `:active` means "being pressed", a different non-persistent state. Figma renamed its old `Active` to `Selected` in #42; Figma's current `Active` is the pressed state. (#42, #56)
- Selected sets only text colour (`aria-pressed:text-text-primary`) on Filled / White / Transparent, so it composes with Hover / Active (which set only background). White, Transparent and Destructive have no Selected fill: never add `aria-pressed:bg-*` there. Destructive text never changes. (#56, #213)
- Outline is the exception: Selected sets `border-color` (`stroke-primary-selected`), the same property as Hover / Active. The compound variants `aria-pressed:hover:border-stroke-primary-hover` / `aria-pressed:active:border-stroke-secondary-active` are load-bearing (higher specificity than the plain `aria-pressed:` rule, which Tailwind emits after hover / active); do not replace them with a bare `aria-pressed:border-*`. Verified against the compiled `pnpm ladle:build` stylesheet. Outline Active is `Stroke/secondary/active` (stone-800), distinct from InputField's `Stroke/primary/active`. (#68, #204)
- White and Destructive bind Hover to the ramp's `selected` step and Active to its `hover` step, because that is what their state nodes actually bind (White Hover `3784:4076`, Active `3782:4908`; Destructive Hover `3784:4091`, Active `3782:4923`; their Selected nodes bind `default`). #204 "corrected" this to like-named steps; that was the bug, reverted at the consumer in #213 (token names and values were never wrong). Filled, Outline and Transparent bind state name = step name. Do not re-"fix" it without per-node `boundVariables` from the `figma-console` bridge. (#204, #213)
- Transparent's Hover / Active read `surface-secondary-hover` / `-active`, the same variables Filled reads (Figma rebound it off the White ramp; measured per node, `Alignment=Left` spot-checked too). Token values did not change, so this is a pure consumer rebind; `surface-highlight-white-active` now has no consumer but stays as a live Figma variable. (#107, #204, #238)
- Alignment mapping is this codebase's own, not Figma's: no variant has `justifyContent` on the root, all are hug, so Center and Left render identically in Figma. User rule: every button defaults to center; menus, nav items and dropdown triggers / options pass `align="left"`. Figma's `Center` is really space-between of two child groups and `Left` is packed, so a stretched `align="left"` button with a trailing icon is NOT what Figma shows. (#107, #112)
- Root `gap-1` (4 px) is unconditional so left / center differ only in `justify-*`. The `Leading + Text` span is `gap-inline-sm` (8 px, Figma's stated value). Root padding is symmetric `px-component-sm`, a re-author in Figma for the trailing icon (previously emergent 4+4 and 4+8 sums). (#99, #112, #205)
- `shrink-0` is in the shared base so the atom defends its stated footprint in any flex layout (CardContentIngredient's Trash button squashed to 35x40 otherwise); do not re-add local copies. Callers that split space use `grow basis-0` longhands (as `ButtonToggle` does) rather than `flex-1`, to avoid the shorthand-vs-longhand emission-order race. (#80)
- Icon-only default is 40x40 via `iconOnlyDefault`; before that it summed to 36x40. `CardContentIngredient`'s revealed-button footprint (40 px) depends on it. (#75)
- `chrome-touch` (no long-press callout / selection, no double-tap-zoom delay) is on every Button: a control is never reading content. (#172)
- Dark mode is token-only: no `dark:` utilities in the component. Dark shades for the Button tokens are Figma-sourced since #204.

## Token gaps and flags
- Root `gap-1` stays raw, marked `spacing-flag:` in the code. Figma is internally inconsistent: every `Alignment=Left` root binds `itemSpacing` to `spacing/component/padding-xs`, every `Alignment=Center` root leaves a literal 4. Both render 4 px, so the value is correct either way; a design-side decision (bind all eight or unbind all eight). (#205, #218)
- Figma's Filled / Selected instance has uniform 8 px padding versus 4 / 8 elsewhere: treated as auto-layout drift, not modelled.
- Dark mode: Destructive overrides Figma's placeholder `red-50` with the agenda alert palette: fill `red-950`, hover `red-900`, press `red-800`, text `red-200` (user call, 2026-10-20; tokens carry `$pendingFigmaValue.dark`). Still a Figma fact, accepted: `surface-highlight-white-active` dark (stone-400) is lighter than `-hover` (stone-500), backwards from light. (#204)
- No disabled look or token exists; callers fake it (see Open).

## Gotchas
- Collapsed Sidebar rail: nav column inner width is 40 px, and `px-component-sm` (8) + 24 px icon + `gap-inline-sm` (8) = 40 exactly, so the label is fully clipped. Changing any of those three numbers reveals a sliver of the label (the old 4 px gap showed one). (#112)
- `ButtonToggle` segments are `variant="transparent"` with `hover:bg-transparent! active:bg-transparent!` so no fill paints over the sliding indicator; that override is variant-value-independent. See `design/notes/ButtonToggle.md`. (#107)
- `CardDetailPanel` Prioriteit / Grootte option-row hovers read the White ramp (those rows are `Button variant="white"` in the Dropdown node); see `design/notes/CardDetailPanel.md`. (#213)
- Visual baselines: only `button--state-matrix` iterates all five variants (Transparent row included); other stories render `filled`. A change to a trailing / leading gap moves baselines across Dropdown, PageHeader, SidePanel, Sidebar, CardDetailPanel, CardContainer and BoardView stories too. (#99, #238)

## Open
- `docs/open-questions.md#button-root-gap-binding-split`
- `docs/open-questions.md#button-no-disabled-state`
