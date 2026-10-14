import { describe, expect, it } from "vitest";
import {
  filterPlanCards,
  groupOpenCards,
  plannedLabelStyle,
  toAgendaResult,
  withPlannedFor,
  type PlanBoardInput,
  type PlanCardGroup,
} from "../lib/agenda/plan-cards";
import { createCardSchema, planCardSchema, updateCardSchema } from "../lib/boards/schemas";

const ID = "6f1c9d52-0f6e-4c43-9d3b-2f0a1b7c8e11";

describe("planCardSchema", () => {
  it("accepts a day and returns it as YYYY-MM-DD", () => {
    expect(planCardSchema.parse({ cardId: ID, plannedFor: "2026-10-17" })).toEqual({ cardId: ID, plannedFor: "2026-10-17" });
  });

  it("accepts the panel's dd-mm-yyyy text", () => {
    expect(planCardSchema.parse({ cardId: ID, plannedFor: "17-10-2026" }).plannedFor).toBe("2026-10-17");
    expect(planCardSchema.parse({ cardId: ID, plannedFor: "7/1/2026" }).plannedFor).toBe("2026-01-07");
  });

  it("accepts null, which clears the day", () => {
    expect(planCardSchema.parse({ cardId: ID, plannedFor: null }).plannedFor).toBeNull();
  });

  it("requires plannedFor: a missing field is not a clear", () => {
    expect(planCardSchema.safeParse({ cardId: ID }).success).toBe(false);
  });

  it("rejects days that do not exist, wrong shapes and bad ids", () => {
    expect(planCardSchema.safeParse({ cardId: ID, plannedFor: "2026-02-31" }).success).toBe(false);
    expect(planCardSchema.safeParse({ cardId: ID, plannedFor: "31-02-2026" }).success).toBe(false);
    expect(planCardSchema.safeParse({ cardId: ID, plannedFor: "" }).success).toBe(false);
    expect(planCardSchema.safeParse({ cardId: ID, plannedFor: "2026-10-17T10:00:00Z" }).success).toBe(false);
    expect(planCardSchema.safeParse({ cardId: "nope", plannedFor: "2026-10-17" }).success).toBe(false);
  });
});

describe("plannedFor on create and update", () => {
  it("is optional on both and validated when sent", () => {
    expect(updateCardSchema.safeParse({ cardId: ID, title: "x" }).success).toBe(true);
    expect(updateCardSchema.parse({ cardId: ID, plannedFor: "03-11-2026" }).plannedFor).toBe("2026-11-03");
    expect(updateCardSchema.parse({ cardId: ID, plannedFor: null }).plannedFor).toBeNull();
    expect(updateCardSchema.safeParse({ cardId: ID, plannedFor: "gisteren" }).success).toBe(false);
    expect(createCardSchema.parse({ columnId: ID, title: "x", plannedFor: "2026-11-03" }).plannedFor).toBe("2026-11-03");
  });
});

const board = (id: string, name: string, isFavorite: boolean, position: number, columns: PlanBoardInput["board_columns"]): PlanBoardInput => ({
  id,
  name,
  is_favorite: isFavorite,
  position,
  board_columns: columns,
});

const card = (id: string, title: string, position: number, plannedFor: string | null = null) => ({
  id,
  title,
  planned_for: plannedFor,
  position,
});

describe("groupOpenCards", () => {
  const boards = [
    board("b2", "Werk", false, 2000, [
      { name: "Bezig", position: 1000, cards: [card("c3", "Rapport", 1000)] },
      { name: "Afgerond", position: 2000, cards: [card("c4", "Oud", 1000)] },
    ]),
    board("b1", "Thuis", true, 1000, [
      { name: "Bezig", position: 2000, cards: [card("c2", "Tuin", 2000, "2026-10-17"), card("c1", "Boodschappen", 1000)] },
      { name: "Ideeën", position: 1000, cards: [card("c0", "Verven", 1000)] },
      { name: "Afgerond", position: 3000, cards: [card("c9", "Klaar", 1000)] },
    ]),
    board("b3", "Leeg", false, 3000, [{ name: "Afgerond", position: 1000, cards: [card("c5", "Klaar", 1000)] }]),
  ];

  it("puts the favourite board first and then goes by position", () => {
    expect(groupOpenCards(boards).map((group) => group.boardId)).toEqual(["b1", "b2"]);
  });

  it("leaves out the rightmost (done) column and boards without an open card", () => {
    const titles = groupOpenCards(boards).flatMap((group) => group.cards.map((c) => c.title));
    expect(titles).not.toContain("Klaar");
    expect(titles).not.toContain("Oud");
  });

  it("keeps column order, then card position, and carries the column and day", () => {
    expect(groupOpenCards(boards)[0].cards).toEqual([
      { id: "c0", title: "Verven", columnName: "Ideeën", plannedFor: null },
      { id: "c1", title: "Boodschappen", columnName: "Bezig", plannedFor: null },
      { id: "c2", title: "Tuin", columnName: "Bezig", plannedFor: "2026-10-17" },
    ]);
  });
});

describe("filterPlanCards", () => {
  const groups: PlanCardGroup[] = [
    { boardId: "b1", boardName: "Thuis", cards: [{ id: "c1", title: "Café boeken", columnName: "Bezig", plannedFor: null }] },
    { boardId: "b2", boardName: "Werk", cards: [{ id: "c2", title: "Rapport", columnName: "Bezig", plannedFor: null }] },
  ];

  it("ignores case and accents and drops boards left empty", () => {
    expect(filterPlanCards(groups, "CAFE").map((group) => group.boardId)).toEqual(["b1"]);
  });

  it("returns everything for a blank query", () => {
    expect(filterPlanCards(groups, "  ")).toEqual(groups);
  });
});

describe("withPlannedFor", () => {
  const groups: PlanCardGroup[] = [
    { boardId: "b1", boardName: "Thuis", cards: [{ id: "c1", title: "A", columnName: "Bezig", plannedFor: "2026-10-17" }] },
  ];

  it("sets and clears the day of one card without touching the input", () => {
    expect(withPlannedFor(groups, "c1", "2026-10-20")[0].cards[0].plannedFor).toBe("2026-10-20");
    expect(withPlannedFor(groups, "c1", null)[0].cards[0].plannedFor).toBeNull();
    expect(groups[0].cards[0].plannedFor).toBe("2026-10-17");
  });
});

describe("plannedLabelStyle", () => {
  it("shows the weekday for today and the next six days, otherwise the date", () => {
    expect(plannedLabelStyle("2026-10-14", "2026-10-14")).toBe("weekday");
    expect(plannedLabelStyle("2026-10-20", "2026-10-14")).toBe("weekday");
    expect(plannedLabelStyle("2026-10-21", "2026-10-14")).toBe("date");
    expect(plannedLabelStyle("2026-10-13", "2026-10-14")).toBe("date");
  });
});

describe("toAgendaResult", () => {
  it("passes success through and keeps read-only and not-found", () => {
    expect(toAgendaResult({ success: true, data: undefined })).toEqual({ success: true, data: undefined });
    expect(toAgendaResult({ success: false, error: "read-only" })).toEqual({ success: false, error: "read-only" });
    expect(toAgendaResult({ success: false, error: "not-found" })).toEqual({ success: false, error: "not-found" });
  });

  it("turns the board-only code into generic", () => {
    expect(toAgendaResult({ success: false, error: "column-mismatch" })).toEqual({ success: false, error: "generic" });
  });
});
