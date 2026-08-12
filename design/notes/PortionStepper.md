# Portion-stepper

- **Code:** `components/molecules/PortionStepper.tsx`
- **Node ID:** `3953:9750` (mobile) / `3778:5596` (desktop) — pixel-identical, both unnamed ("Frame 1") in Figma; no component name to inherit, so #123's own Dutch translation ("portie-stepper") names the file.

## TICKET #123 (2026-07-31)

Built as the presentational shell for the recipe detail page's portion row; #128 wires it to the actual scaling function from #120. Both fetched nodes: `FRAME`, row, `gap: 24px`, `sizing: hug/hug`, `justifyContent/alignItems: center` → `inline-flex items-center gap-6` (gap-6 = 24px). Children, both nodes identical:

- Two `Button/Default` instances, `Style=Filled, State=Default, Alignment=Center` (`componentId 3623:4344`), `fills: #E7E5E4` (stone-200), `borderRadius: 8px`, `padding: 0px 8px`, `sizing: horizontal hug / vertical fixed`, `height: 40`, `Leading icon: true`, `With text: false` (icon-only). Hug width with a 24px icon + 8px each side = 40 → renders as a 40×40 square. **Measured, not assumed**: `#E7E5E4` = `stone-200` = the same `bg-surface-raised` token `Atom/Button`'s `filled` variant already uses (`design/tokens.json`), `8px` radius = the `rounded-lg` already baked into `buttonVariants`, and icon-only + omitted `size` already auto-resolves to `Button`'s internal `iconOnlyDefault` (40×40 square, `justify-center`) — so the correct call is the plain default: `<Button icon="..." aria-label="..." onClick={...} />`, no `variant`/`size` override needed. This is a genuine measurement outcome, not a copy of `CardContainer`'s `variant="filled"` by assumption (the ticket's own caution) — it happens to land on the same variant because the pixels say so.
- One `TEXT` node, `text-xl/semibold` (Inter, 600, 20px/28px), `fills: #0C0A09` (stone-950) = the `text-text` token (`design/tokens.json`: `text.light = {primitive.color.stone-950}`) → `text-xl font-semibold text-text`, matching `CardContentIngredient.md`'s precedent for the same fill.
- Both `Icon` children are `Icon/Plus` (`3629:149`, 24×24) — see DEVIATION below.

Dev Mode annotation (fetched via the REST API per `docs/guides/ui-components.md`, since the MCP payload drops it) exists only on the mobile node `3953:9750`: **"Changes the amounts for each ingredient."** This describes the eventual scaling *behaviour* (#128's job), not this ticket's wiring — the desktop node carries no annotation at all.

### DEVIATION — `Minus` instead of `Icon/Plus` on the left button

Both nodes draw the identical `Icon/Plus` component on both sides; there is no minus/decrement glyph anywhere in either node. Read literally, the "decrement" button would visually add. #123 treats this as a design error, not a literal spec, and substitutes lucide's `Minus` for the left button only — a deliberate, functionally-motivated deviation, flagged per `CLAUDE.md` rather than silently corrected. Full reasoning: `docs/open-questions.md#portion-stepper-figma-draws-plus-twice`. `Minus` itself has no Figma node to verify against (no `Icon/Minus` exists anywhere in the file); verification instead confirmed lucide's `Minus` export is a genuine single horizontal stroke (`design/notes/Icon.md`'s #123 entry), coordinate-identical to the horizontal bar of Figma's own `Icon/Plus`.

### Callback shape: `onChange(next: number)`, not `onIncrement`/`onDecrement`

Chose a single `onChange?: (next: number) => void`, mirroring `ButtonToggle`'s `onValueChange?: (value: string) => void` — this codebase's only other existing "stepper-shaped" callback precedent (`Dropdown`'s `onClick`-based trigger pattern is a disclosure toggle, not a value change, so it isn't directly comparable). Both buttons compute their own target (`portions - 1` / `portions + 1`) and report it through the one callback, rather than exposing two no-argument `onIncrement`/`onDecrement` handlers. Reasoning:

- `PortionStepper` doesn't own the count (it's a controlled, presentational `portions: number` prop, same as `ButtonToggle`'s controlled `value`) — the caller already needs to know the current value to pass it in, so reporting the *target* value costs nothing extra and lets `onChange` be the single seam #128 wires to the recipe scaler, with no direction-vs-delta translation needed on either side.
- Matches the native `<input type="number">`/`<input type="range">` idiom (`onChange` with the new value) that `ButtonToggle` already follows for this codebase's other "pick the next state" control.
- Two separate callbacks would make the *same* piece of information (the delta) implicit in which prop fired, rather than explicit in the payload — `onChange(next)` is self-documenting about intent at every call site.

No `min`/`max` clamping or `disabled` state was added at #123: neither fetched node shows a disabled/bounded state for either button, and `CLAUDE.md` forbids inventing states Figma doesn't contain. Bounding portions at a sane floor was left to #128/a future ticket.

## #153 (2026-08-02): `min` prop, floor of 1 — closes the #123 open item

User feedback: "Personen teller kan op dit moment naar -x personen. Minimale moet 1 zijn." Added `min?: number` (default `1`) directly on `PortionStepper` rather than clamping in `RecipeDetailPage`'s `onChange`:

- **Why the atom, not the caller.** `PortionStepper` is presentational but already owns the decrement/increment math (`portions - 1`/`portions + 1`) — the floor is the same category of concern (what a legal next-value even is), not a page-level business rule. Putting it here means every current and future caller gets the floor for free and can't forget to clamp, and the *disabled* affordance (which must live next to the button it disables) has nowhere else sensible to go.
- **Shape**: `atMin = portions <= min`; decrement's `onClick` computes `Math.max(min, portions - 1)` (belt-and-braces — `disabled` already blocks the click, but the clamp keeps the callback contract correct even if a caller ever calls the handler programmatically) and the left `Button` gets `disabled={atMin}`. No change to increment.
- Still no Figma-sourced disabled state (unchanged fact from #123) — this is a user-ruled product decision, not a design read, same as the deviation this file already tracks for the Minus icon. Not re-flagged as a new open question since the user gave a direct, unambiguous ruling (unlike the icon substitution, which had no explicit user sign-off at the time).
- `RecipeDetailPage.tsx` needed no change to enforce the floor (`design/notes/RecipeDetailPage.md`'s own #153 entry) — it still passes a plain `useState`/`onChange` pair, now safe by construction.
- `PortionStepper.stories.tsx` needed no new story: `RepresentativeValues`' existing `portions={1}` case now exercises the disabled-at-floor state directly (default `min={1}` applies), so the clamp is already demonstrated by an existing fixture rather than a new one.

### i18n

`components.portionStepper` (`messages/en.json` / `messages/nl.json`): `count` (ICU cardinal plural, NOT a manual `n === 1 ? … : …` branch — see ADR-0007), `decrementLabel`, `incrementLabel`. `PortionStepper` itself stays presentational (no `useTranslations` call, no `"use client"`) and receives all three as pre-translated props — same idiom as `CardContentIngredient`'s `deleteLabel`, chosen over #94's `CardDetailPanel` precedent (which calls `useTranslations` directly) because this is a plain molecule, not page-level composition; Server Component discipline (`docs/guides/ui-components.md`) keeps interactivity/i18n resolution at the composing organism.

English wording: **"N people"** (not "N portions"/"servings") — the Dutch source text is literally "N personen" (people), and the recipe-scaling context (#120/#128) is about diner count, not an abstract portion unit, so "people" is the direct, unforced translation. The two button `aria-label`s follow the same noun ("number of people") rather than "portions", so a screen-reader user pressing "Increase number of people" and then hearing the count update stays terminologically consistent — mismatching the accessible name's noun from the visible label's noun would be its own small usability bug.

## TICKET #166 (2026-08-08) — bordered box + Input-field state parity

User feedback: "Geef afbeelding en personen input fields zelfde hover, active etc. states als text input field" — named this component directly (alongside `ImageUploadField`, `design/notes/ImageUploadField.md`'s own #166 entry). Neither fetched node (`3953:9750`/`3778:5596`) draws a bordered box around the two Buttons + count — the component was, and structurally still is, just an `inline-flex` row — so this is a **ticket-instructed parity fix with no Figma source of its own**, flagged here rather than silently presented as a Figma read. Wrapped the existing row in `rounded-xl border border-border bg-surface p-1 transition-colors hover:border-border-hover active:border-border-input-active focus-within:border-border-selected` — the exact same classes/tokens `Atom/Input-field`'s own bordered box uses (`InputField.tsx`), so "same states as the text input field" is literal, not approximate. `focus-within` fires when either Button receives keyboard focus (both are real `<button>`s); no JS/state needed, stays a Server Component. Only call site (`PasAanPanel.tsx`) needed no change — the new box nests inside that row's existing layout without adjustment.

Also relevant, not touched: the `Atom/Button` children now sit inside a **second** rounded/bordered ancestor for the first time (previously always a bare row) — measured no visual conflict (Buttons keep their own `rounded-lg` fill inside the new `rounded-xl` box, same nesting shape `Card.tsx` already uses for its own `rounded-xl` wrapper around `rounded-3xl` `CardContentIngredient` rows).

## TICKET #166 round 2 (2026-08-08) — one filled Button pill, not a bordered box

User feedback: "Button van feedback punt 2 is de personen button. Zou een regular button moeten zijn met leading + trekking icon design. Functionaliteit blijft wel hetzelfde met + - personen aanpassen." Node fetched live: `3999:11007` (desktop Pas-aan panel "Card", the Personen row's `Button/Default` instance) — supersedes round 1's ticket-instructed bordered-box parity fix (the "TICKET #166" entry above this one), which had no Figma source of its own and is now removed by a real one.

**The fetched instance is structurally identical to `Atom/Button`'s own labelled rendering.** `componentId 3623:4344` (Style=Filled, State=Default), `Leading icon: true` (`Icon/Plus`), `With text: true` (`Text: "6"`), `Trekking icon: true` (`Icon/Plus`) — root layout `padding: 0px 8px, gap: 4px, height: 40`, fill `#E7E5E4` (`bg-surface-raised`), `borderRadius: 8px` (`rounded-lg`), text fill `#79716B` (`text-text-muted`) at `text-base/semibold`. This is pixel-for-pixel `Button.tsx`'s own `filled`/default-size classes (`h-10 px-2 gap-1 rounded-lg bg-surface-raised text-text-muted text-base font-semibold`) rendered with `icon="Minus" trailingIcon="Plus"` — i.e. Figma now draws Personen as one ordinary Button instance, not a custom control.

**DEVIATION recurs: both icon slots are `Icon/Plus` again**, same root Figma-authoring issue `docs/open-questions.md#portion-stepper-figma-draws-plus-twice` already names (this is the same open question's third occurrence — #123's own two-button nodes, `PasAanPanel`'s round-1 discovery of the same pattern on this same node, and now this). Left renders `Minus`, unchanged reasoning.

**Still two real buttons, not one `<button>`.** The user's own stated functionality ("+ - personen aanpassen") needs two independent click targets (decrement/increment), and a `<button>` cannot nest two more `<button>`s — `Atom/Dropdown`'s header comment documents the identical HTML constraint for its own trigger. So this renders two ordinary icon-only `Button`s (unchanged from #123 — same `icon="Minus"`/`icon="Plus"`, same `aria-label`s, same `min`-floor disable logic) inside a wrapper styled with **the exact same classes** `Atom/Button`'s Filled variant uses for the pill: `inline-flex h-10 items-center gap-1 rounded-lg bg-surface-raised`. Both icon-only Buttons default to Filled too (`bg-surface-raised`, unchanged, no variant override), so at rest they visually blend into the wrapper's own identical fill — no border, no seam — and independently show Filled's own `hover:bg-surface-raised-hover`/`active:bg-surface-raised-active` on press, giving real per-icon pointer feedback the static Figma mock can't show. The count `<span>` between them now reads `text-base font-semibold text-text-muted` (down from the old `text-xl font-semibold text-text`) to match the fetched node's own bound "Text" styling — the number is literally rendered through Button's own text slot in Figma, not a separate larger display number.

**Round-1's bordered-box parity fix is gone.** That box (`rounded-xl border ... hover:border-border-hover active:border-border-input-active focus-within:border-border-selected`, matching `Atom/Input-field`'s states) was itself flagged as having no Figma source; this round's real fetch supersedes it with a genuinely Figma-sourced treatment (Button's own Filled ramp) that happens to need no bespoke hover/active/focus-within classes at all — the two inner `Button`s already carry theirs.

Only consumer, unchanged: `PasAanPanel.tsx` (no other call site — confirmed by grep before editing; `RecipeDetailPage.tsx`/`IngredientSearchPanel.stories.tsx` only mention `PortionStepper` in comments, never render it). No caller change needed — same props (`portions`/`label`/`decrementLabel`/`incrementLabel`/`onChange`/`min`/`className`), only the internal markup/classes changed.

### Ladle story

`components/molecules/PortionStepper.stories.tsx` demonstrates both breakpoints (a `w-[375px]`-constrained mobile wrapper and an unconstrained desktop-width wrapper — both fetched nodes are pixel-identical hug-sized rows, so "mobile vs desktop" here is about surrounding viewport, not a component-level variant) and representative portion values including the 1-vs-plural edge case (1, 2, 6, 12). The count label is resolved through the real `next-intl` ICU engine (`useTranslations`, inside Ladle's already-global `NextIntlClientProvider` — `.ladle/components.tsx`, added for #94) rather than hand-duplicating the plural logic in the story file, so the story can never silently drift from `messages/*.json`. The default Ladle provider is locale `nl`; the story nests its own `<NextIntlClientProvider locale="en" messages={en}>` for the explicit English demonstration story, which is valid provider nesting and needed no new dependency.

## TICKET #205 (2026-08-12): radius token

`rounded-lg` → `rounded-control`. Not sourced from the map's own registered
node (3953:9750/3778:5596) — this file's own header comment already flags
that the wrapper was deliberately restyled away from that sample to mirror
`Atom/Button`'s Filled style exactly (`h-10`/`gap-1`/`px-2`/`rounded-lg`/
`bg-surface-secondary`, verbatim). Since Button's own `rounded-lg` was
independently measured and bound to `radius/control` (see
design/notes/Button.md's #205 entry), and this component declares itself
byte-for-byte the same style, the same token applies here by that stated
equivalence, not a fresh measurement of 3953:9750. `gap-1` stays raw for
the same reason: Button's own root `gap-1` is unbound in Figma (see
Button.md), and this wrapper mirrors that exactly.

Not converted: `gap-1`'s literal Figma value on node 3953:9750 (itemSpacing
24, unbound) does not match the rendered 4px — expected, not a discrepancy
to chase, since the header comment already establishes this wrapper
deliberately does not follow that node.

## TICKET #218 (2026-08-12): spacing gate

`scripts/check-raw-spacing.sh` now enforces an explicit `spacing-flag:`
marker directly adjacent to the flagged line — the header doc above already
carried this reasoning but sits too far from the `gap-1` class string
(separated by the component's props/function code) for the gate to see, so
a new short pointer comment was added at the actual `className` call
instead. No reasoning changed.
