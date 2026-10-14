import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  loadWindow,
  spanToUtc,
  startOfWeek,
  stepDate,
  visibleRange,
  wallClockToUtc,
} from "@/lib/agenda/time";
import {
  createEventSchema,
  moveEventSchema,
  rangeSchema,
  updateEventSchema,
} from "@/lib/agenda/schemas";

const ID = "00000000-0000-4000-8000-000000000001";

describe("wallClockToUtc", () => {
  it("reads winter time as UTC+1", () => {
    expect(wallClockToUtc("2026-01-15T09:00:00")).toBe("2026-01-15T08:00:00.000Z");
  });
  it("reads summer time as UTC+2", () => {
    expect(wallClockToUtc("2026-07-15T09:00:00")).toBe("2026-07-15T07:00:00.000Z");
  });
  it("ignores the browser offset", () => {
    expect(wallClockToUtc("2026-10-14T09:00:00-05:00")).toBe("2026-10-14T07:00:00.000Z");
  });
  it("handles the day after the autumn switch", () => {
    expect(wallClockToUtc("2026-10-25T12:00:00")).toBe("2026-10-25T11:00:00.000Z");
  });
});

describe("date steps", () => {
  it("adds days across month ends", () => {
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("adds months and lands on the first", () => {
    expect(addMonths("2026-12-20", 1)).toBe("2027-01-01");
    expect(addMonths("2026-01-31", -1)).toBe("2025-12-01");
  });
  it("finds the Monday of a week", () => {
    expect(startOfWeek("2026-10-14")).toBe("2026-10-12");
    expect(startOfWeek("2026-10-18")).toBe("2026-10-12");
    expect(startOfWeek("2026-10-12")).toBe("2026-10-12");
  });
  it("steps each view by its own page", () => {
    expect(stepDate("day", "2026-10-14", 1)).toBe("2026-10-15");
    expect(stepDate("threeDay", "2026-10-14", -1)).toBe("2026-10-11");
    expect(stepDate("week", "2026-10-14", 1)).toBe("2026-10-21");
    expect(stepDate("list", "2026-10-14", -1)).toBe("2026-10-07");
    expect(stepDate("month", "2026-10-14", 1)).toBe("2026-11-01");
  });
});

describe("ranges", () => {
  it("shows Monday to Sunday for a week", () => {
    expect(visibleRange("week", "2026-10-14")).toEqual({ start: "2026-10-12", end: "2026-10-19" });
  });
  it("shows the month", () => {
    expect(visibleRange("month", "2026-10-14")).toEqual({ start: "2026-10-01", end: "2026-11-01" });
  });
  it("loads the month plus a week each side", () => {
    expect(loadWindow("2026-10-14")).toEqual({ from: "2026-09-24", to: "2026-11-08" });
  });
});

describe("spanToUtc", () => {
  it("converts a timed span", () => {
    expect(
      spanToUtc({ start: "2026-10-14T09:00:00+02:00", end: "2026-10-14T10:30:00+02:00", allDay: false }),
    ).toEqual({ startsAt: "2026-10-14T07:00:00.000Z", endsAt: "2026-10-14T08:30:00.000Z", allDay: false });
  });
  it("gives a timed span without end one hour", () => {
    expect(spanToUtc({ start: "2026-10-14T09:00:00", end: null, allDay: false }).endsAt).toBe("2026-10-14T08:00:00.000Z");
  });
  it("stores an all-day span as UTC midnights with an exclusive end", () => {
    expect(spanToUtc({ start: "2026-10-14", end: null, allDay: true })).toEqual({
      startsAt: "2026-10-14T00:00:00.000Z",
      endsAt: "2026-10-15T00:00:00.000Z",
      allDay: true,
    });
    expect(spanToUtc({ start: "2026-10-14", end: "2026-10-17", allDay: true }).endsAt).toBe("2026-10-17T00:00:00.000Z");
  });
});

describe("agenda schemas", () => {
  const fields = { title: "  Tandarts ", startsAt: "2026-10-14T07:00:00.000Z", endsAt: "2026-10-14T08:00:00.000Z", allDay: false, location: "", description: null };

  it("trims the title and turns blank text into null", () => {
    const parsed = createEventSchema.parse(fields);
    expect(parsed.title).toBe("Tandarts");
    expect(parsed.location).toBeNull();
  });
  it("rejects an empty title and an end before the start", () => {
    expect(createEventSchema.safeParse({ ...fields, title: "  " }).success).toBe(false);
    expect(createEventSchema.safeParse({ ...fields, endsAt: "2026-10-14T06:00:00.000Z" }).success).toBe(false);
  });
  it("requires UTC midnights for an all-day event", () => {
    expect(createEventSchema.safeParse({ ...fields, allDay: true }).success).toBe(false);
    expect(
      createEventSchema.safeParse({ ...fields, allDay: true, startsAt: "2026-10-14T00:00:00.000Z", endsAt: "2026-10-15T00:00:00.000Z" }).success,
    ).toBe(true);
  });
  it("needs an id to update or move", () => {
    expect(updateEventSchema.safeParse(fields).success).toBe(false);
    expect(updateEventSchema.safeParse({ ...fields, id: ID }).success).toBe(true);
    expect(moveEventSchema.safeParse({ id: ID, startsAt: fields.startsAt, endsAt: fields.endsAt, allDay: false }).success).toBe(true);
  });
  it("validates a date range", () => {
    expect(rangeSchema.safeParse({ from: "2026-10-01", to: "2026-11-01" }).success).toBe(true);
    expect(rangeSchema.safeParse({ from: "2026-11-01", to: "2026-10-01" }).success).toBe(false);
  });
});
