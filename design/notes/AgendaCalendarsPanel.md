# AgendaCalendarsPanel and AgendaSyncNotices
Claude-designed (#490), ADR-0037 §5–7, ADR-0039, no Figma node · Code: `app/(app)/agenda/` — `AgendaCalendarsPanel.tsx`, `AgendaSyncNotices.tsx`, `calendars-actions.ts` · Server: `lib/agenda/sync.ts`, `notices.ts`, `app/api/cron/calendar-sync/route.ts` · Pure: `lib/agenda/ics.ts`, `calendars.ts`, `cron-auth.ts`

No new component, no new token: both are page-level composition of `SidePanel`, `Card`, `CardContentTicket`, `Tag`, `InputField`, `Button` and `DeleteConfirm`, like `AgendaEventPanel`. Nothing existing fitted a status row better than a `Card` with a ticket body (title plus slot).

## Anatomy
- **Entry**: a `Settings` icon `Button` in `AgendaHeader` (`onOpenCalendars`), after previous/next. Without the prop the button is absent.
- **Panel** (one persistent `SidePanel`, title "Agenda's" for assistive tech only):
  - "Gekoppelde agenda's": one `Card` per account. `CardContentTicket` title is the name; the slot holds a status `Tag` and an icon-only destructive `Trash` button. Tag: `low` for synced (relative time), `urgent` for failed (reason), `neutral` for never synced.
  - "ICS-link toevoegen": name, link (`Link` leading icon, no autocomplete), the privacy line, and the three "where do I find the link" lines (Outlook, Google, iCloud).
  - Footer: filled "Toevoegen"; when a trash button was pressed it becomes the stacked `DeleteConfirm` naming the calendar. Deleting cascades the imported events, links and meal plans; the calendar itself is untouched.
- **Notices**: above the calendar, one `Card` per deleted event whose meal left open basket items. The ticket title is one sentence with the event title and the item names (`Intl.ListFormat`, six names, then "en N andere"); the slot holds "Weghalen" (`Trash`) and "Laten staan" (`X`). Both dismiss the notice; only "Weghalen" deletes the listed items that are still open.

## Deliberate decisions
- **The link goes in once and never comes back.** `addIcsCalendar` fetches and parses first (a link that fails never becomes an account), then `create_ics_calendar` stores it in Vault. No view, action result, `sync_state` value or log line carries it. Failures are codes (`fetch_timeout`, `unparsable`, `empty`, `drop`, …) that the panel translates (`syncErrors.*`).
- **`webcal://` is accepted** and turned into `https://`; everything else but https is refused, then `safe-fetch` guards the fetch.
- **Failure states are visible, not silent.** A failed sync leaves the events alone and shows the reason on the Tag. Known limit: a feed that legitimately lost more than half of its window stays "failed" until the feed grows back; there is no override yet (`docs/open-questions.md`).
- **Notices are a table, not derived.** Deleting a meal plan sets `shopping_list_items.meal_plan_id` to null, so the link to the basket items is gone afterwards. `calendar_sync_notices` keeps the ids; the page lists the ones still open. Only the definer function writes a notice, and only when an open item exists.
- **Triggers**: opening the Agenda syncs the user's own accounts older than an hour in `after()`, so the page never waits. The daily cron route handles the rest (ADR-0039).
- Status time is relative (`Intl.RelativeTimeFormat`); the visual suite freezes the clock at 2026-01-01 14:00.

## Token gaps and flags
- Inherits `CardContentTicket`'s raw `gap-4`/`gap-2` (flagged in its own note). The status `Tag` is a pill with `h-10`, so a long failure reason wraps inside the card.
- The help lines are plain text: there is no external-link style, and the three providers' menus change names, so they name the path rather than link.

## Gotchas
- Stories pass mock actions and `initialAccounts`; the panel never imports the `"use server"` module, and still calls `onList` on open.
- The panel is `position: fixed`: stories wrap it in `min-h-screen`.
- Mobile shape (bottom sheet) follows the viewport; Ladle baselines cover desktop only.
- Notices come from `getSyncNotices()` in `page.tsx`; a sync that finishes after the response shows its notice on the next visit.
