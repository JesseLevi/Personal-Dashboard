// Fractional-positioning math shared by boards/board_columns/cards (see the
// `position` column comment in supabase/migrations/20260723000001_kanban_schema.sql).
// Pure and framework-free on purpose: no Supabase import here, so it is
// testable without a database (tests/boards-positioning.test.ts) and reusable
// for "insert at end" (one neighbor is unset) and "move between two rows"
// (both neighbors set) alike.

// Matches the seed data's spacing (board_columns rows land on 1000/2000/...):
// large enough that many inserts-at-end never need a re-spacing pass, small
// enough it reads fine in a debugger.
const POSITION_GAP = 1000;

export class InvalidNeighborOrderError extends Error {
  constructor() {
    // No row/user content in the message — this can end up in logs.
    super("before-position must be less than after-position");
    this.name = "InvalidNeighborOrderError";
  }
}

/**
 * Next fractional position for a row inserted between `before` and `after`
 * (both already-persisted neighbor positions, in list order). Pass `null` for
 * a missing neighbor: `before: null` means "insert at the very start", `after:
 * null` means "insert at the very end", both `null` means "the list is empty".
 */
export function nextPosition(
  before: number | null,
  after: number | null,
): number {
  if (before !== null && after !== null) {
    if (before >= after) throw new InvalidNeighborOrderError();
    return (before + after) / 2;
  }
  if (before !== null) return before + POSITION_GAP;
  if (after !== null) return after / 2;
  return POSITION_GAP;
}
