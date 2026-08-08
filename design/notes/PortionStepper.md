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

### Ladle story

`components/molecules/PortionStepper.stories.tsx` demonstrates both breakpoints (a `w-[375px]`-constrained mobile wrapper and an unconstrained desktop-width wrapper — both fetched nodes are pixel-identical hug-sized rows, so "mobile vs desktop" here is about surrounding viewport, not a component-level variant) and representative portion values including the 1-vs-plural edge case (1, 2, 6, 12). The count label is resolved through the real `next-intl` ICU engine (`useTranslations`, inside Ladle's already-global `NextIntlClientProvider` — `.ladle/components.tsx`, added for #94) rather than hand-duplicating the plural logic in the story file, so the story can never silently drift from `messages/*.json`. The default Ladle provider is locale `nl`; the story nests its own `<NextIntlClientProvider locale="en" messages={en}>` for the explicit English demonstration story, which is valid provider nesting and needed no new dependency.
