import { describe, expect, it } from "vitest";
import { itemKey } from "@/components/organisms/AgendaCalendarTheme";
import type { AgendaItem } from "@/lib/agenda/types";
import { clipBox, formatClock, isShortSpan, itemEditability, normalizeSpan, slotBox, slotForSingleSnap, toEventInput } from "@/lib/ui/agenda-calendar";

const base = { id: "i1", title: "T", start: "2026-01-01T09:00:00", end: "2026-01-01T10:00:00", allDay: false, linkCount: 0 };

const manual: AgendaItem = { ...base, kind: "event", source: "manual", calendarId: "c", color: "blue", missingSince: null };
const synced: AgendaItem = { ...manual, source: "sync", color: "violet" };
const meal: AgendaItem = { ...base, kind: "meal", slot: "dinner", servings: 4, thumbnailPath: null, attached: false, position: 1000 };
const card: AgendaItem = { ...base, kind: "planned_card", board: "B", column: "C" };
const deadline: AgendaItem = { ...base, kind: "deadline", allDay: true, start: "2026-01-01", end: null };

describe("isShortSpan", () => {
  const at = (minutes: number) => new Date(2026, 0, 1, 9, minutes);
  it("is short below 45 minutes and long from 45 on", () => {
    expect(isShortSpan(at(0), at(30))).toBe(true);
    expect(isShortSpan(at(0), at(44))).toBe(true);
    expect(isShortSpan(at(0), at(45))).toBe(false);
    expect(isShortSpan(at(0), at(90))).toBe(false);
  });
  it("counts an open end as long", () => {
    expect(isShortSpan(at(0), null)).toBe(false);
    expect(isShortSpan(null, null)).toBe(false);
  });
});

describe("formatClock", () => {
  it("pads to a 24-hour HH:MM", () => {
    expect(formatClock(new Date(2026, 0, 1, 9, 5))).toBe("09:05");
    expect(formatClock(new Date(2026, 0, 1, 17, 30))).toBe("17:30");
  });
});

describe("itemEditability", () => {
  it("lets manual timed events move and resize", () => {
    expect(itemEditability(manual)).toEqual({ move: true, resize: true });
  });
  it("keeps all-day manual events movable but not resizable", () => {
    expect(itemEditability({ ...manual, allDay: true })).toEqual({ move: true, resize: false });
  });
  it("locks synced events", () => {
    expect(itemEditability(synced)).toEqual({ move: false, resize: false });
  });
  it("moves meals and planned cards without resizing", () => {
    expect(itemEditability(meal)).toEqual({ move: true, resize: false });
    expect(itemEditability(card)).toEqual({ move: true, resize: false });
  });
  it("locks deadlines", () => {
    expect(itemEditability(deadline)).toEqual({ move: false, resize: false });
  });
});

describe("toEventInput", () => {
  it("carries the item and the editability flags", () => {
    const input = toEventInput(synced);
    expect(input).toMatchObject({ id: "i1", title: "T", allDay: false, startEditable: false, durationEditable: false });
    expect(input.extendedProps.item).toBe(synced);
  });
  it("omits `end` when the item has none", () => {
    expect("end" in toEventInput(deadline)).toBe(false);
    expect(toEventInput(manual).end).toBe("2026-01-01T10:00:00");
  });
});

describe("normalizeSpan", () => {
  it("reduces an all-day span to dates", () => {
    expect(normalizeSpan({ start: "2026-01-02T00:00:00+01:00", end: "2026-01-03T00:00:00+01:00", allDay: true })).toEqual({
      start: "2026-01-02",
      end: "2026-01-03",
      allDay: true,
    });
  });
  it("keeps a missing all-day end null", () => {
    expect(normalizeSpan({ start: "2026-01-02", end: null, allDay: true }).end).toBeNull();
  });
  it("passes a timed span through", () => {
    const span = { start: "2026-01-02T09:00:00+01:00", end: "2026-01-02T10:00:00+01:00", allDay: false };
    expect(normalizeSpan(span)).toEqual(span);
  });
});

describe("itemKey", () => {
  it("separates imported events from own events", () => {
    expect(itemKey(manual)).toBe("event");
    expect(itemKey(synced)).toBe("sync");
    expect(itemKey(meal)).toBe("meal");
    expect(itemKey(card)).toBe("planned_card");
    expect(itemKey(deadline)).toBe("deadline");
  });
});

describe("slotForSingleSnap", () => {
  const at = (h: number, m: number) => new Date(2026, 0, 1, h, m).toISOString();
  const span = (start: string, end: string) => ({ start, end, allDay: false });

  it("widens a one-snap click to the whole slot, floored", () => {
    const r = slotForSingleSnap(span(at(8, 15), at(8, 30)), 15, 30);
    expect(r?.start.getHours()).toBe(8);
    expect(r?.start.getMinutes()).toBe(0);
    expect(r && r.end.getTime() - r.start.getTime()).toBe(30 * 60_000);
  });

  it("leaves drags and all-day spans alone", () => {
    expect(slotForSingleSnap(span(at(8, 15), at(8, 45)), 15, 30)).toBeNull();
    expect(slotForSingleSnap({ start: "2026-01-01", end: "2026-01-02", allDay: true }, 15, 30)).toBeNull();
  });
});

describe("slotBox and clipBox", () => {
  const lane = { top: 100, left: 10, width: 150, height: 1200 };

  it("snaps the pointer to its 30-minute slot at full lane width", () => {
    expect(slotBox(lane, 100)).toEqual({ top: 100, left: 10, width: 150, height: 25 });
    expect(slotBox(lane, 100 + 25 * 20 + 24)).toEqual({ top: 600, left: 10, width: 150, height: 25 });
  });

  it("clamps to the first and last slot", () => {
    expect(slotBox(lane, 0).top).toBe(100);
    expect(slotBox(lane, 5000).top).toBe(100 + 47 * 25);
  });

  it("clips a box to the visible area", () => {
    const clip = { top: 100, left: 0, width: 50, height: 500 };
    expect(clipBox({ top: 90, left: 0, width: 50, height: 25 }, clip)).toEqual({ top: 100, left: 0, width: 50, height: 15 });
    expect(clipBox({ top: 0, left: 0, width: 50, height: 25 }, clip)).toBeNull();
  });
});
