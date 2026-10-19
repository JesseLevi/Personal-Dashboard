import { describe, expect, it } from "vitest";
import { nextFullHourSpan } from "@/lib/agenda/new-event";
import { isAgendaTray } from "@/lib/agenda/tray";

describe("nextFullHourSpan", () => {
  it("starts at the next full hour in the Agenda zone and lasts an hour", () => {
    // 12:20 UTC is 13:20 in Amsterdam (winter).
    expect(nextFullHourSpan(new Date("2026-01-15T12:20:00Z"))).toEqual({
      start: "2026-01-15T14:00:00",
      end: "2026-01-15T15:00:00",
      allDay: false,
    });
  });
  it("moves a time exactly on the hour to the following hour", () => {
    expect(nextFullHourSpan(new Date("2026-07-15T07:00:00Z"))).toEqual({
      start: "2026-07-15T10:00:00",
      end: "2026-07-15T11:00:00",
      allDay: false,
    });
  });
  it("ends at midnight for the 23:00 slot", () => {
    expect(nextFullHourSpan(new Date("2026-01-15T21:30:00Z"))).toEqual({
      start: "2026-01-15T23:00:00",
      end: "2026-01-16T00:00:00",
      allDay: false,
    });
  });
  it("rolls over to the next day after 23:00", () => {
    expect(nextFullHourSpan(new Date("2026-01-15T22:30:00Z"))).toEqual({
      start: "2026-01-16T00:00:00",
      end: "2026-01-16T01:00:00",
      allDay: false,
    });
  });
});

describe("isAgendaTray", () => {
  it("accepts only open and closed", () => {
    expect(isAgendaTray("open")).toBe(true);
    expect(isAgendaTray("closed")).toBe(true);
    expect(isAgendaTray("wide")).toBe(false);
    expect(isAgendaTray(undefined)).toBe(false);
  });
});
