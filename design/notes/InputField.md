# Atom/Input-field

- **Code:** `components/atoms/InputField.tsx`
- **Node ID:** `3705:4402`

Figma 'Trekking-icon' is a misnomer for the TRAILING icon → code prop `trailingIcon`. 'Field'+'Title' → `label` (requires `id`, type-enforced, since an RSC cannot useId); 'Content' → native placeholder/value; 'Button' SLOT → `button` named slot (not a hardcoded Button instance, per CLAUDE.md). NOT MODELLED: Figma's 'Text' bool can hide the whole input row, leaving only the button slot — meaningless for an input atom, flagged for triage.

## TICKET #94 (2026-07-24) — `multiline`

The card-detail panel's Omschrijving field (`3779:4852`/`3779:4943`, 144px-tall Input-field instance) needs real multi-line editing, which a native `<input>` can't do. Added `multiline?: boolean` (discriminated union: `true` swaps in `Omit<TextareaHTMLAttributes<...>>` prop typing and renders `<textarea>`; default/`false` is the unchanged `<input>` branch) rather than growing the atom into a third element type — every existing caller is unaffected. The bordered container gets a fixed `h-36` (144px) only in multiline mode, matching Figma's own fixed-height sizing on that one sampled instance (not a token gap — 144px lands exactly on Tailwind's `h-36`).

Left out of scope, still open: the 'Text' bool gap noted above (hiding the input row entirely, showing only `button`) — #94's Status/Prioriteit/Grootte fields turned out not to need it. Those three are Figma `Input-field` instances with `Text:false`, but rather than teaching this atom a second hidden-input mode (which would also have to suppress this atom's own bordered box, since Figma shows one box per field and nesting a second bordered atom — `Dropdown` — inside `button` would double it), they're built directly on the `Dropdown` atom instead, which already renders the identical field-title + bordered-box shape via its own `label` trigger. Full reasoning: `design/notes/CardDetailPanel.md`. The `Text:false` gap itself is unchanged/still real for any future field that genuinely needs "InputField's box, no native input, no Dropdown disclosure."

## FIXED 2026-07-20 (#44)

every padding/gap was already numerically correct against the dev-ready node; the reported 'wrong spacing' was the container's `items-center`, which centers the shorter 32px leading+text column inside the row's real 40px height (set by the trailing icon), adding a phantom ~4px offset absent from Figma's implicit top alignment - corrected to `items-start`.

## UPDATED 2026-07-20 (#53)

re-fetched node shows the semantic variables were reworked since #44 and the set now has three real, distinct container strokes: Default stone-300 (content stone-300 placeholder), Hover stone-500 (content stone-300 placeholder), Active stone-400 (content stone-950 typed). The invented 2px focus-within ring from #44 (which reused border-hover because no Focus state existed) is removed; focus is now expressed as `focus-within:border-border-selected` (new stone-400/stone-500(dark) token, design/tokens.json), matching the fetched Active stroke exactly — no ring/outline.

## FLAGGED HONESTLY, not resolved silently

(a) Figma names this third state 'Active', not 'Focus' — mapping it to `:focus-within` is this atom's reading (it's the only interaction state left in the set and its sample shows a typed value), needs design confirmation; (b) a 1px border-colour change is a weak focus affordance for keyboard users and Figma offers nothing stronger in this node — flagged as a design question, no ring/outline was invented to compensate. Deliberately NOT `accent`: #45 established accent's purple entered the codebase from a Figma canvas artifact (the dashed stroke marking a selected component set), never from design intent - reusing it would have re-introduced the wrong colour in a second component. Story count reduced #44→#53: 10 stories (several stale/duplicate) collapsed to 4 — States, Playground (Ladle arg-driven), WithIconlessButton, WithAndWithoutIcon.

## TICKET #56 (2026-07-20)

re-fetched node 3705:4402 and confirmed it was NOT re-authored along with Atom/Button - still three states (Default stone-300 / Hover stone-500 / Active stone-400), i.e. its Hover stroke is DARKER than its Active one, the reverse of Button/Outline's new ordering (hover stone-400 -> active stone-700). Read as an authoring leftover: this node was never re-bound to the reworked semantic variables. Rather than normalise either component by guessing, this one now reads two PROVISIONAL component-scoped tokens, `border-input-hover` (stone-500) and `border-input-focus` (stone-400), replacing its former use of the shared `border-hover`/`border-selected` (both of which changed meaning in #56). DELETE those two tokens and point this component at the shared `border-hover`/`border-active` scale once Figma is reconciled - tracked as docs/open-questions.md#button-vs-input-active-border.

## TICKET #58 (2026-07-20)

re-fetched node 3705:4402 again, expecting the deletion above to now be possible since the node grew a fourth state (Selected), matching Button's shape. It is NOT possible: Default still matches Button's Default (stone-300, so this atom keeps reading the shared `border` token there), but Hover (stone-500) and the new Active value (no existing primitive matched it; added this ticket as `stone-600`, ~#57534D) remain pixel-different from Button/Outline's Hover (stone-400) and Active (stone-700) - confirmed by fetching 3623:4346 side by side, not assumed. The #56 ordering bug IS fixed (Hover stone-500 is now correctly lighter than Active stone-600, same direction as Button), which is why this reads as a deliberate, stable, component-specific ramp rather than an unbound leftover - so the two tokens are kept, no longer described as provisional, and `border-input-focus` is renamed `border-input-active` to match the Figma state it actually reads (the `:focus-within` mapping is still this atom's own interpretation of that state, unchanged from #53/#56 - see below). Also flagged, not resolved: the fetched node's new Selected state changes both its border (stone-400) and its sample content text (stone-950, a 'typed' look) - the 'typed' tell that #53 used to justify reading Active as focus has now moved onto Selected; Active's own content text is plain placeholder-grey, same as Default/Hover.

## REVIEW CORRECTION (orchestrator, same ticket)

the agent's first pass kept `:focus-within` on Active and left Selected unmodelled, which is inconsistent with the state semantics Button just established and left the field never showing its Selected border. All four states are now modelled the same way Button maps them: Hover -> `:hover`, Active -> `:active` (Figma's Active = being pressed, exactly CSS :active), Selected -> `:focus-within` (it is the state whose sample shows typed rather than placeholder content, i.e. the field has been engaged - and that typed tell is precisely what justified the focus reading in #53, it merely moved from Active onto Selected in this re-fetch). `border-input-selected` (stone-400) was added for it. Still an interpretation - Figma labels states, not CSS hooks - so it stays flagged for design confirmation.

## ALSO OPEN

the user's stated intent was for this component to use the SAME COLOURS as Button. It now has the same four state names, but every value except Default sits one stop lighter than Button's (Hover stone-500 vs stone-400, Active stone-600 vs stone-700, Selected stone-400 vs Button's no-change). Either deliberate (input borders being a distinct role) or the variables were bound one step off - needs the user, and until then the two ramps stay separate rather than being silently normalised. Story count cut #53(4)->#58(5) per the ticket's explicit list: States, WithLeadingIcon, WithTrailingIcon, WithBothIcons, WithoutIcons - Playground, WithIconlessButton and WithAndWithoutIcon were deleted (button-slot demos are out of scope for this ticket's five-story cap).

## TICKET #68 (2026-07-20)

re-fetched node 3705:4402 again alongside Atom/Button's 3623:4346, since the user re-authored Button/Outline's borders. Three of this node's four states now line up pixel-for-pixel with Button/Outline's re-authored values: Default already shared `border` (stone-300, unchanged); Hover is stone-500 on both (Button's Hover moved to meet it) — `border-input-hover` deleted, this component now reads the shared `border-hover`; Selected is stone-400 on both (Button/Outline gained a Selected border for the first time, at exactly this component's existing Selected value) — `border-input-selected` deleted, this component now reads the shared `border-selected` on its `:focus-within` hook. Active does NOT line up: this node stays stone-600, Button/Outline's moved stone-700 -> stone-800 — confirmed side by side, a real difference, not a stale node — so `border-input-active` is kept as the one remaining divergence (docs/open-questions.md#button-vs-input-active-border, rewritten this ticket to describe only this state). The `:focus-within` -> Selected mapping remains this atom's own interpretation, unchanged from #58, still flagged for design confirmation.

## TICKET #78 (2026-07-21)

re-fetched node 3705:4402 for a reported height bug (WithLeadingIcon/WithoutIcons rendering ~8px shorter than WithTrailingIcon/WithBothIcons) and downloaded its PNG — every one of the four fetched State frames (Default/Hover/Active/Selected) has Trekking-icon visible=true, so the dev-ready node never actually exercises the no-trailing-icon case. Root cause confirmed structurally, not patched by trial and error: the bordered 'Container' frame is Figma sizing.vertical=hug, and its row-max height was being supplied entirely by the trailing-icon column (padding 8/8/8/0, own intrinsic height 40) because the leading+text row's raw fetched padding is asymmetric (8/0/0/8, own intrinsic height only 32) — remove the trailing icon and nothing else forces 40, so the row and the Container both shrink by the missing 8px of bottom padding. Fixed by making the leading+text row's own padding symmetric (`py-2 pl-2`, matching the trailing-icon column's already-symmetric `py-2`) so its own intrinsic height is 40 unconditionally — the Container now hugs to a stable 48px (40 row + 4px top/bottom padding) for all four icon combinations (none/leading/trailing/both), independent of which sibling is present. This is a deliberate, flagged deviation from the literal per-state fetched padding value on the leading+text row alone (Figma's raw number is top-only, 8/0/0/8) — chosen over a hardcoded fixed height because the Container's own Figma sizing mode really is hug, not fixed, so pinning a literal pixel height would misrepresent that; justified because the fetched node structurally cannot demonstrate the no-trailing-icon case, and the ticket's own premise ('in Figma the container height does not depend on the trailing icon being present') requires the two columns to independently agree on height rather than one propping up the other. The #44 `items-start` alignment fix is unchanged and still load-bearing whenever the `button` slot renders (Content's column can be taller than the trailing-icon column there; Figma's Container row has no alignItems override, i.e. defaults to top). Verified via Playwright screenshot of the new combined `IconCombinations` Ladle story against the downloaded PNG: all four rows render the same container height. Story consolidation: the four separate icon-permutation stories (WithLeadingIcon/WithTrailingIcon/WithBothIcons/WithoutIcons) are merged into one labelled `IconCombinations` story (same treatment #56 gave Button's boolean permutations); `States` is unchanged. Ladle entry count for this atom: 2 (States, IconCombinations).

## TICKET #149 (2026-08-01) — `options` (select) variant + `button`-row spacing fix

**`options` variant.** Figma models Personen (`3968:10298`) and Eenheid (`3777:3942`/`3740:4275`) as this *same* `Input-field` component with `Trekking-icon: true` — a chevron on an otherwise-plain field — never as a separate `Atom/Dropdown` instance. `RecipePanel.tsx`/`RecipeIngredientRow.tsx` had been building both as `Dropdown` instead (a different, taller, always-open-panel component), the reported styling mismatch. Added a third branch to the `multiline` discriminated union, keyed on a new `options: {value,label}[]` prop (native `<select>`, `placeholderOption` renders a disabled/hidden `<option value="">` for "nothing chosen yet"): reuses the same container/label/trailing-icon shell, `appearance-none` on the `<select>` itself so only the atom's own `trailingIcon` renders (caller passes `trailingIcon="ChevronDown"`, same as any other field — not hardcoded into the atom). Chosen over teaching `Dropdown` a real labelless-closed mode (the option `docs/open-questions.md#recipe-ingredient-row-unit-label-always-shown` left open) because a native `<select>` gives the OS picker on mobile for free — the same "native control over a hand-built one" reasoning `ImageUploadField` already uses for its file input — full keyboard/screen-reader semantics with zero extra code, and a real compact closed state unconditionally (no open/close JS to get right).

**Spacing fix (the reported "Stap met ingredient button heeft onderaan te veel spacing").** Two changes, both scoped to `button`-carrying fields only so a plain `InputField`/`multiline` with no `button` renders pixel-identically to before this ticket (`pnpm test:visual` run against the full suite confirms — see the PR):

1. The leading+text row's own bottom padding (`py-2` → `pt-2` when `button` is present) — Figma's real padding on every fetched instance is `8px 0px 0px 8px` (top-and-left only), and the extra 8px this atom always added at the bottom was invisible until a `button` slot made the row's own box relevant to a fixed-height layout.
2. `multiline` + `button` now sizes the container to Figma's stated **124px** (not the plain-multiline 144px), and the text row uses `flex-1`/`min-h-0` instead of `h-full` so it *shares* that height with the button row below it rather than claiming the full container height and pushing the button off the bottom. The content column also gained `self-stretch` so this fixed height actually reaches the row (the container's own `items-start` — needed so the leading+text column's top aligns with a *taller* trailing-icon column, #44 — otherwise leaves an auto-height child un-stretched).

## TICKET #204 (2026-08-11) — `button-vs-input-active-border` closed, dark values applied

Re-fetched Button/Outline's Active node and this atom's Active node side by side via `get_variable_defs` (not re-guessed from the existing token names): Button/Outline's Active is bound to `color/Stroke/secondary/active` (stone-800, `VariableID:3816:6636`); this atom's Active is bound to `color/Stroke/primary/active` (stone-600, `VariableID:3816:6633`). **Two different, correctly-bound Figma variables** — `Stroke/secondary/*` and `Stroke/primary/*` are distinct collections in the Figma file, not one ramp read inconsistently by two components. `docs/open-questions.md#button-vs-input-active-border` is closed on this finding; `stroke-primary-active` keeps its own name (it was never a divergence to reconcile, just a different variable). Default/Hover/Selected were already confirmed shared with Button/Outline in #68 (`Stroke/primary/default|hover|selected`) and are unaffected here.

Dark values: `stroke-primary-hover`/`-selected`/`-active` (this atom's whole border ramp) get their first real Figma-sourced dark values (stone-500/stone-600/stone-400 respectively, from `Semantics _ Style_Dark.tokens.json`) in place of #56/#58's own picks — no code change needed here since the component was already token-only, no `dark:` utilities. `border-stroke-primary` (Default) was already correctly dark-paired (stone-700) and needed no change.

## TICKET #166 (2026-08-08) — whole box clickable, generically, no JS

User feedback: "Bij 'personen' input field is de chevron down niet klikbaar net als het icoon bij input field 'Item'. Maak het volledige input field klikbaar." Two dead zones reported: the `options`-variant field's trailing chevron (a decorative `Icon`, never the real `<select>`), and `RecipeIngredientRow`'s name field's leading/trailing padding and icon (`onClick` sat only on the `<input>` itself).

**Fix, in this atom only — no caller touched.** The content-row wrapper (leading icon + the input/select/textarea) and the trailing-icon column each changed from a plain `<div>` to a real `<label htmlFor={id}>`. This is a native-HTML, zero-JS fix, so the atom stays a Server Component: clicking anywhere in either label's rendered box (including padding/gaps, not just the icon glyph or text) delegates a `click` to the associated control per standard label-activation behaviour — focuses a text `<input>`/`<textarea>`, opens a native `<select>`'s picker, and fires a `readOnly` input's own `onClick` (e.g. `RecipeIngredientRow`'s name field) exactly as if the control itself had been clicked. `id` is now destructured explicitly (previously flowed through `...props` implicitly) and re-applied to whichever control renders, since it's no longer part of the spread.

**Why two labels, not one wrapping the whole box.** The `button` slot (used by the recipe step field's "Ingrediënt" pill) is deliberately **excluded** from both labels — it renders as a plain sibling `<div>`, unchanged. Reasoning: a `<label>`'s accessible name is computed from its rendered text content, and while the label's *own* referenced control is correctly excluded from that computation (the standard recursion-safe rule the classic `<label>Text <input></label>` pattern already relies on — verified this still holds with a second, separate label pointing at the same id), a **different** interactive descendant nested inside the label — like the "Ingrediënt" `Button`, which has its own visible text — is NOT excluded and would leak into the field's accessible name (e.g. a step's textarea announcing "... Ingrediënt" appended). No caller currently exercises this with visible in-browser assistive-tech tooling, but the risk is structural, not hypothetical, so the two labels are scoped narrowly (content-row, trailing-icon column) rather than wrapping the container div that also holds `button`. A minor, accepted consequence: the outer box's own `p-1` padding and the small gap between the content column and the trailing-icon column (`gap-3`) are not, strictly, inside either label, so a click in that exact few-px margin does not delegate — negligible against the reported bugs (icon/chevron dead zones), which this fully fixes.

**Multiple `<label>`s for one `id` is valid HTML** (a control may have any number of associated labels) — a labelled field now has three: the visible title label (unchanged), the content-row label, and the trailing-icon label, none nested inside another.

## TICKET #205 (2026-08-12): radius/spacing tokens

Measured via `figma_execute`/`boundVariables` on all four states
(Default/Hover/Active/Selected, e.g. 3705:4386/3784:4736/3826:6708/3740:4576)
— byte-identical bindings across all four, confirmed rather than assumed.
Root `gap-2` (8px, VERTICAL) → `gap-stack-sm`
(`itemSpacing`→`spacing/stack/stack-sm`). `Container` frame: `gap-3` (12px)
→ `gap-stack-md`, `rounded-xl` (12px) → `rounded-control-outer`, `p-1` (4px,
all sides) → `p-component-xs`. Note: `Container` is a HORIZONTAL auto-layout
frame whose `itemSpacing` nonetheless binds `spacing/stack/stack-md`, not
`inline/*` — the axis heuristic (`inline`=row, `stack`=column) is a rule of
thumb, not a substitute for reading the actual binding; here Figma's own
authoring crosses it, so the read binding wins. `Content` frame (genuinely
VERTICAL): `gap-3` → `gap-stack-md`, consistent with the axis this time.
`Leading + Text` frame: `gap-2` → `gap-inline-sm`, `pl-2`→`pl-component-sm`,
and the conditional `pt-2`/`py-2`→`pt-component-sm`/`py-component-sm`
(paddingRight/Bottom are unbound-zero in Figma; `py-component-sm`'s bottom
half is this component's own pre-existing, documented deviation from the
literal node — see the `#149` paragraph above — not something this ticket
changes, only re-expresses in tokens). Trailing-icon label: `py-2 pr-2` →
`py-component-sm pr-component-sm` (`Trekking-icon-container`'s
paddingTop/Right/Bottom all bind `spacing/component/padding-sm`).

**Left unconverted, flagged:** the button-row `gap-2` (Figma's `Slot`
node, `itemSpacing`=8, no bound variable) and the trailing-icon label's own
`gap-2` (`Trekking-icon-container`'s `itemSpacing`=8, likewise unbound).
Both read as real gaps in the fetched node's `boundVariables` — not a
missed lookup — so both stay raw pending a designer rebind.

## TICKET #218 (2026-08-12): spacing gate — `p-0` is not a Figma concept

`scripts/check-raw-spacing.sh` (#218) also caught the three native
`<textarea>`/`<select>`/`<input>` elements' own `p-0`. These reset the
browser's UA-stylesheet default padding to zero so the control's text sits
flush inside the already-padded label box — the same reasoning as the
adjacent `border-0 bg-transparent` on each element, neither of which is a
Figma spacing/colour read either. There is no Figma node property this
traces to (Figma text nodes carry no CSS padding), so nothing to convert or
measure — flagged with `spacing-flag:` at each of the three sites rather
than invented a "zero" token for a non-design value. The two genuinely
Figma-sourced `gap-2` gaps above got the same `spacing-flag:` marker added,
no reasoning change.
