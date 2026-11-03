import { describe, expect, it } from "vitest";
import {
  attachedEventTitle,
  basketSuggestion,
  eventIdsWithMeals,
  clockOf,
  groupDay,
  isEmptyDay,
  isEmptyDayCards,
  itemOnDay,
  limitRows,
  timeLabel,
  timelineState,
  TIMELINE_LIMIT,
  TODO_LIMIT,
} from "@/lib/agenda/day-cards";
import type { AgendaEventItem, AgendaItem, AgendaMealItem } from "@/lib/agenda/types";

const DAY = "2026-11-02";

const event = (id: string, start: string, over: Partial<AgendaEventItem> = {}): AgendaEventItem => ({
  kind: "event", id, title: id, start, end: null, allDay: false, linkCount: 0,
  source: "manual", calendarId: "c", color: "blue", missingSince: null, ...over,
});
const allDay = (id: string, start = DAY, end: string | null = null) => event(id, start, { allDay: true, end });
const meal = (id: string, slot: AgendaMealItem["slot"], position = 1000, start = DAY): AgendaMealItem => ({
  kind: "meal", id, title: id, start, end: null, allDay: true, linkCount: 0,
  slot, servings: 2, thumbnailPath: null, attached: false, position,
});

describe("itemOnDay", () => {
  it("matches the start day of a timed or all-day item", () => {
    expect(itemOnDay(event("a", `${DAY}T09:00:00`), DAY)).toBe(true);
    expect(itemOnDay(event("a", "2026-11-03T09:00:00"), DAY)).toBe(false);
    expect(itemOnDay(event("a", "2026-11-01T09:00:00"), DAY)).toBe(false);
  });

  it("treats an all-day end as exclusive", () => {
    const trip = allDay("trip", "2026-11-01", "2026-11-03");
    expect(itemOnDay(trip, "2026-11-01")).toBe(true);
    expect(itemOnDay(trip, DAY)).toBe(true);
    expect(itemOnDay(trip, "2026-11-03")).toBe(false);
  });

  it("lets a timed event run into the next day unless it ends at midnight", () => {
    expect(itemOnDay(event("night", "2026-11-01T22:00:00", { end: `${DAY}T01:00:00` }), DAY)).toBe(true);
    expect(itemOnDay(event("late", "2026-11-01T22:00:00", { end: `${DAY}T00:00:00` }), DAY)).toBe(false);
  });
});

describe("groupDay", () => {
  it("keeps only the shown day", () => {
    const groups = groupDay([event("today", `${DAY}T09:00:00`), event("tomorrow", "2026-11-03T09:00:00"), meal("later", "dinner", 1, "2026-11-03")], DAY);
    expect(groups.events.map((e) => e.id)).toEqual(["today"]);
    expect(groups.meals).toEqual([]);
  });

  it("orders all-day events first, then by start time", () => {
    const { events } = groupDay([event("late", `${DAY}T15:00:00`), allDay("day"), event("early", `${DAY}T09:00:00`)], DAY);
    expect(events.map((e) => e.id)).toEqual(["day", "early", "late"]);
  });

  it("orders meals by moment, then position", () => {
    const { meals } = groupDay([meal("diner", "dinner"), meal("ontbijt2", "breakfast", 2000), meal("ontbijt1", "breakfast")], DAY);
    expect(meals.map((m) => m.id)).toEqual(["ontbijt1", "ontbijt2", "diner"]);
  });

  it("puts planned cards before deadlines", () => {
    const { cards } = groupDay(
      [
        { kind: "deadline", id: "d", title: "A", start: DAY, end: null, allDay: true, linkCount: 0 },
        { kind: "planned_card", id: "p", title: "B", start: DAY, end: null, allDay: true, linkCount: 0, board: "b", column: "c" },
      ],
      DAY,
    );
    expect(cards.map((c) => c.id)).toEqual(["p", "d"]);
  });

  it("knows an empty day", () => {
    const items: AgendaItem[] = [event("other", "2026-11-05T09:00:00")];
    expect(isEmptyDay(groupDay(items, DAY))).toBe(true);
    expect(isEmptyDay(groupDay([...items, meal("m", "dinner")], DAY))).toBe(false);
  });
});

describe("limitRows", () => {
  const rows = (n: number) => Array.from({ length: n }, (_, i) => i);

  it("shows everything up to the limit", () => {
    expect(limitRows(rows(TIMELINE_LIMIT), TIMELINE_LIMIT)).toEqual({ shown: rows(5), more: 0 });
  });

  it("cuts after the limit and counts the rest", () => {
    expect(limitRows(rows(8), TIMELINE_LIMIT)).toEqual({ shown: rows(5), more: 3 });
    expect(limitRows(rows(4), TODO_LIMIT)).toEqual({ shown: rows(3), more: 1 });
  });

  it("shows all rows once expanded", () => {
    expect(limitRows(rows(8), TIMELINE_LIMIT, true)).toEqual({ shown: rows(8), more: 0 });
  });
});

describe("time", () => {
  it("reads the clock from a local date-time, with or without offset", () => {
    expect(clockOf("2026-11-01T09:30:00+01:00")).toBe("09:30");
    expect(clockOf("2026-11-01T09:30:00")).toBe("09:30");
  });

  it("labels a span, a start only, and all day", () => {
    expect(timeLabel(event("a", `${DAY}T09:00:00`, { end: `${DAY}T10:15:00` }))).toBe("09:00–10:15");
    expect(timeLabel(event("a", `${DAY}T09:00:00`))).toBe("09:00");
    expect(timeLabel(allDay("a"))).toBeNull();
  });
});

describe("timelineState", () => {
  const meeting = event("m", `${DAY}T14:00:00`, { end: `${DAY}T15:00:00` });

  it("is upcoming before the start, now during, past from the end", () => {
    expect(timelineState(meeting, `${DAY}T13:59`)).toBe("upcoming");
    expect(timelineState(meeting, `${DAY}T14:00`)).toBe("now");
    expect(timelineState(meeting, `${DAY}T14:59`)).toBe("now");
    expect(timelineState(meeting, `${DAY}T15:00`)).toBe("past");
  });

  it("treats an event without an end as past once it started, never as now", () => {
    const point = event("p", `${DAY}T09:00:00`);
    expect(timelineState(point, `${DAY}T08:59`)).toBe("upcoming");
    expect(timelineState(point, `${DAY}T09:00`)).toBe("past");
  });

  it("keeps all-day events upcoming", () => {
    expect(timelineState(allDay("a"), `${DAY}T23:00`)).toBe("upcoming");
  });
});

describe("attached meals", () => {
  const bodil = event("e-bodil", `${DAY}T19:00:00`, { title: "Eten met Bodil" });
  const dahl: AgendaMealItem = { ...meal("dahl", "dinner"), attached: true, eventId: "e-bodil" };

  it("names the event an attached meal hangs on, from the loaded items", () => {
    expect(attachedEventTitle(dahl, [bodil, dahl])).toBe("Eten met Bodil");
  });

  it("names nothing for a day meal or an event that is not loaded", () => {
    expect(attachedEventTitle(meal("plain", "dinner"), [bodil])).toBeNull();
    expect(attachedEventTitle(dahl, [dahl])).toBeNull();
  });

  it("lists the events that have a meal", () => {
    expect([...eventIdsWithMeals([bodil, dahl, meal("plain", "lunch")])]).toEqual(["e-bodil"]);
    expect(eventIdsWithMeals([bodil]).size).toBe(0);
  });

  it("groups an attached meal with the day's meals and offers it for the basket", () => {
    const groups = groupDay([bodil, dahl, meal("tosti", "lunch")], DAY);
    expect(groups.meals.map((item) => item.id)).toEqual(["tosti", "dahl"]);
    expect(basketSuggestion(groups.meals, new Set(["tosti"]))).toEqual({ mealIds: ["dahl"], title: "dahl" });
  });
});

describe("basketSuggestion", () => {
  const meals = [meal("a", "lunch"), meal("b", "dinner")];

  it("suggests the meals without a basket item, one suggestion for the day", () => {
    expect(basketSuggestion(meals, new Set())).toEqual({ mealIds: ["a", "b"], title: "a" });
  });

  it("leaves out the meals already in the basket", () => {
    expect(basketSuggestion(meals, new Set(["a"]))).toEqual({ mealIds: ["b"], title: "b" });
  });

  it("is null when every meal is in the basket or there are none", () => {
    expect(basketSuggestion(meals, new Set(["a", "b"]))).toBeNull();
    expect(basketSuggestion([], new Set())).toBeNull();
  });
});

describe("isEmptyDayCards", () => {
  it("is empty without items on the day", () => {
    expect(isEmptyDayCards([event("a", "2026-11-03T09:00:00")], DAY, DAY, 0)).toBe(true);
    expect(isEmptyDayCards([event("a", `${DAY}T09:00:00`)], DAY, DAY, 0)).toBe(false);
  });

  it("counts signals only on today", () => {
    expect(isEmptyDayCards([], DAY, DAY, 2)).toBe(false);
    expect(isEmptyDayCards([], DAY, "2026-11-01", 2)).toBe(true);
  });
});
