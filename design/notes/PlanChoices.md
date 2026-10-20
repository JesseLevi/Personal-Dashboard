# PlanChoices
Claude-designed (#487), ADR-0037 §3, no Figma node · Code: `components/molecules/PlanChoices.tsx` · Pure helpers: `lib/agenda/meals.ts` (`planDays`, `DEFAULT_MEAL_SLOT`, `slotForCategoryName`, `defaultSlotForCategory`)

## Why a new component
No existing component offers "pick a day and a moment". It is the body of a menu, used in two places (the recipe page's `...` menu and the plan drawer's row), so it is a molecule with the rows only; each caller supplies the popover.

## Anatomy
Renders a fragment meant for a labelless `Dropdown` (`shadow-sm`, `w-64`): optional `header` row (the recipe page passes a back `Button`), a "Moment" select `InputField` (starts on the recipe category's moment, else Diner), white `Button` rows for today, tomorrow and the three days after (`planDays`), then an "Andere datum" `InputField type="date"` (min today) with a filled "Plannen" `Button`, and an error line.

Props: `today` (`YYYY-MM-DD`, Agenda zone), `onPlan(plannedOn, slot) => Promise<AgendaActionResult>`, `onPlanned(plannedOn, slot)`, `header?`, `defaultSlot?` (the moment the select starts on; default `DEFAULT_MEAL_SLOT`; callers pass `defaultSlotForCategory(<category name>)` so a recipe starts on its category's moment, still changeable), `showSlot?` (default true; the card list turns it off, because a card has no moment, and ignores the `slot` argument). A day row plans immediately with the chosen moment; the other date waits for "Plannen".

## Deliberate decisions
- Success is reported only after `onPlan` resolves with `success: true`; a failure shows its code's message (`agenda.errors.*`) in the menu and the menu stays open. The caller shows the confirmation (a `Toast`: "Gepland als diner op donderdag 15 jan").
- The moment is a select, not a segmented control: four labelled options do not fit the popover width.
- In the recipe page the `...` menu swaps to these rows with a back row ("Plannen"), instead of opening a second popover.
- `today` is computed by the caller from `todayInAgendaZone()`; the menu renders only after a click, so there is no hydration mismatch.

## Token gaps and flags
- No disabled style for the date field while pending; the buttons use `disabled`.
- The Icon set has no `CalendarPlus`; rows use `Calendar`.

## Gotchas
- A native date input fires `change` per keystroke on desktop, which is why "Andere datum" has a confirm button instead of planning on change.
- Not covered by the visual baseline: the error line and the pending state.
