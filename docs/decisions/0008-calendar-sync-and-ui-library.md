# ADR-0008: Calendar — read-only sync first; Schedule-X instead of CalendarKit

**Status**: Accepted (supersedes the CalendarKit line in Vision.md §2.5). For Phase 7 (2026-10-11): the Agenda UI is Claude-designed in code (ADR-0034), not waiting for Figma. User URLs are fetched through the existing `lib/net/safe-fetch` (ADR-0019 §5). Scheduled sync runs on the managed mechanism ADR-0018 §4 leaves open, not on an always-on worker.

## Context

Vision.md proposes CalendarKit and lists external sync (Google/Outlook/CalDAV) as a core action. Two findings:

1. **CalendarKit is a React Native library** (`react-native-calendar-kit`) and cannot run in a Next.js web app. Vision.md §2.5 explicitly allows the stack to be criticized.
2. Two-way sync (conflict resolution, external writes, invite semantics) is an order of magnitude more complex than read-only import and is not needed to get "overzicht van afspraken en deadlines".

## Decision

- **UI library**: **Schedule-X** (MIT, web-native, headless-ish theming that can be tokenized to Tailwind). Fallback if it proves limiting: FullCalendar (core MIT). Final visual verdict waits for the Agenda Figma designs — this ADR fixes the *candidate*, not the pixel outcome.
- **Sync scope this round: read-only import**, backend-only (no Agenda UI exists yet). Provider abstraction with three implementations in build order of cheapness: `ics` URL feed → `caldav` (via `tsdav`, covers Outlook/iCloud/Nextcloud) → `google` (OAuth, offline refresh token). Credentials via the Vault pattern (ADR-0002).
- Incremental sync where the protocol allows (Google syncToken, CalDAV ctag/etag), full re-read for ICS. Upsert on `(calendar_account_id, external_id)`; `source='sync'` rows are read-only in-app (ADR-0005).
- Internal event creation stays internal. **Two-way sync is a future ADR**, not scope creep within this one.

## Consequences

- **SSRF guard is part of the definition of done for every provider**: user-supplied URLs are fetched https-only, DNS-resolved and checked against private/loopback/link-local ranges, redirect-capped with per-hop revalidation, and size/time-limited. The worker sits next to Supabase and Ollama; an unguarded fetch of `http://localhost:8000` is a database breach.
- Recurring events are expanded into concrete instances at sync time within a rolling window (−30d/+400d); no RRULE storage or evaluation in-app this round.
- Vision.md §2.5 should be corrected to drop CalendarKit (web-incompatible). *(Done 2026-07-20.)*
- Deadlines from Kanban render as an overlay from `cards.due_at` at query time — they are not copied into `calendar_events`.
- Deleting a calendar account cascades its sync'd events; manual events are never touched by sync.
