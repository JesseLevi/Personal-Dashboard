# Portion-stepper
Figma: unnamed "Frame 1" · nodes `3953:9750` (mobile) / `3778:5596` (desktop), pixel-identical; restyled after the Pas-aan panel's Personen row `3999:11007` (desktop) / `3998:10928` (mobile) · Code: `components/molecules/PortionStepper.tsx`

## Anatomy
Presentational molecule (no `"use client"`, no `useTranslations`): a pill wrapper `inline-flex h-10 items-center gap-1 rounded-control bg-surface-secondary` containing an icon-only `Button` (`Minus`), a count `<span>` (`text-sm font-semibold text-text-secondary`, matching `Button`'s label) and an icon-only `Button` (`Plus`). Props: `portions`, `label`, `decrementLabel`, `incrementLabel`, `onChange?`, `min` (default 1), `className`. Only consumer: `PasAanPanel`.

## Deliberate decisions
- One visual pill, structurally two buttons. Figma's Personen row is a single `Button/Default` (Filled, leading icon, text "6", trailing icon), but a `<button>` cannot nest two buttons and decrement/increment need separate targets (`Atom/Dropdown` documents the same HTML constraint). The wrapper repeats Button's Filled classes, so the inner Filled Buttons blend into it at rest and keep their own hover/active ramp. (#166)
- Left icon is `Minus` although Figma draws `Icon/Plus` on both sides (seen on the original nodes, the Pas-aan node and `3999:11007`). Read literally, "decrement" would visually add; treated as a Figma authoring error. No `Icon/Minus` exists in the file; lucide's `Minus` is a single horizontal stroke matching the bar of `Icon/Plus`. The open question `portion-stepper-figma-draws-plus-twice` is resolved. (#123)
- Single `onChange(next: number)` instead of `onIncrement`/`onDecrement`: the component is controlled (`portions` prop), so reporting the target value costs nothing, needs no direction-to-delta translation, and mirrors `ButtonToggle`'s `onValueChange`. (#123)
- `min` lives on the stepper, not in the caller: it already owns the `portions +/- 1` math, and the disabled affordance has to sit next to the button. `atMin = portions <= min` disables the left Button; the click also clamps with `Math.max(min, portions - 1)` so the contract holds if the handler is called programmatically. Default 1 was a user ruling ("Personen teller kan naar -x"), not read from Figma. (#153)
- The pill must not carry a border box: a bordered "Input-field state parity" wrapper was tried (#166 round 1) and replaced by the Filled-Button treatment once the real node was fetched; Figma has no bordered variant. (#166)
- All strings arrive pre-translated (`label`, `decrementLabel`, `incrementLabel`), like `CardContentIngredient`'s `deleteLabel`: interactivity and i18n resolution stay in the composing organism. Catalog `components.portionStepper`: `count` is an ICU cardinal plural (never a manual `n === 1` branch, ADR-0007). English wording is "N people" (Dutch is "N personen"), with button labels using the same noun. (#153)
- The Dev Mode annotation on `3953:9750` ("Changes the amounts for each ingredient") describes the scaling behaviour wired by the recipe detail page, not this component. (#123)

## Token gaps and flags
- `rounded-lg` -> `rounded-control` by stated equivalence with `Atom/Button` (whose `rounded-lg` is bound to `radius/control`), not a measurement of `3953:9750`. (#205)
- `gap-1` stays raw (`spacing-flag` in code): Button's own root `gap-1` is unbound in Figma, and the wrapper mirrors it. Node `3953:9750` has `itemSpacing: 24` (unbound), which does not match the rendered 4px; expected, since the wrapper deliberately does not follow that node. The flag comment sits directly above the `className` string so `scripts/check-raw-spacing.sh` can see it. (#205, #218)

## Gotchas
- Ladle `PortionStepper.stories.tsx` resolves the count label through the real `next-intl` ICU engine (not hand-written plural logic) and nests its own `NextIntlClientProvider locale="en"` for the English story; the `portions={1}` fixture exercises the disabled-at-floor state.
