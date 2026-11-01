import { describe, expect, it } from "vitest";
import { clockOf, groupToday } from "@/lib/today/day";
import type { AgendaItem } from "@/lib/agenda/types";

const event = (id: string, start: string, allDay = false): AgendaItem => ({
  kind: "event", id, title: id, start, end: null, allDay, linkCount: 0,
  source: "manual", calendarId: "c", color: "blue" as never, missingSince: null,
});
const meal = (id: string, slot: "breakfast" | "dinner", position = 1000): AgendaItem => ({
  kind: "meal", id, title: id, start: "2026-11-01", end: null, allDay: true, linkCount: 0,
  slot, servings: 2, thumbnailPath: null, attached: false, position,
});

describe("groupToday", () => {
  it("orders all-day events first, then by start time", () => {
    const { events } = groupToday([event("late", "2026-11-01T15:00:00"), event("day", "2026-11-01", true), event("early", "2026-11-01T09:00:00")]);
    expect(events.map((e) => e.id)).toEqual(["day", "early", "late"]);
  });

  it("orders meals by moment, then position", () => {
    const { meals } = groupToday([meal("diner", "dinner"), meal("ontbijt2", "breakfast", 2000), meal("ontbijt1", "breakfast")]);
    expect(meals.map((m) => m.id)).toEqual(["ontbijt1", "ontbijt2", "diner"]);
  });

  it("puts planned cards before deadlines", () => {
    const { cards } = groupToday([
      { kind: "deadline", id: "d", title: "A", start: "2026-11-01", end: null, allDay: true, linkCount: 0 },
      { kind: "planned_card", id: "p", title: "B", start: "2026-11-01", end: null, allDay: true, linkCount: 0, board: "b", column: "c" },
    ]);
    expect(cards.map((c) => c.id)).toEqual(["p", "d"]);
  });

  it("reads the clock from a local date-time", () => {
    expect(clockOf("2026-11-01T09:30:00+01:00")).toBe("09:30");
  });
});
