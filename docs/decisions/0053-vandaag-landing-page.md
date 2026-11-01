# ADR-0053: "Vandaag" is the landing page

**Status**: Accepted (2026-11-01, user decision on the improvement brief, package 4). Amends ADR-0047's assumption that Atlas opens on Te doen.

## Context

- Every signed-in entry (login, `/`, the magic link, the PWA `start_url`) opened the Kanban board. The Vision promises "what is going on this week" and small decisions taken off people's hands; the board shows neither.
- The data for a day overview already exists: `agenda_items()` (events, meals, planned cards, deadlines; finished cards are left out once ADR-0050 is applied), the basket, and assistant signals (ADR-0046/0051).

## Decision

1. **New route `/vandaag`**, first in the navigation (icon `Sun`). It shows, for today in the Agenda zone: events (all-day first, then by time), meals by moment with "Dag naar mand" (`sendWeekToBasket` for one day, so meals already sent are skipped), planned cards and deadlines, the number of open basket items across the member's baskets, and up to 5 new signals of any kind (patterns included) with act and dismiss.
2. **It is the landing page.** `HOME_PATH` (`lib/today/home.ts`) is the one target for `/`, login (password, code, link) and the manifest `start_url`. The login blur-in (`EnterFromLogin`) plays here.
3. **Reads go through existing queries and the RLS client** (`getAgendaItems`, a count on `shopping_list_items`, `listAssistantSignals`). Not through `widget_today()`: that needs a widget token. No schema change.
4. Built from existing components (`PageHeader`, `Card`, `Tag`, `Button`, `AnimatedAddToBasketButton`); no new component or token.

## Consequences

- Te doen is one tap further away; it stays second in the navigation.
- A home-screen icon added before this change keeps its old start URL until it is added again (iOS stores the URL at install).
