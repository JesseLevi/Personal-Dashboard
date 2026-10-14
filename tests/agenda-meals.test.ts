import { describe, expect, it } from "vitest";
import {
  compareMeals,
  lastMealPosition,
  mealBasketLines,
  planDays,
  weekBasketLines,
  weekRange,
  type MealForBasket,
} from "../lib/agenda/meals";
import { filterPlanRecipes, type PlanRecipe } from "../lib/agenda/plan-recipes";
import {
  createMealSchema,
  sendWeekSchema,
  updateMealSchema,
} from "../lib/agenda/schemas";
import type { SendToListIngredient } from "../lib/shopping/send-to-list";
import { compareEventOrder, type EventOrderSubject } from "../lib/ui/agenda-calendar";

const ID = "6f1c9d52-0f6e-4c43-9d3b-2f0a1b7c8e11";
const ID2 = "7a2d0e63-1a7f-4d54-8e4c-3a1b2c8d9f22";

const ingredient = (overrides: Partial<SendToListIngredient>): SendToListIngredient => ({
  name: "Bloem",
  quantity: 100,
  unit: "gram",
  ...overrides,
});

const meal = (
  mealPlanId: string,
  servings: number,
  ingredients: SendToListIngredient[],
  recipeServings = 4,
): MealForBasket<SendToListIngredient> => ({ mealPlanId, recipeServings, servings, ingredients });

describe("compareMeals", () => {
  it("orders by moment, then position, then title", () => {
    const meals = [
      { slot: "snack", position: 1000, title: "A" },
      { slot: "dinner", position: 2000, title: "B" },
      { slot: "dinner", position: 1000, title: "C" },
      { slot: "breakfast", position: 5000, title: "D" },
    ] as const;
    expect([...meals].sort(compareMeals).map((m) => m.title)).toEqual(["D", "C", "B", "A"]);
  });
});

describe("lastMealPosition", () => {
  it("starts an empty group at 1000 and goes after the highest", () => {
    expect(lastMealPosition([])).toBe(1000);
    expect(lastMealPosition([1000, 3000, 2000])).toBe(4000);
  });
});

describe("planDays and weekRange", () => {
  it("lists today and the days after", () => {
    expect(planDays("2026-10-30")).toEqual(["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02", "2026-11-03"]);
  });

  it("covers Monday to the next Monday", () => {
    expect(weekRange("2026-10-14")).toEqual({ from: "2026-10-12", to: "2026-10-19" });
    expect(weekRange("2026-10-18")).toEqual({ from: "2026-10-12", to: "2026-10-19" });
  });
});

describe("mealBasketLines", () => {
  it("scales to the planned servings and tags the meal", () => {
    const lines = mealBasketLines(meal(ID, 8, [ingredient({ quantity: 100 })]));
    expect(lines).toEqual([{ name: "Bloem", quantity: 200, unit: "gram", tag: ID, referenceIngredientId: undefined }]);
  });

  it("scales down", () => {
    expect(mealBasketLines(meal(ID, 2, [ingredient({ quantity: 100 })]))[0].quantity).toBe(50);
  });
});

describe("weekBasketLines", () => {
  it("sums the same ingredient and unit across meals, each at its own servings", () => {
    const lines = weekBasketLines([
      meal(ID, 4, [ingredient({ quantity: 100 })]),
      meal(ID2, 8, [ingredient({ quantity: 100 })]),
    ]);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ name: "Bloem", quantity: 300, unit: "gram", tag: ID });
  });

  it("matches names regardless of case and keeps the first spelling", () => {
    const lines = weekBasketLines([
      meal(ID, 4, [ingredient({ name: "Bloem", quantity: 100 })]),
      meal(ID2, 4, [ingredient({ name: " bloem ", quantity: 50 })]),
    ]);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ name: "Bloem", quantity: 150 });
  });

  it("never merges across units", () => {
    const lines = weekBasketLines([
      meal(ID, 4, [ingredient({ quantity: 100, unit: "gram" })]),
      meal(ID2, 4, [ingredient({ quantity: 1, unit: "cup" })]),
    ]);
    expect(lines.map((l) => l.unit)).toEqual(["gram", "cup"]);
  });

  it("keeps a known quantity when the other side is 'to taste'", () => {
    const lines = weekBasketLines([
      meal(ID, 4, [ingredient({ name: "Zout", quantity: null })]),
      meal(ID2, 4, [ingredient({ name: "Zout", quantity: 5 })]),
    ]);
    expect(lines[0].quantity).toBe(5);
  });

  it("stays null when no meal gives a quantity", () => {
    const lines = weekBasketLines([
      meal(ID, 4, [ingredient({ name: "Zout", quantity: null })]),
      meal(ID2, 4, [ingredient({ name: "Zout", quantity: null })]),
    ]);
    expect(lines[0].quantity).toBeNull();
  });

  it("merges inside one meal as well and keeps first-seen order", () => {
    const lines = weekBasketLines([
      meal(ID, 4, [ingredient({ name: "Ui", quantity: 1, unit: "stuk" }), ingredient({ name: "Bloem" }), ingredient({ name: "ui", quantity: 2, unit: "stuk" })]),
    ]);
    expect(lines.map((l) => [l.name, l.quantity])).toEqual([
      ["Ui", 3],
      ["Bloem", 100],
    ]);
  });

  it("is empty without meals", () => {
    expect(weekBasketLines([])).toEqual([]);
  });
});

describe("meal schemas", () => {
  it("needs exactly one of a day and an event", () => {
    expect(createMealSchema.safeParse({ recipeId: ID, plannedOn: "2026-10-14" }).success).toBe(true);
    expect(createMealSchema.safeParse({ recipeId: ID, calendarEventId: ID2 }).success).toBe(true);
    expect(createMealSchema.safeParse({ recipeId: ID }).success).toBe(false);
    expect(createMealSchema.safeParse({ recipeId: ID, plannedOn: "2026-10-14", calendarEventId: ID2 }).success).toBe(false);
  });

  it("defaults the moment to dinner and rejects bad servings", () => {
    expect(createMealSchema.parse({ recipeId: ID, plannedOn: "2026-10-14" }).slot).toBe("dinner");
    expect(createMealSchema.safeParse({ recipeId: ID, plannedOn: "2026-10-14", servings: 0 }).success).toBe(false);
    expect(createMealSchema.safeParse({ recipeId: ID, plannedOn: "2026-10-14", slot: "brunch" }).success).toBe(false);
  });

  it("needs something to update", () => {
    expect(updateMealSchema.safeParse({ id: ID }).success).toBe(false);
    expect(updateMealSchema.safeParse({ id: ID, servings: 3 }).success).toBe(true);
    expect(updateMealSchema.safeParse({ id: ID, plannedOn: "2026-10-16" }).success).toBe(true);
  });

  it("needs a non-empty week range", () => {
    expect(sendWeekSchema.safeParse({ from: "2026-10-12", to: "2026-10-19" }).success).toBe(true);
    expect(sendWeekSchema.safeParse({ from: "2026-10-19", to: "2026-10-12" }).success).toBe(false);
  });
});

describe("filterPlanRecipes", () => {
  const recipe = (id: string, title: string, categoryId: string): PlanRecipe => ({
    id,
    title,
    servings: 4,
    categoryId,
    timeMinutes: null,
    thumbnailUrl: null,
    thumbnailPath: null,
  });
  const recipes = [recipe("1", "Crème brûlée", "dessert"), recipe("2", "Lasagne", "main"), recipe("3", "Lasagne bianca", "main")];

  it("returns everything without a filter", () => {
    expect(filterPlanRecipes(recipes, { query: "", categoryId: "" })).toHaveLength(3);
  });

  it("matches the title ignoring case and accents", () => {
    expect(filterPlanRecipes(recipes, { query: "CREME", categoryId: "" }).map((r) => r.id)).toEqual(["1"]);
  });

  it("combines query and category", () => {
    expect(filterPlanRecipes(recipes, { query: "lasagne", categoryId: "main" })).toHaveLength(2);
    expect(filterPlanRecipes(recipes, { query: "lasagne", categoryId: "dessert" })).toHaveLength(0);
  });
});

describe("compareEventOrder", () => {
  const subject = (over: Partial<EventOrderSubject>): EventOrderSubject => ({
    allDay: 1,
    start: Date.UTC(2026, 9, 14),
    duration: 0,
    title: "T",
    ...over,
  });
  const meal = (slot: string, position: number, title = "T") =>
    subject({ title, item: { kind: "meal", slot, position, title } });

  it("puts all-day items before timed ones", () => {
    const timed = subject({ allDay: 0, start: Date.UTC(2026, 9, 14, 9), item: { kind: "event" } });
    expect(compareEventOrder(meal("dinner", 1000), timed)).toBeLessThan(0);
  });

  it("orders timed items by start, then longest first", () => {
    const early = subject({ allDay: 0, start: 1, duration: 10, title: "early" });
    const late = subject({ allDay: 0, start: 2, duration: 99, title: "late" });
    const longEarly = subject({ allDay: 0, start: 1, duration: 50, title: "long" });
    expect([late, early, longEarly].sort(compareEventOrder).map((s) => s.title)).toEqual(["long", "early", "late"]);
  });

  it("groups meals per moment, then by position, after events", () => {
    const event = subject({ item: { kind: "event" } });
    const sorted = [meal("snack", 1000, "s"), meal("dinner", 2000, "d2"), event, meal("dinner", 1000, "d1"), meal("breakfast", 9000, "b")].sort(
      compareEventOrder,
    );
    expect(sorted.map((s) => s.title)).toEqual(["T", "b", "d1", "d2", "s"]);
  });
});
