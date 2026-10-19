# ADR-0042: Recurring own events as materialised series

**Status**: Accepted (user decision, 2026-10-18, #527). Amends ADR-0037 §11.

## Context

- ADR-0037 §11 left recurrence rules for manual events out of scope. The user now wants to repeat an own event every day, week, two weeks, month or year.
- Imported recurring events are already stored as one row per instance (ADR-0037 §5). Links, attached meals, dragging and the timeline function `agenda_items()` all work per row.
- Expanding a rule at query time would leave an occurrence without its own id, so links and meal plans could not attach to one occurrence.

## Decision

1. **The rule**: `freq` `daily|weekly|monthly|yearly`, `interval` 1–99, and an end that is either none or a date (`until`, inclusive). The UI offers every day, every week, every two weeks, every month and every year. Monthly repeats on the day of the month and yearly on the date; a month without that day is skipped, as RFC 5545 does, so a later ICS export matches.
2. **Storage**: a `calendar_event_series` row holds the rule and the template: calendar, title, location, description, all-day, start time, duration and time zone (`Europe/Amsterdam`). Each occurrence is an ordinary `calendar_events` row (`source = 'manual'`) with `series_id`, `occurrence_on` (its original date, unique per series) and `series_detached`.
3. **Horizon**: occurrences exist up to 400 days ahead, the sync window. Opening the Agenda extends series that fall short, in `after()` with the user's client (ADR-0039's lazy shape). No cron: nothing outside Atlas changes a series.
4. **Wall-clock time**: occurrences are generated in the series' time zone, so 09:00 stays 09:00 across daylight saving.
5. **Edit scope**, asked when saving a changed occurrence in the panel:
   - **Alleen deze**: updates the row and sets `series_detached`; extension never touches it again;
   - **Deze en volgende**: ends the series the day before and starts a new one from this occurrence. Later occurrences that are not detached move to the new series and keep their ids, so links survive;
   - **Alle**: updates the series and every occurrence from today on that is not detached. Past occurrences stay as history.
   
   Dragging and resizing change one occurrence (Alleen deze).
6. **Delete scope** uses the same three choices. A single deleted occurrence is added to the series' `excluded_on` dates, so extension does not bring it back. "Deze en volgende" ends the series; "Alle" deletes the series with all its occurrences.
7. **Writes are `security invoker` RPCs** (ADR-0015 form): create, update with scope, delete with scope, and extend. Access follows the calendar through `private.calendar_role()`, as for `calendar_events`. The new table ships with RLS, grants and a pgTAP test.
8. Imported events are unchanged: `ical.js` keeps expanding them, and no rule is stored for them.

## Consequences

- An endless daily series holds about 400 future rows, a weekly one about 57. "Alle" rewrites those rows.
- Links and meal plans attach to a single occurrence, exactly as on an imported instance.
- Not yet possible: weekdays only, "every second Tuesday", several weekdays per week. Each fits the rule table later.
