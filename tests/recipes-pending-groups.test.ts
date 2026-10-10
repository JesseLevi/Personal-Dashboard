import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const admin = vi.hoisted(() => ({ value: true }));
const client = vi.hoisted(() => ({ current: null as unknown }));
const resolved = vi.hoisted(() => ({ value: "own-ingredient-id" as string | null }));
vi.mock("@/lib/recipes/session", () => ({
  isAdmin: async () => admin.value,
  requireUserId: async () => ({ userId: "me" }),
  getAuthenticatedUserId: async () => "me",
}));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => client.current }));
vi.mock("@/lib/recipes/import/match-ingredients", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/recipes/import/match-ingredients")>()),
  resolveIngredientId: async () => resolved.value,
}));

import { linkPendingGroup } from "@/app/(app)/recepten/ingredienten/actions";
import { fetchOwnPendingLines, groupPendingLines } from "@/lib/recipes/ingredient-admin";

const REF = "11111111-1111-4111-8111-111111111111";

type Row = Record<string, unknown>;
type Op = { table: string; op: string; payload?: unknown; filters: [string, unknown][] };

/**
 * In-memory fake over recipe_ingredients (two users) that applies the eq/in
 * filters it is given, so a missing user_id filter shows up as leaked rows.
 */
function fakeClient(opts: { existingAliasTarget?: string; aliasError?: { code: string; message: string }; massError?: { code: string; message: string } } = {}) {
  const lines: Row[] = [
    { id: "l1", user_id: "me", name: "Tomaten", ingredient_id: null, needs_review: false },
    { id: "l2", user_id: "me", name: "tomaten", ingredient_id: "x", needs_review: true },
    { id: "l3", user_id: "me", name: "Ui", ingredient_id: null, needs_review: true },
    { id: "l4", user_id: "me", name: "Gelinkt", ingredient_id: "y", needs_review: false },
    { id: "o1", user_id: "other", name: "tomaten", ingredient_id: null, needs_review: true },
  ];
  const ops: Op[] = [];
  const builder = (table: string) => {
    const filters: [string, unknown][] = [];
    let op = "select";
    let payload: unknown;
    const chain: Record<string, unknown> = {};
    const matches = (row: Row) =>
      filters.every(([key, value]) => (key === "id" && Array.isArray(value) ? value.includes(row.id) : row[key] === value));
    const run = () => {
      ops.push({ table, op, payload, filters: [...filters] });
      if (table === "recipe_ingredients") {
        const eligible = lines.filter((row) => row.needs_review === true || row.ingredient_id === null);
        if (op === "select") return { data: eligible.filter(matches).map(({ id, name }) => ({ id, name })), error: null };
        if (op === "update") {
          for (const row of lines.filter(matches)) Object.assign(row, payload);
          return { data: null, error: null };
        }
      }
      if (table === "ingredients") return { data: { id: REF, name_nl: "Tomaat, rauw" }, error: null };
      if (table === "ingredient_aliases" && op === "select") {
        return { data: opts.existingAliasTarget ? { ingredient_id: opts.existingAliasTarget } : null, error: null };
      }
      if (table === "ingredient_aliases" && op === "insert") return { data: null, error: opts.aliasError ?? null };
      if (table === "ingredient_unit_masses" && op === "insert") return { data: null, error: opts.massError ?? null };
      return { data: null, error: null };
    };
    for (const name of ["select", "insert", "update", "delete"]) {
      chain[name] = (arg?: unknown) => {
        if (name !== "select" || op === "select") op = name;
        if (name !== "select") payload = arg;
        return chain;
      };
    }
    chain.eq = (key: string, value: unknown) => (filters.push([key, value]), chain);
    chain.in = (key: string, value: unknown) => (filters.push([key, value]), chain);
    chain.or = () => chain;
    chain.order = () => chain;
    chain.range = () => chain;
    chain.maybeSingle = async () => run();
    chain.then = (resolve: (value: unknown) => void) => resolve(run());
    return chain;
  };
  const supabase = { from: builder, schema: () => ({ from: builder }) };
  client.current = supabase;
  return { supabase, lines, ops };
}

beforeEach(() => {
  admin.value = true;
  resolved.value = "own-ingredient-id";
});

describe("groupPendingLines", () => {
  it("groups by normalised name, counts, and shows the most common spelling", () => {
    const groups = groupPendingLines([
      { id: "1", name: "Tomaten" },
      { id: "2", name: "tomaten" },
      { id: "3", name: "tomaten" },
      { id: "4", name: "Ui" },
    ]);
    expect(groups).toEqual([
      { key: "tomaat", name: "tomaten", count: 3 },
      { key: "ui", name: "Ui", count: 1 },
    ]);
  });
});

describe("fetchOwnPendingLines", () => {
  it("lists only the caller's own unlinked lines, never another user's", async () => {
    const { supabase } = fakeClient();
    const found = await fetchOwnPendingLines(supabase as never, "me");
    expect(found.map((line) => line.id)).toEqual(["l1", "l2", "l3"]);
  });
});

describe("linkPendingGroup", () => {
  it("rejects non-admins before touching the database", async () => {
    const { ops } = fakeClient();
    admin.value = false;
    expect(await linkPendingGroup({ name: "tomaten", ingredientId: REF })).toEqual({ success: false, error: "forbidden" });
    expect(ops).toHaveLength(0);
  });

  it("rejects invalid input", async () => {
    fakeClient();
    expect(await linkPendingGroup({ name: "tomaten", ingredientId: "nope" })).toEqual({
      success: false,
      error: "invalid-input",
    });
  });

  it("creates the shared alias and relinks only the caller's lines with that name", async () => {
    const { lines, ops } = fakeClient();
    const result = await linkPendingGroup({ name: "Tomaten", ingredientId: REF });
    expect(result).toEqual({ success: true, data: { relinked: 2 } });
    const alias = ops.find((op) => op.table === "ingredient_aliases" && op.op === "insert")!;
    expect(alias.payload).toEqual({ alias_normalized: "tomaat", ingredient_id: REF });
    const byId = Object.fromEntries(lines.map((row) => [row.id, row]));
    expect(byId.l1).toMatchObject({ ingredient_id: "own-ingredient-id", needs_review: false });
    expect(byId.l2).toMatchObject({ ingredient_id: "own-ingredient-id", needs_review: false });
    expect(byId.l3).toMatchObject({ ingredient_id: null, needs_review: true });
    expect(byId.o1).toMatchObject({ ingredient_id: null, needs_review: true });
    const update = ops.find((op) => op.table === "recipe_ingredients" && op.op === "update")!;
    expect(update.filters).toContainEqual(["user_id", "me"]);
  });

  it("stores an optional weight per unit as an eigen row", async () => {
    const { ops } = fakeClient();
    await linkPendingGroup({ name: "tomaten", ingredientId: REF, unitMass: { unit: "stuk", grams: "60,5" } });
    const insert = ops.find((op) => op.table === "ingredient_unit_masses" && op.op === "insert")!;
    expect(insert.payload).toMatchObject({ ingredient_id: REF, unit: "stuk", grams: 60.5, source: "eigen" });
    const removal = ops.find((op) => op.table === "ingredient_unit_masses" && op.op === "delete")!;
    expect(removal.filters).toContainEqual(["source", "eigen"]);
  });

  it("reuses an existing alias that points at the same ingredient and still relinks", async () => {
    const { lines } = fakeClient({ aliasError: { code: "23505", message: "dup" }, existingAliasTarget: REF });
    expect(await linkPendingGroup({ name: "tomaten", ingredientId: REF })).toEqual({
      success: true,
      data: { relinked: 2 },
    });
    expect(lines.find((row) => row.id === "l1")).toMatchObject({ ingredient_id: "own-ingredient-id", needs_review: false });
  });

  it("gives a weight-per-unit clash its own error code", async () => {
    fakeClient({ massError: { code: "23505", message: "dup" } });
    expect(
      await linkPendingGroup({ name: "tomaten", ingredientId: REF, unitMass: { unit: "stuk", grams: 60 } }),
    ).toEqual({ success: false, error: "unit-mass-exists" });
  });

  it("stops on an alias pointing at a different ingredient without touching any line", async () => {
    const { lines } = fakeClient({
      aliasError: { code: "23505", message: "dup" },
      existingAliasTarget: "99999999-9999-4999-8999-999999999999",
    });
    expect(await linkPendingGroup({ name: "tomaten", ingredientId: REF })).toEqual({ success: false, error: "duplicate" });
    expect(lines.find((row) => row.id === "l1")).toMatchObject({ ingredient_id: null });
  });

  it("fails cleanly when the own ingredient cannot be adopted", async () => {
    resolved.value = null;
    fakeClient();
    expect(await linkPendingGroup({ name: "tomaten", ingredientId: REF })).toEqual({ success: false, error: "generic" });
  });
});
