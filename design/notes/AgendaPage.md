# AgendaPage
Claude-designed (#486, #487, #488), ADR-0037, no Figma node · Code: `app/(app)/agenda/` — `page.tsx` (Server: view cookie, today, first window, recipes, baskets), `AgendaPage.tsx` (client state), `AgendaHeader.tsx`, `AgendaBody.tsx`, `AgendaEventPanel.tsx`, `AgendaMealPanel.tsx`, `PlanRecipeList.tsx`, `PlanCardList.tsx`, `AgendaPageSkeleton.tsx`, `loading.tsx`, `actions.ts` (events), `meal-actions.ts` (meal plans), `manifest.webmanifest/route.ts` · Pure helpers: `lib/agenda/time.ts`, `view.ts`, `schemas.ts`, `meals.ts`, `plan-recipes.ts`, `plan-cards.ts`

New components: `PlanDrawer` and `PlanChoices` (own notes). The rest is page composition: `PageHeader`, `ButtonToggle`, `AgendaCalendar`, `SidePanel`, `InputField`, `Checkbox`, `Button`, `DeleteConfirm`, `PortionStepper`, `AnimatedAddToBasketButton`, `Toast`.

## Anatomy
- Header: `PageHeader` with the period as title, then a `ButtonToggle` for Dag/Week/Maand/Lijst, then at the far right "Week naar mand" (`AnimatedAddToBasketButton`, "Week" below `lg`), Vandaag, previous/next and the `Settings` button that opens the calendars panel (`AgendaCalendarsPanel.md`). The title never wraps (`whitespace-nowrap`). From `lg` toggle (`w-96`) and buttons sit in one right-aligned wrapping group: when the page is too narrow for both on a row (sidebar open on a tablet landscape), the buttons drop under the toggle, right-aligned. Below `lg` (tablet portrait counts as mobile) the wrapper is `contents`: title and buttons share a row, the toggle gets its own row with icons only, and the buttons wrap on a 320px phone.
- Body: `AgendaBody` gives the calendar a definite height (`100dvh` minus the chrome, at least 28rem) and `pr-page-right-equal`; the grid scrolls inside. The `PlanDrawer` sits beside it from `lg` and only when the page container is at least 44rem wide (container query; the sidebar and the 128px page padding leave a 1024px viewport only about 570px), under it otherwise.
- Event panel: one persistent `SidePanel` for create (tap or drag an empty slot) and edit; an imported event opens it read-only (disabled fields, no footer, "Uit <agendanaam>" above them). A saved event, imported or own, also shows "Gekoppeld" with its recipes, cards and notes (`AgendaEventLinks.md`). Delete is the two-step `DeleteConfirm`.
- Meal panel (`AgendaMealPanel`, `SidePanel`): recipe (a `Button` that opens the recipe page), moment (select), servings (`PortionStepper`), date (disabled while the meal is attached to an event), "Naar mand" (`AnimatedAddToBasketButton` with the #429 basket popover), Verwijderen (`DeleteConfirm`) and Opslaan. "Naar mand" saves pending edits first so the basket gets the servings on screen.
- Above the calendar: basket notices after a sync deleted an event with a meal (`AgendaSyncNotices`). `page.tsx` also starts the lazy sync in `after()`.
- Clicks: own event opens the event panel; meal opens the meal panel; deadline and planned card open the card in Te doen (`/te-doen?card=<id>`).

## Deliberate decisions
- **Time zone**: one fixed zone, `Europe/Amsterdam` (`AGENDA_TIME_ZONE`), until Atlas stores one per user. The calendar runs in the browser zone and shows wall-clock strings; `spanToUtc` reads them in the Agenda zone. The now line and "today" in the grid follow the browser zone.
- **View per device**: cookie `agenda-view`, so the first paint has the right view. `threeDay` is never stored.
- **Data**: the server renders the month of today plus a week each side (`loadWindow`); leaving it calls `loadAgendaRange` and keeps the old items until the new ones arrive. After a save, delete or plan the window reloads.
- **Drag and resize save at once**: items update optimistically; a refusal calls `revert` and restores the items.
- **Planned cards**: `cards.planned_for` is a date. Dropping a card from the Kaarten tab, picking a day in its plan menu, or dragging a planned item to another day calls `planCard({ cardId, plannedFor })` (`te-doen/actions.ts`; `plannedFor` is required, `null` clears). A planned item always stays an all-day item: dropped on an hour slot it still takes only the date. Dragging it onto the plan drawer (`onItemDropOut`) sets `null`. Access is the cards policies alone, no app-side ownership check (ADR-0035): a refused write reads `read-only`, a card RLS hides reads `not-found`. After a save the drawer's copy of the card and the window reload. Tapping a planned item opens the card in Te doen.
- **Meals are day items**: always all-day, on their date, grouped per moment (breakfast, lunch, dinner, snack) and ordered by `position` in the all-day zone (`compareEventOrder`), never a block on the hour grid. A meal attached to an event takes that event's date, not its time.
- **Planning**: dropping a recipe on a day makes a meal plan (`planned_on`, moment `dinner`, the recipe's servings, last in its group). Dropping it on an event (found by `data-agenda-event-id` under the pointer) attaches it (`calendar_event_id`), so it follows the event. Dragging a meal to another day sets `planned_on` and detaches it. The plan buttons (drawer row, recipe page `...` menu) do the same with a chosen day and moment.
- **Week naar mand**: the visible week (Monday to Monday, from the shown date, also in month view); meals without a basket item (`shopping_list_items.meal_plan_id`) are scaled to their own servings and the same ingredient and unit are summed. A merged line carries the first contributing meal's id (see `docs/open-questions.md#agenda-week-basket-merged-line-attribution`). Nothing to send is an error message (`nothing-to-send`), and the button shows success only after a successful result.
- **Own events only in a manual calendar, synced ones read-only**: `actions.ts` checks both (`read-only`) on top of RLS and maps `42501` to the same code. Errors are codes, never database text (`agenda.errors.*`).
- All-day events are stored as UTC midnights with an exclusive end; the panel shows the last day inclusive.
- `position` is not in the timeline function, so `getAgendaItems` reads it for the meals in one extra query.

## Token gaps and flags
- `h-[calc(100dvh-…)]`, `min-h-[28rem]`, `lg:@min-[44rem]:w-80` and `h-[32rem]` in `AgendaBody` are layout sizes, not scale values.
- No token for a disabled field: read-only inputs look editable; a notice says why.
- Icons borrowed from the closed set: view toggle `Calendar`, `Columns3`, `Table`, `List`; the recipe link uses `CookingPot`.

## Gotchas
- `PageHeaderTitle` morphs the title on every previous/next press.
- The mobile header and bottom-sheet shapes follow the viewport, not the container: Ladle stories only baseline the desktop shape. The "Week" button below `lg` hugs its visible face (the hidden face leaves the flow), so it grows when "Toegevoegd" shows. The week turns into three days below `lg` (`NARROW_QUERY` in `AgendaCalendar`, 1023px).
- `page.tsx` cannot be tried against hosted until the agenda migrations are applied there.
- `getAgendaEvent` and `getMealPlan` are separate reads because `agenda_items` carries no location, description or recipe id.
- A meal whose ingredients were all merged into earlier meals' lines has no basket item of its own, so a second "Week naar mand" would send it again.
