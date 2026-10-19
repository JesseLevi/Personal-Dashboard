import { describe, expect, it } from "vitest";
import { createCalendarSchema, updateCalendarSchema } from "@/lib/agenda/calendars";
import { AGENDA_COLORS, isAgendaColor, nextFreeColor } from "@/lib/agenda/colors";
import {
  NOTHING_HIDDEN,
  isHidden,
  isItemHidden,
  parseHidden,
  serializeHidden,
  withVisibility,
} from "@/lib/agenda/hidden";
import type { AgendaItem } from "@/lib/agenda/types";

const ID_A = "00000000-0000-4000-8000-00000000000a";
const ID_B = "00000000-0000-4000-8000-00000000000b";
const base = { title: "T", start: "2026-01-01", end: null, allDay: true, linkCount: 0 };

describe("next free colour", () => {
  it("is the first palette colour when nothing is used", () => {
    expect(nextFreeColor([])).toBe("red");
  });

  it("skips colours in use, in palette order", () => {
    expect(nextFreeColor(["blue", "violet", "red"])).toBe("orange");
  });

  it("takes the least used colour once every colour is in use", () => {
    const once = [...AGENDA_COLORS];
    expect(nextFreeColor(once)).toBe("red");
    expect(nextFreeColor([...once, "red", "orange"])).toBe("amber");
  });

  it("knows the palette keys", () => {
    expect(isAgendaColor("teal")).toBe(true);
    expect(isAgendaColor("purple")).toBe(false);
    expect(isAgendaColor(undefined)).toBe(false);
  });
});

describe("hidden cookie", () => {
  it("round-trips kinds and calendar ids", () => {
    const hidden = { calendars: [ID_A, ID_B], kinds: ["meal", "deadline"] as const };
    const value = serializeHidden({ calendars: hidden.calendars, kinds: [...hidden.kinds] });
    expect(value).toBe(`meal.deadline.${ID_A}.${ID_B}`);
    expect(parseHidden(value)).toEqual(hidden);
  });

  it("starts empty and drops anything it does not know", () => {
    expect(parseHidden(undefined)).toEqual(NOTHING_HIDDEN);
    expect(parseHidden("")).toEqual(NOTHING_HIDDEN);
    expect(parseHidden(`event.nonsense.${ID_A}.${ID_A}.planned_card`)).toEqual({ calendars: [ID_A], kinds: ["planned_card"] });
  });

  it("hides and shows a calendar or a kind", () => {
    const hiddenCalendar = withVisibility(NOTHING_HIDDEN, { calendar: ID_A }, false);
    expect(isHidden(hiddenCalendar, { calendar: ID_A })).toBe(true);
    expect(isHidden(hiddenCalendar, { calendar: ID_B })).toBe(false);
    expect(withVisibility(hiddenCalendar, { calendar: ID_A }, true)).toEqual(NOTHING_HIDDEN);

    const hiddenKind = withVisibility(NOTHING_HIDDEN, { kind: "deadline" }, false);
    expect(isHidden(hiddenKind, { kind: "deadline" })).toBe(true);
    expect(isHidden(hiddenKind, { kind: "meal" })).toBe(false);
    expect(withVisibility(hiddenKind, { kind: "deadline" }, true)).toEqual(NOTHING_HIDDEN);
  });

  it("filters an event by its calendar and the other items by their kind", () => {
    const event: AgendaItem = { ...base, id: "e", kind: "event", source: "manual", calendarId: ID_A, color: "blue", missingSince: null };
    const meal: AgendaItem = { ...base, id: "m", kind: "meal", slot: "dinner", servings: 2, thumbnailPath: null, attached: false, position: 1000 };
    const card: AgendaItem = { ...base, id: "c", kind: "planned_card", board: "B", column: "K" };
    const deadline: AgendaItem = { ...base, id: "d", kind: "deadline" };
    const hidden = { calendars: [ID_A], kinds: ["meal" as const] };
    expect([event, meal, card, deadline].map((item) => isItemHidden(item, hidden))).toEqual([true, true, false, false]);
    expect(isItemHidden(event, { calendars: [ID_B], kinds: [] })).toBe(false);
  });
});

describe("calendar input", () => {
  it("accepts a name and a palette colour", () => {
    expect(createCalendarSchema.safeParse({ name: "  Sport ", color: "orange" })).toMatchObject({
      success: true,
      data: { name: "Sport", color: "orange" },
    });
  });

  it("rejects an empty name and a colour outside the palette", () => {
    expect(createCalendarSchema.safeParse({ name: " ", color: "orange" }).success).toBe(false);
    expect(createCalendarSchema.safeParse({ name: "Sport", color: "purple" }).success).toBe(false);
  });

  it("needs a name or a colour to update", () => {
    expect(updateCalendarSchema.safeParse({ id: ID_A }).success).toBe(false);
    expect(updateCalendarSchema.safeParse({ id: ID_A, color: "teal" }).success).toBe(true);
    expect(updateCalendarSchema.safeParse({ id: ID_A, name: "Werk" }).success).toBe(true);
    expect(updateCalendarSchema.safeParse({ id: "x", name: "Werk" }).success).toBe(false);
  });
});
