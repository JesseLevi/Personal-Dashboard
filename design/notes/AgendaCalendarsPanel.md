# AgendaCalendarsPanel and AgendaSyncNotices
Claude-designed (#490, #532), ADR-0037 §5–7, ADR-0039, ADR-0040, no Figma node · Code: `app/(app)/agenda/` — `AgendaCalendarsPanel.tsx`, `AgendaSyncNotices.tsx`, `calendars-actions.ts` · Server: `lib/agenda/calendar-list.ts`, `sync.ts`, `notices.ts`, `app/api/cron/calendar-sync/route.ts` · Pure: `lib/agenda/ics.ts`, `calendars.ts`, `colors.ts`, `hidden.ts`, `cron-auth.ts`

No new token. The panel composes `SidePanel`, `Checkbox`, `InputField`, `Button`, `DeleteConfirm` and the new `ColorSwatches` / `ColorDot` (own note); the notices compose `Card` and `CardContentTicket`.

## Anatomy
- **Entry**: the "Agenda's en categorieën" item of the header's ⋯ menu (`AgendaMoreMenu`, `onOpenCalendars`). Without the prop the item is absent.
- **Panel** (one persistent `SidePanel`, title "Agenda's en categorieën"). Every row is a tinted bar (`event-<colour>-surface` / `-text`): `Checkbox` (show), `ColorDot`, name, a short meta word. Clicking the name opens an editor box under the row (one at a time, `aria-expanded`).
  - **Categorieën** (the intro "Vink uit om te verbergen…" sits directly under this heading): the user's own calendars, default first. Meta "standaard" on the default one. Editor: name (`InputField`, not for the default one, whose name is the translation "Persoonlijk"), `ColorSwatches`, and, except for the default one, the note that its events go to Persoonlijk plus a destructive "Verwijderen". "Categorie toevoegen" creates "Nieuwe categorie" in the next free colour and focuses its name.
  - **Gekoppelde agenda's**: one row per account. Meta "Mislukt" only when the last sync failed. Editor: status or failure reason, `ColorSwatches`, "Koppeling verwijderen".
  - **Vaste soorten**: Maaltijden, Te doen, Deadlines with only the show checkbox and "vaste kleur".
  - "ICS-link toevoegen": name, link (`Link` leading icon, no autocomplete), the privacy line, and the three "where do I find the link" lines (Outlook, Google, iCloud).
  - Footer: filled "Agenda koppelen" (the ICS form); when a delete was asked it becomes the stacked `DeleteConfirm`. A category's prompt says its events go to Persoonlijk; an account's says its imported events go and the calendar stays.
- **Notices**: above the calendar, one `Card` per deleted event whose meal left open basket items. The ticket title is one sentence with the event title and the item names (`Intl.ListFormat`, six names, then "en N andere"); the slot holds "Weghalen" (`Trash`) and "Laten staan" (`X`). Both dismiss the notice; only "Weghalen" deletes the listed items that are still open.

## Deliberate decisions
- **A category is a manual calendar** (ADR-0040). Create, rename and recolour are plain RLS-bound writes (`createCalendar`, `updateCalendar`; column grant on `color`); delete is the `delete_calendar_moving_contents` RPC, which moves events, series and meal plans to the default calendar first. The default and imported calendars are refused (`read-only`). At most 20 own calendars (`MAX_CATEGORIES`).
- **The colour saves at once** (optimistic, reverted on a refusal); the name saves on blur or Enter, and an empty name puts the old one back.
- **Show/hide is per device**: the checkboxes write `agenda-hidden` through `onHiddenChange`; nothing goes to the database. A deleted calendar is shown again so its id leaves the cookie.
- **New categories** take `nextFreeColor` (mirror of `private.next_calendar_color`) and the panel sends it, so the colour on screen is the stored one.
- **The link goes in once and never comes back.** `addIcsCalendar` fetches and parses first (a link that fails never becomes an account), then `create_ics_calendar` stores it in Vault. No view, action result, `sync_state` value or log line carries it. Failures are codes (`fetch_timeout`, `unparsable`, `empty`, `drop`, …) that the panel translates (`syncErrors.*`).
- **`webcal://` is accepted** and turned into `https://`; everything else but https is refused, then `safe-fetch` guards the fetch.
- **Failure states are visible, not silent.** A failed sync leaves the events alone and shows the reason on the Tag. Known limit: a feed that legitimately lost more than half of its window stays "failed" until the feed grows back; there is no override yet (`docs/open-questions.md`).
- **Notices are a table, not derived.** Deleting a meal plan sets `shopping_list_items.meal_plan_id` to null, so the link to the basket items is gone afterwards. `calendar_sync_notices` keeps the ids; the page lists the ones still open. Only the definer function writes a notice, and only when an open item exists.
- **Triggers**: opening the Agenda syncs the user's own accounts older than an hour in `after()`, so the page never waits. The daily cron route handles the rest (ADR-0039).
- Status time is relative (`Intl.RelativeTimeFormat`); the visual suite freezes the clock at 2026-01-01 14:00.

## Token gaps and flags
- The notices inherit `CardContentTicket`'s raw `gap-4`/`gap-2` (flagged in its own note).
- The help lines are plain text: there is no external-link style, and the three providers' menus change names, so they name the path rather than link.

## Gotchas
- Row tints are listed statically (`TINT_CLASSES`), like the swatches; a new palette colour needs a line there.
- Stories pass mock actions and `initialOverview`; the panel never imports the `"use server"` module, and still calls `onList` on open.
- The panel is `position: fixed`: stories wrap it in `min-h-screen`.
- Mobile shape (bottom sheet) follows the viewport; Ladle baselines cover desktop only.
- Notices come from `getSyncNotices()` in `page.tsx`; a sync that finishes after the response shows its notice on the next visit.
