import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { setProviderForTests, type AiProvider } from "@/lib/ai";
import { needsUnitWeight, planUnitWeights, type PreviousLine } from "@/lib/recipes/unit-weights";
import type { UnitGramsLookup } from "@/lib/recipes/import/unit-grams";

afterEach(() => setProviderForTests(undefined));

const line = (name: string, quantity: number | null, unit: string, ingredientId: string | null) =>
  ({ name, quantity, unit, ingredientId }) as Parameters<typeof planUnitWeights>[0][number];

/** Known weights per `ingredient:unit`. */
const lookup =
  (known: Record<string, number>): UnitGramsLookup =>
  (ingredientId, unit) =>
    known[`${ingredientId}:${unit}`] ?? null;

describe("needsUnitWeight", () => {
  it("asks only for counts and volumes with an amount", () => {
    expect(needsUnitWeight(2, "stuk")).toBe(true);
    expect(needsUnitWeight(1, "eetlepel")).toBe(true);
    expect(needsUnitWeight(200, "gram")).toBe(false);
    expect(needsUnitWeight(null, "stuk")).toBe(false);
    expect(needsUnitWeight(1, "snufje")).toBe(false);
    expect(needsUnitWeight(1, "naar_smaak")).toBe(false);
  });
});

describe("planUnitWeights", () => {
  it("carries the previous link's weight over to a re-linked line", () => {
    const previous: PreviousLine[] = [{ name: "Ui", unit: "stuk", ingredientId: "ui-gebakken" }];
    const plan = planUnitWeights(
      [line("ui", 2, "stuk", "ui-rauw")],
      previous,
      lookup({ "ui-gebakken:stuk": 110 }),
    );
    expect(plan.carried).toEqual([{ ingredientId: "ui-rauw", unit: "stuk", grams: 110 }]);
    expect(plan.ask).toEqual([]);
  });

  it("asks for an estimate when the old link had no weight either (or the line was unlinked)", () => {
    const plan = planUnitWeights(
      [line("Selderij", 2, "stuk", "selderij")],
      [{ name: "Selderij", unit: "stuk", ingredientId: null }],
      lookup({}),
    );
    expect(plan.carried).toEqual([]);
    expect(plan.ask).toEqual([{ ingredientId: "selderij", unit: "stuk", name: "Selderij" }]);
  });

  it("leaves lines alone that already weigh, are in grams, or did not change", () => {
    const plan = planUnitWeights(
      [
        line("ui", 2, "stuk", "ui"),
        line("bloem", 200, "gram", "bloem"),
        line("ei", 3, "stuk", "ei"),
        line("los", 1, "stuk", null),
      ],
      [{ name: "ei", unit: "stuk", ingredientId: "ei" }],
      lookup({ "ui:stuk": 100 }),
    );
    expect(plan).toEqual({ carried: [], ask: [] });
  });

  it("handles an (ingredient, unit) pair once", () => {
    const plan = planUnitWeights([line("ui", 1, "stuk", "ui"), line("ui", 2, "stuk", "ui")], [], lookup({}));
    expect(plan.ask).toHaveLength(1);
  });
});

describe("fillMissingUnitWeights", () => {
  it("stores the carried weight and an LLM estimate, never failing the save", async () => {
    const { fillMissingUnitWeights } = await import("@/lib/recipes/unit-weights");
    const upserts: unknown[] = [];
    const ok = (data: unknown) => Promise.resolve({ data, error: null, count: 0 });
    const chain = (table: string) => {
      const c: Record<string, unknown> = {};
      c.select = () => c;
      c.eq = () => c;
      c.gt = () => ok(null);
      c.in = () =>
        ok(
          table === "ingredients"
            ? [
                { id: "ui-rauw", reference_id: null, name: "Ui rauw" },
                { id: "ui-gebakken", reference_id: null, name: "Ui gebakken" },
                { id: "selderij", reference_id: null, name: "Selderij rauw" },
              ]
            : [{ ingredient_id: "ui-gebakken", unit: "stuk", grams: 110 }],
        );
      c.upsert = (rows: unknown) => {
        upserts.push(rows);
        return Promise.resolve({ error: null });
      };
      return c;
    };
    const client = { from: chain, schema: () => ({ from: chain }) };

    const provider: AiProvider = {
      generateObject: vi.fn().mockResolvedValue({ items: [{ i: 0, grams: 40 }] }) as AiProvider["generateObject"],
    };
    setProviderForTests(provider);

    await fillMissingUnitWeights(
      client as never,
      "u1",
      [
        { name: "Ui", quantity: 2, unit: "stuk", ingredientId: "ui-rauw", groupLabel: null, needsReview: false },
        { name: "Selderij", quantity: 2, unit: "stuk", ingredientId: "selderij", groupLabel: null, needsReview: false },
      ],
      [{ name: "Ui", unit: "stuk", ingredientId: "ui-gebakken" }],
    );

    expect(upserts).toEqual([
      [
        { user_id: "u1", ingredient_id: "ui-rauw", unit: "stuk", grams: 110 },
        { user_id: "u1", ingredient_id: "selderij", unit: "stuk", grams: 40 },
      ],
    ]);
  });
});
