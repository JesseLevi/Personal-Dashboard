// Plain-text due-date parsing (cards.due_at) — #94. Figma's Datum field is
// explicitly text-only (annotation "For now date will be only text based",
// no datepicker in the fetched node), so the panel sends whatever the user
// typed and this is the server-side parse step into a real timestamp. Pure
// and framework-free like positioning.ts, for the same reason: testable
// without a database (tests/boards-dates.test.ts) and reusable from
// lib/boards/schemas.ts without pulling Supabase into the parse path.

// dd-mm-yyyy or dd/mm/yyyy, one- or two-digit day/month — the same
// day/month/year shape TeDoenBoard.tsx already displays via next-intl's
// useFormatter (see design/notes/TeDoenBoard.md), so a value the UI shows
// for one card round-trips as valid input for another.
const DATE_PATTERN = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/;

/**
 * Parses a plain-text calendar date into an ISO datetime string (UTC
 * midnight), or `null` if `input` isn't a real dd-mm-yyyy/dd/mm/yyyy date
 * (wrong shape, or a shape like 31-02-2026 that doesn't exist — `Date`'s own
 * rollover behavior is checked against and rejected, not silently accepted
 * as 3 March).
 */
export function parseDueAtText(input: string): string | null {
  const match = DATE_PATTERN.exec(input.trim());
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  const isRealDate =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;

  return isRealDate ? date.toISOString() : null;
}
