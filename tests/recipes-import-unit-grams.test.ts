import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { loadUnitGrams } from "@/lib/recipes/import/unit-grams";
import type { MatcherClient } from "@/lib/recipes/import/match-ingredients";

type Result = { data: unknown; error: { code: string; message: string } | null };

/** Every query chain resolves to the result for its table; `in` is the last call. */
function fakeClient(results: { own?: Result; overrides?: Result; reference?: Result }) {
  const chain = (result: Result) => {
    const c = { select: () => c, eq: () => c, in: () => Promise.resolve(result) };
    return c;
  };
  const ok = (data: unknown[]): Result => ({ data, error: null });
  const client = {
    from: (table: string) =>
      chain(table === "ingredients" ? (results.own ?? ok([])) : (results.overrides ?? ok([]))),
    schema: () => ({ from: () => chain(results.reference ?? ok([])) }),
  };
  return client as unknown as MatcherClient;
}

const OWN = { data: [{ id: "ui", reference_id: "ref-ui" }, { id: "eigen", reference_id: null }], error: null };

describe("loadUnitGrams", () => {
  it("resolves NEVO's weight per piece through the ingredient's reference row", async () => {
    const lookup = await loadUnitGrams(
      fakeClient({ own: OWN, reference: { data: [{ ingredient_id: "ref-ui", unit: "stuk", grams: 100 }], error: null } }),
      "u1",
      ["ui"],
    );
    expect(lookup("ui", "stuk")).toBe(100);
    expect(lookup("ui", "eetlepel")).toBeNull();
    expect(lookup("eigen", "stuk")).toBeNull();
  });

  it("a user override beats the reference row", async () => {
    const lookup = await loadUnitGrams(
      fakeClient({
        own: OWN,
        overrides: { data: [{ ingredient_id: "ui", unit: "stuk", grams: 120 }], error: null },
        reference: { data: [{ ingredient_id: "ref-ui", unit: "stuk", grams: 100 }], error: null },
      }),
      "u1",
      ["ui"],
    );
    expect(lookup("ui", "stuk")).toBe(120);
  });

  it("bridges an eetlepel row to an imported tablespoon", async () => {
    const lookup = await loadUnitGrams(
      fakeClient({ own: OWN, reference: { data: [{ ingredient_id: "ref-ui", unit: "eetlepel", grams: 15 }], error: null } }),
      "u1",
      ["ui"],
    );
    expect(lookup("ui", "tablespoon")).toBeCloseTo(14.79);
  });

  it("knows nothing for no ids or on a database error", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await loadUnitGrams(fakeClient({}), "u1", []))("x", "stuk")).toBeNull();
    const failing = fakeClient({ own: { data: null, error: { code: "42501", message: "nope" } } });
    expect((await loadUnitGrams(failing, "u1", ["ui"]))("ui", "stuk")).toBeNull();
    spy.mockRestore();
  });
});
