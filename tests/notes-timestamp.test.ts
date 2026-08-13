import { describe, expect, it } from "vitest";
import { formatNoteTimestamp } from "../lib/notes/timestamp";

// #230: the "eigen vitest-target" the ticket asks for -- covers each tier of
// the three-way fallback plus the two calendar-day boundaries between them.

describe("formatNoteTimestamp", () => {
  const now = new Date(2026, 7, 13, 15, 30, 0); // 2026-08-13 15:30 local

  it("classifies a timestamp earlier today as 'today', with an HH:MM time", () => {
    const result = formatNoteTimestamp(new Date(2026, 7, 13, 12, 24, 0).toISOString(), now);
    expect(result).toEqual({ tier: "today", time: "12:24" });
  });

  it("pads a single-digit hour and minute", () => {
    const result = formatNoteTimestamp(new Date(2026, 7, 13, 9, 5, 0).toISOString(), now);
    expect(result).toEqual({ tier: "today", time: "09:05" });
  });

  it("classifies a timestamp from right after midnight today as 'today', not 'yesterday'", () => {
    const result = formatNoteTimestamp(new Date(2026, 7, 13, 0, 1, 0).toISOString(), now);
    expect(result.tier).toBe("today");
  });

  it("classifies a timestamp from yesterday as 'yesterday', regardless of time of day", () => {
    const lateYesterday = formatNoteTimestamp(new Date(2026, 7, 12, 23, 59, 0).toISOString(), now);
    const earlyYesterday = formatNoteTimestamp(new Date(2026, 7, 12, 0, 0, 0).toISOString(), now);
    expect(lateYesterday).toEqual({ tier: "yesterday" });
    expect(earlyYesterday).toEqual({ tier: "yesterday" });
  });

  it("classifies a timestamp from the day before yesterday as 'older', with a dd-mm-yyyy date", () => {
    const result = formatNoteTimestamp(new Date(2026, 7, 11, 23, 59, 0).toISOString(), now);
    expect(result).toEqual({ tier: "older", date: "11-08-2026" });
  });

  it("pads a single-digit day and month in an older date", () => {
    const result = formatNoteTimestamp(new Date(2026, 2, 3, 10, 0, 0).toISOString(), now);
    expect(result).toEqual({ tier: "older", date: "03-03-2026" });
  });

  it("classifies a timestamp from a prior year as 'older', with the real year", () => {
    const result = formatNoteTimestamp(new Date(2025, 11, 31, 10, 0, 0).toISOString(), now);
    expect(result).toEqual({ tier: "older", date: "31-12-2025" });
  });

  it("crosses a month boundary correctly for 'yesterday'", () => {
    const firstOfMonth = new Date(2026, 8, 1, 10, 0, 0); // 2026-09-01
    const result = formatNoteTimestamp(new Date(2026, 7, 31, 22, 0, 0).toISOString(), firstOfMonth);
    expect(result).toEqual({ tier: "yesterday" });
  });
});
