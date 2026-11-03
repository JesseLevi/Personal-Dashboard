# ADR-0059: The Agenda is the landing page, with day cards

**Status**: Accepted (2026-11-01, user decision, #720); §6 amended 2026-11-02 (user decision, #732). Supersedes ADR-0057; amends ADR-0051 §4 and ADR-0058 §3.

## Context

- ADR-0057 made `/vandaag` the landing page the same day. It never reached production (`5474b0e` does not contain #698).
- Vandaag and the Agenda show the same day twice: one as a page of sections, the other as the planner where you act. The user wants one place: the Agenda opens first and carries the day's essentials on top.
- References the user chose: a pull-up sheet over a content area (layout only; no summary sentence) and compact cards with a simple timeline.

## Decision

1. **`/vandaag` is removed.** `HOME_PATH` is `/agenda`. Login (password, code, link), `/` and the manifest `start_url` land there. No redirect: the route was never in production. The nav item "Vandaag" goes, and Agenda moves to the top of the Sidebar and the tab bar.
2. **Views**: mobile shows the day, desktop the week by default. A stored `agenda-view` still wins on desktop.
3. **Day cards**, built from existing components (`Card`, `CardContentRecipe`, `Tag`, `Button`):
   - a simple timeline of the day's events;
   - meals, each with its recipe thumbnail and name;
   - planned cards and deadlines;
   - suggestions in the `Tag` highlight colour with a `Sparkles` icon.
   
   No greeting, no summary sentence and no section titles. Empty kinds are not shown.
4. **Suggestions** are small, like a highlight `Tag`: assistant signals of every kind (rhythms incl. `cook_rhythm`, and patterns; shown for today only) plus one deterministic suggestion: a day's meals that have no basket item yet, with "Naar mand" over `sendWeekToBasket` for that day.
5. **Mobile**: the header title is the date opener (weekday large, date below, a dot when it is today). The cards follow the day shown. Under them a pull-up sheet holds the day strip and the time grid, with two stops: *peek* (grabber, strip, a sliver of the grid) and *full* (up to the header). It is a page region, not a modal. Drag direction is locked after the slop: vertical moves the sheet, horizontal scrolls the strip. On an empty day the sheet starts in *full*; dragged down, it shows the empty-day line. (Amended 2026-11-03, user's call.)
6. **Desktop** (from `lg`): the cards for the shown day sit in a fixed 20rem column left of the planner; on an empty day the column is left out and the planner takes the full width. Never between the header and the planner. When the planner is too narrow for the chosen week, it shows three days, then one; the toggle still reads Week. (Amended: the cards first always showed today, until 2026-11-03. The first version put the cards in a row above the planner below a 65rem container, which in the real shell meant every laptop under ~1500px.)
7. **Data**: cards derive from the Agenda window already loaded, after the hidden-calendar filter. Extra reads (signals, recipe ids for thumbnails, basket links of meals) go through the RLS client and fail to "nothing shown". No schema change. The cards render on the server, before FullCalendar loads.
8. **No new tokens.** One new icon (`Sparkles`); the cards and the sheet are page composition in `app/(app)/agenda/`, not new components.

## Consequences

- One page fewer; the Agenda's first load also serves the day overview, so it must stay fast (server-rendered cards, skeleton for the grid).
- Pattern signals get their surface here (amends ADR-0051 §4); so does `cook_rhythm`, which ADR-0058 §3 had put on Vandaag only; rhythms keep showing in Winkelmand too.
- Vandaag's open-basket count and its "Dag naar mand" button go; the meal suggestion replaces the latter.
- The sheet's gestures (strip swipe, grid scroll, sheet drag, iOS back swipe) need a device test; Ladle and headless runs do not cover them.
