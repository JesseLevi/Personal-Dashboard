import { describe, expect, it } from "vitest";
import { AGENDA_DEFAULT_SCROLL_HOUR, initialScrollHour, isoWeek, localDay, visibleRange } from "@/lib/agenda/time";

describe("isoWeek", () => {
  it("counts the week with the year's first Thursday as week 1", () => {
    expect(isoWeek("2026-01-01")).toBe(1);
    expect(isoWeek("2025-12-29")).toBe(1);
    expect(isoWeek("2026-01-04")).toBe(1);
    expect(isoWeek("2026-01-05")).toBe(2);
    expect(isoWeek("2016-01-04")).toBe(1);
  });

  it("gives the last days of a year to week 52 or 53 of that year", () => {
    expect(isoWeek("2016-01-03")).toBe(53);
    expect(isoWeek("2021-01-03")).toBe(53);
    expect(isoWeek("2020-12-31")).toBe(53);
    expect(isoWeek("2025-12-28")).toBe(52);
  });

  it("gives the first days of a year to the previous year's last week", () => {
    expect(isoWeek("2027-01-01")).toBe(53);
    expect(isoWeek("2027-01-03")).toBe(53);
    expect(isoWeek("2027-01-04")).toBe(1);
  });

  it("is the same for every day of a week", () => {
    expect(isoWeek("2026-10-12")).toBe(42);
    expect(isoWeek("2026-10-18")).toBe(42);
    expect(isoWeek("2026-10-19")).toBe(43);
  });

  it("handles a leap day", () => {
    expect(isoWeek("2024-02-29")).toBe(9);
    expect(isoWeek("2024-12-30")).toBe(1);
  });
});

describe("initialScrollHour", () => {
  const week = visibleRange("week", "2026-01-01");

  it("opens one hour before now when the range holds today", () => {
    expect(initialScrollHour(week, new Date(2026, 0, 1, 14, 0))).toBe(13);
    expect(initialScrollHour(week, new Date(2026, 0, 1, 15, 48))).toBe(14);
  });

  it("does not go before midnight", () => {
    expect(initialScrollHour(week, new Date(2026, 0, 1, 0, 30))).toBe(0);
  });

  it("opens on 07:00 when the range does not hold today", () => {
    expect(initialScrollHour(week, new Date(2026, 0, 8, 14, 0))).toBe(AGENDA_DEFAULT_SCROLL_HOUR);
    expect(initialScrollHour(visibleRange("day", "2026-01-02"), new Date(2026, 0, 1, 14, 0))).toBe(AGENDA_DEFAULT_SCROLL_HOUR);
  });

  it("holds the last day of a range but not the end", () => {
    expect(initialScrollHour(week, new Date(2026, 0, 4, 10, 0))).toBe(9);
    expect(initialScrollHour(week, new Date(2026, 0, 5, 10, 0))).toBe(AGENDA_DEFAULT_SCROLL_HOUR);
  });
});

describe("localDay", () => {
  it("pads month and day in the local zone", () => {
    expect(localDay(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });
});
