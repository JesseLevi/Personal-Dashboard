import { describe, expect, it } from "vitest";
import { itemKey } from "@/components/organisms/AgendaCalendarTheme";
import type { AgendaItem } from "@/lib/agenda/types";
import { itemEditability, normalizeSpan, toEventInput } from "@/lib/ui/agenda-calendar";

const base = { id: "i1", title: "T", start: "2026-01-01T09:00:00", end: "2026-01-01T10:00:00", allDay: false, linkCount: 0 };

const manual: AgendaItem = { ...base, kind: "event", source: "manual", calendarId: "c", missingSince: null };
const synced: AgendaItem = { ...manual, source: "sync" };
const meal: AgendaItem = { ...base, kind: "meal", slot: "dinner", servings: 4, thumbnailPath: null, attached: false, position: 1000 };
const card: AgendaItem = { ...base, kind: "planned_card", board: "B", column: "C" };
const deadline: AgendaItem = { ...base, kind: "deadline", allDay: true, start: "2026-01-01", end: null };

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
