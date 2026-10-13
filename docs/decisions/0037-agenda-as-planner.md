# ADR-0037: Agenda as Atlas's planner, with external calendars as imports

**Status**: Accepted (user decision, 2026-10-13, #33). **Supersedes** ADR-0008.

## Context

- ADR-0008 scoped Phase 7 as read-only calendar sync plus a calendar view. Planning Atlas's own things on dates was "Later" (`Vision.md`: Weekmenu).
- The user wants the Agenda to be where modules meet: plan a recipe on Thursday and send its ingredients to a basket, plan a card on Saturday, and attach recipes, cards and notes to any event, including ones imported from Outlook or Apple Calendar.
- External calendars stay where events are made and invitations arrive. Atlas does not replace them.
- ADR-0008 claimed CalDAV covers Outlook. It does not: Outlook / Microsoft 365 offers a published ICS link or Microsoft Graph, not CalDAV.

## Decision

1. **The Agenda is one timeline over several sources.** Each module owns its own dated data, and nothing is copied into `calendar_events`. The sources are:
   - `calendar_events` with `source = 'manual'`, which are fully editable;
   - `calendar_events` with `source = 'sync'`. Their source fields (title, times, location, description) are read-only in Atlas, and Atlas never writes back;
   - `meal_plans` (new);
   - `cards.planned_for` (new `date`, nullable): the day you intend to do it, separate from the deadline `due_at`;
   - `cards.due_at` as a deadline overlay at query time (unchanged from ADR-0008).
2. **`calendars` is the container** (ADR-0035). Every event and every meal plan has a `calendar_id`.
   - Each user gets one default calendar, seeded per ADR-0017.
   - An imported feed is its own calendar, tied to a `calendar_accounts` row that holds the credentials in Vault (ADR-0002).
   - Sharing a calendar later shares its events and its meal plans.
3. **Meal planning is part of Phase 7**, not "Later".
   - A `meal_plans` row has a `recipe_id`, `servings`, a `slot` (`breakfast|lunch|dinner|snack`, text with a check constraint; snack covers cake and biscuits), and either a `planned_on` date or a `calendar_event_id`, enforced by `num_nonnulls(planned_on, calendar_event_id) = 1`.
   - An attached meal plan takes its date from the event at query time, so it follows a moved event.
   - "Naar mand" reuses the existing recipe → basket path, scaled to `servings`, in a basket the user picks. Basket items record the meal plan they came from (nullable `meal_plan_id`, `on delete set null`).
4. **Links on any event, imported ones included.** `calendar_event_links` uses an exclusive arc, as `shares` does: `calendar_event_id` plus exactly one of `card_id`, `recipe_id` or `note_id`, all FKs with `on delete cascade`.
   - The link belongs to Atlas, and RLS requires that the user can read both ends.
   - Deleting an event removes its links and its attached meal plans. The card, recipe and note themselves are never deleted.
5. **The sync keeps identity stable, and deletes only safely.**
   - It upserts on `(calendar_account_id, external_id)` and never deletes and re-inserts, so links survive.
   - For an expanded recurring instance, `external_id` is the UID plus that instance's start (RECURRENCE-ID).
   - A failed, empty or unparsable fetch counts as a failed sync and deletes nothing. A drop of more than half the events in the window also counts as a failure. Either way, the sync is recorded in `sync_state`.
   - An event missing from the feed gets `missing_since`. It is deleted only when the next successful sync still misses it, so after two consecutive misses.
   - Only events inside the sync window (−30 d / +400 d) can count as missing.
   - Synced events that fall behind the window are kept, not pruned: they are the history later patterns come from, at a few MB per user per year.
   - A row is written only when its content hash changed, so a sync of an unchanged feed writes nothing. Descriptions are capped at 2,000 characters.
6. **Basket items are never removed by the sync.** When a deleted event takes a meal plan with it, the user gets a dismissable notice listing the open basket items that came from that meal plan, and decides what to remove.
7. **Providers, in order:**
   - `ics` covers Outlook's published link, Google's secret iCal address and iCloud public calendars;
   - `caldav` (`tsdav`) covers iCloud, Nextcloud and Fastmail;
   - Microsoft Graph or Google OAuth come only when ICS falls short for a real need, each in its own ticket.
   
   Every user-supplied URL goes through `safe-fetch` (ADR-0019 §5). Recurring events are expanded within the window, with no RRULE evaluation in the app.
8. **UI library: FullCalendar, standard (MIT) packages only**: `daygrid`, `timegrid`, `list` and `interaction`. This replaces Schedule-X: its drag-and-drop, resize, drag-to-create and interactive event modal are paid premium plugins, and planning by dragging is the core of this ADR. FullCalendar's premium packages (resource and timeline views) are not used.
   - Version 7 (`fullcalendar` + `@fullcalendar/react`, peer `temporal-polyfill`).
   - Recipes and cards are dragged onto days with `interaction`'s external dragging. It works on any DOM element, independent of our dnd-kit, and on touch: mobile plans by dragging too, from a tray of recipes and cards below the calendar.
   - Styled through v7's class-name settings with Tailwind utilities and semantic tokens. The shadcn theme registry is not used, since Atlas is not on shadcn. Claude designs the UI in code (ADR-0034).
   - Alternatives weighed on 2026-10-13: ilamy (MIT, Tailwind/shadcn) brings a second dnd-kit generation, Radix and its own lucide, and documents no external drop; Event Calendar (vkurko, MIT) runs on Svelte; react-big-calendar carries moment/globalize/lodash and its own CSS; a self-built time grid costs more upkeep than one maintainer should carry.
9. **Software, all open source:**
   - storage in plain Supabase Postgres tables, with no separate calendar server;
   - `ical.js` (MPL-2.0) to parse ICS and expand recurrences, including EXDATE and RECURRENCE-ID exceptions and time zones;
   - `tsdav` (MIT) for CalDAV.
10. **Kept from ADR-0008:**
   - deleting a calendar account cascades its synced events.
11. **Out of scope:** two-way sync, sending invitations, and recurrence rules for manual events. Each needs a new ADR.

## Consequences

- Phase 7 grows with meal planning and card planning. In return, the Agenda connects Recepten, Winkelmand and Te doen instead of being a standalone view.
- The query behind the timeline unions five sources. It should be one `security invoker` function, so RLS applies to every branch.
- A wrongly detected deletion costs at most one sync interval of delay, and never a silent loss of plans.
- The runtime for scheduled sync is still open (`Architecture.md` §6, open decision 1). Because of the two-miss rule, deletions land after two sync intervals.
- The notice store for point 6 is decided in its ticket: owner-only RLS, holding the event title and the affected item ids.
