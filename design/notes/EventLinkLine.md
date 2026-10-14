# EventLinkLine
Claude-designed (#489), ADR-0037 s4, no Figma node · Code: `components/molecules/EventLinkLine.tsx` (+ `.stories.tsx`)

## Anatomy
One line of `text-sm font-semibold text-text-secondary`: a `Calendar` icon (16) and "In agenda: <afspraak>, <datum> · <afspraak>, <datum>". Dates are `ma 5 jan` style via `useFormatter`. At most 3 events, then "+N meer". Renders nothing without events.

## Why a component
It appears on three surfaces that must read the same: the recipe page (centred under the title block), the card panel (after the fields) and under a note (below the backlinks). Page-local copies would drift.

## Contract
- `events: AgendaEventRef[]`, already sorted (`sortEventRefs`: upcoming soonest first, then past, newest first). `className` merges for placement.
- Timed events are shown in the Agenda zone (`AGENDA_TIME_ZONE`), all-day events in UTC (they are stored as UTC midnight).
- Server pages load the events with `getEventRefsOrEmpty` (a failure yields no line, never an error page); the card panel takes `onLoadAgendaEvents` and shows the line once loaded.

## Deliberate decisions
- Plain text, not links: `/agenda` cannot open a given event yet.
- Lives in `components/molecules` because it is shared by `app/(app)/recepten`, `notities` and `te-doen`.

## Token gaps and flags
- None.

## Gotchas
- The card panel keys the loaded events by card id, so a previous card's line never shows under the next one.
- Stories: `One`, `Several`, `Overflow`, `None`.

## Open
- A line that opens the event in the Agenda needs `/agenda` to accept a target (`?event=`), a #486 follow-up.
