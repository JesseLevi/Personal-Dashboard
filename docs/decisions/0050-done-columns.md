# ADR-0050: A column can be a done column

**Status**: Accepted (2026-11-01, user decision on the improvement brief, package 2: option a). Amends ADR-0037 §1 and ADR-0046 (pattern context).

## Context

- Te doen had no notion of "finished". The default columns were only names (`Ideeën`, `Klaar`, `Bezig`, `Afgerond`). The board muted the rightmost column and the Agenda plan drawer skipped it, both by position.
- `agenda_items()` returned planned cards and deadlines whatever their column, so a finished card with a deadline stayed on the Agenda and on the iPhone widget (`widget_today()` reads `agenda_items()`).
- Weighed: a flag per column; the flag plus automatic archiving after N days; leaving it as it is.

## Decision

1. **`board_columns.is_done`** (`boolean not null default false`). Cards in such a column are finished. A member sets it in the column panel ("Kaarten hier zijn klaar"); a board may have none or several.
2. **Backfill and seeds**: existing columns named `Afgerond` or with icon `CircleCheck` become done columns. The default board (`seed_board_for`) and every new board (`DEFAULT_BOARD_COLUMNS`) get `Afgerond` as a done column.
3. **The flag replaces "rightmost column"** everywhere: board styling (muted cards), the plan drawer, board progress in the ⌘K palette (ADR-0048), and `agenda_items()`, which leaves cards in a done column out of both `planned_card` and `deadline`. Its signature and columns stay the same, so `lib/agenda/map.ts`, `widget_today()` and the widget contract are unchanged.
4. **Pattern context** (ADR-0046): finished cards are not loaded as content for a pattern signal; only open cards can be "stale" context.
5. **No archiving.** Hiding finished cards after a while needs its own decision on recovery and search (option b).

## Consequences

- A board whose rightmost column is not called `Afgerond` loses its muted styling until the member marks that column.
- Migration order matters: `20261101000003_board_columns_is_done` after `20261030000001_widget_tokens`, and before promoting code that selects `is_done`.
