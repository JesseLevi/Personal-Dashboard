# AgendaPage
Claude-designed (#486), ADR-0037, no Figma node · Code: `app/(app)/agenda/` — `page.tsx` (Server: view cookie, today, first window), `AgendaPage.tsx` (client state), `AgendaHeader.tsx`, `AgendaBody.tsx`, `AgendaEventPanel.tsx`, `AgendaPageSkeleton.tsx`, `loading.tsx`, `actions.ts`, `manifest.webmanifest/route.ts` · Pure helpers: `lib/agenda/time.ts`, `view.ts`, `schemas.ts`

No new component: the page composes `PageHeader`, `ButtonToggle`, `AgendaCalendar`, `SidePanel`, `InputField`, `Checkbox`, `Button`, `DeleteConfirm`. `AgendaHeader`, `AgendaBody` and `AgendaEventPanel` are page-level composition like `TeDoenHeader` and `CardDetailPanel`.

## Anatomy
- Header: `PageHeader` with the period as title (`13–19 okt`, `oktober 2026`, `wo 1 jan`), then Vandaag + previous/next (`ArrowLeft`/`ArrowRight`) and a `ButtonToggle` for Dag/Week/Maand/Lijst (`Calendar`, `Columns3`, `Table`, `List`). The title block, the buttons and the toggle are three flex items (`contents` wrapper). From `md` they share one row (buttons and toggle right, toggle `w-96`). Below `md` the header wraps: row 1 title and buttons, row 2 the toggle with icons only (`ButtonToggle iconOnlyBelowMd`).
- Body: `AgendaBody` gives the calendar a definite height (`100dvh` minus the chrome, at least 28rem) and `pr-page-right-equal`; the grid scrolls inside.
- Panel: one persistent `SidePanel`. Create (tap or drag an empty slot) and edit share it; an imported event opens it read-only (disabled fields, no footer, "Uit <agendanaam>" above them). A saved event, imported or own, also shows "Gekoppeld" with its recipes, cards and notes (design/notes/AgendaEventLinks.md). Fields: title, all day, start/end (`datetime-local`, or `date` when all day, last day inclusive), location, description, calendar (the default calendar, disabled while it is the only one). Delete is the two-step `DeleteConfirm`.
- Clicks: own event opens the panel; deadline and planned card open the card in Te doen (`/te-doen?card=<id>`, which redirects to the card's board and opens its panel); a meal does nothing yet.

## Deliberate decisions
- **Time zone**: one fixed zone, `Europe/Amsterdam` (`AGENDA_TIME_ZONE`), until Atlas stores one per user. The calendar runs in the browser zone and shows the wall-clock strings it is given; its callbacks add the browser's offset. `spanToUtc` drops that offset and reads the wall clock in the Agenda zone, so a browser elsewhere still sees what was typed. The now line and "today" in the grid follow the browser zone.
- **View per device**: a cookie (`agenda-view`), written by the toggle and read by the Server page, so the first paint already has the right view. `threeDay` is never stored: `week` becomes it below `md`.
- **Data**: the server renders the month of today plus a week each side (`loadWindow`); that covers every view. Navigating inside it costs nothing; leaving it calls `loadAgendaRange` and keeps the old items on screen until the new ones arrive (last request wins). After a save or delete the window reloads.
- **Drag and resize save at once**: items update optimistically, `moveEvent` runs, a refusal calls the calendar's `revert` and restores the items. Only manual events move; meals and planned cards revert (not built yet).
- **Own events only in a manual calendar, synced ones read-only**: the database allows a manual event in an imported calendar and deleting a synced event, so `actions.ts` checks both (`read-only`) on top of RLS, and maps the trigger's `42501` to the same code. Errors are codes, never database text; messages under `agenda.errors.*`.
- All-day events are stored as UTC midnights with an exclusive end; the panel shows the last day inclusive.

## Token gaps and flags
- `h-[calc(100dvh-…)]` and `min-h-[28rem]` in `AgendaBody` are layout sizes, not scale values (no spacing-flag needed: the gate covers only radius, gap and padding).
- No token for a disabled field: read-only inputs look like editable ones; the notice above them says why.
- `Button` toggle icons are borrowed from the closed icon set (no day/week glyphs): `Calendar`, `Columns3`, `Table`, `List`.

## Gotchas
- `PageHeaderTitle` morphs the title whenever it changes, so every previous/next press plays the title morph.
- The mobile header and bottom-sheet shapes follow the viewport, not the container: Ladle stories only baseline the desktop shape. Check mobile in a narrow window.
- `page.tsx` cannot be tried against hosted until the agenda migrations are applied there (`agenda_items` does not exist yet).
- `getAgendaEvent` is a separate read because `agenda_items` carries no location or description.
