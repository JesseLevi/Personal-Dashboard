# VandaagPage (`/vandaag`)
No Figma node: Claude-designed in code (ADR-0034, ADR-0057) · Code: `app/(app)/vandaag/{page,VandaagPage,VandaagView,loading}.tsx`, `lib/today/{day,home}.ts` · Story: `vandaag--vandaag-page--overview`, `--empty`

## Anatomy
`PageHeader` "Vandaag" with the date line under it, then a grid of titled `Card`s (one column, two from `md`): Afspraken, Eten, Kaarten, Mand, and "Misschien handig" (signals, full width, only when there are any). A "Naar de Agenda" button closes the page.

## Deliberate decisions
- `VandaagView` is presentational (all navigation and actions are props) so Ladle renders it; `VandaagPage` wires the router and server actions.
- Rows are a fixed-width muted label (`w-24`: time, "Hele dag", or meal moment) plus the title, so times line up without a table.
- Planned cards and deadlines use the existing `Tag` variants `highlight` and `urgent`; the Agenda uses the same colours for those kinds.
- "Dag naar mand" is `AnimatedAddToBasketButton` over `sendWeekToBasket` for one day: meals that already have basket items are skipped, so pressing twice adds nothing twice.
- Signals: catalog text for rhythms, stored plain text for patterns (ADR-0046 §1), the signal's own action label, and "Wegklikken". The row hides at once.
- Empty sections keep their card with one muted sentence, so the layout does not jump between days.

## Token gaps and flags
- None new. `w-24` is a sizing utility, not spacing.

## Open
- No per-item links yet (planned cards carry no board id in `agenda_items()`); "Naar de Agenda" covers navigation.
