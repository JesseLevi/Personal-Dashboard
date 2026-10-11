import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const admin = vi.hoisted(() => ({ value: true }));
const client = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/lib/recipes/session", () => ({ isAdmin: async () => admin.value }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => client.current }));

import {
  createAlias,
  createEigenIngredient,
  deleteAlias,
  deleteEigenIngredient,
  updateAlias,
  updateEigenIngredient,
} from "@/app/(app)/recepten/ingredienten/actions";
import {
  createEigenIngredientSchema,
  createAliasSchema,
} from "@/lib/recipes/ingredient-admin-schemas";

const ID = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

type Call = { schema: string; table: string; op: string; args: unknown[] };

/** Chainable fake recording every call; `plan` decides each terminal result by "table.op". */
function fakeClient(plan: Record<string, { data?: unknown; error?: { code: string; message: string } | null }> = {}) {
  const calls: Call[] = [];
  const supabase = {
    schema(schema: string) {
      return {
        from(table: string) {
          let op = "select";
          const chain: Record<string, unknown> = {};
          const record =
            (name: string) =>
            (...args: unknown[]) => {
              calls.push({ schema, table, op: name, args });
              if (name === "insert" || name === "update" || name === "delete") op = name;
              return chain;
            };
          for (const name of ["select", "eq", "insert", "update", "delete"]) chain[name] = record(name);
          const result = () => {
            const planned = plan[`${table}.${op}`] ?? {};
            return { data: planned.data ?? [{ id: ID }], error: planned.error ?? null };
          };
          chain.single = async () => {
            const r = result();
            return { data: Array.isArray(r.data) ? r.data[0] : r.data, error: r.error };
          };
          chain.then = (resolve: (v: unknown) => void) => resolve(result());
          return chain;
        },
      };
    },
  };
  client.current = supabase;
  return calls;
}

const valid = { nameNl: "Pindakaas", kcal: "600", unitMass: null };
const payload = (calls: Call[], table: string, op: string) =>
  calls.find((c) => c.table === table && c.op === op)!.args[0] as Record<string, unknown>;

beforeEach(() => {
  admin.value = true;
});

describe("every action rejects non-admins before touching the database", () => {
  const actions: [string, (input: unknown) => Promise<unknown>, unknown][] = [
    ["createAlias", createAlias, { name: "tomaten", ingredientId: ID }],
    ["updateAlias", updateAlias, { aliasId: ID, name: "tomaten", ingredientId: ID }],
    ["deleteAlias", deleteAlias, { aliasId: ID }],
    ["createEigenIngredient", createEigenIngredient, valid],
    ["updateEigenIngredient", updateEigenIngredient, { ingredientId: ID, ...valid }],
    ["deleteEigenIngredient", deleteEigenIngredient, { ingredientId: ID }],
  ];
  it.each(actions)("%s returns forbidden", async (_name, action, input) => {
    admin.value = false;
    const calls = fakeClient();
    expect(await action(input)).toEqual({ success: false, error: "forbidden" });
    expect(calls).toHaveLength(0);
  });
});

describe("aliases", () => {
  it("stores the normalised key, not the typed name", async () => {
    const calls = fakeClient();
    const result = await createAlias({ name: "  Tomaten (rijp), grof ", ingredientId: ID });
    expect(result.success).toBe(true);
    expect(payload(calls, "ingredient_aliases", "insert")).toEqual({ alias_normalized: "tomaat", ingredient_id: ID });
    expect(calls[0].schema).toBe("reference");
  });

  it("rejects bad input", async () => {
    fakeClient();
    expect(await createAlias({ name: "   ", ingredientId: ID })).toEqual({ success: false, error: "invalid-input" });
    expect(await createAlias({ name: "tomaat", ingredientId: "nope" })).toEqual({ success: false, error: "invalid-input" });
    expect(await createAlias({ name: "()", ingredientId: ID })).toEqual({ success: false, error: "invalid-input" });
  });

  it("maps a unique violation to duplicate", async () => {
    fakeClient({ "ingredient_aliases.insert": { error: { code: "23505", message: "dup" } } });
    expect(await createAlias({ name: "tomaat", ingredientId: ID })).toEqual({ success: false, error: "duplicate" });
  });

  it("update re-normalises the key and reports a missing row", async () => {
    const calls = fakeClient({ "ingredient_aliases.update": { data: [] } });
    expect(await updateAlias({ aliasId: ID, name: "Uien", ingredientId: OTHER })).toEqual({
      success: false,
      error: "not-found",
    });
    expect(payload(calls, "ingredient_aliases", "update")).toEqual({ alias_normalized: "ui", ingredient_id: OTHER });
  });

  it("delete reports a missing row", async () => {
    fakeClient({ "ingredient_aliases.delete": { data: [] } });
    expect(await deleteAlias({ aliasId: ID })).toEqual({ success: false, error: "not-found" });
  });
});

describe("eigen ingredients", () => {
  it("turns empty nutrients into null, never 0", async () => {
    const calls = fakeClient();
    await createEigenIngredient({
      nameNl: "Pindakaas",
      nameEn: "",
      categoryNl: " ",
      kcal: "",
      protein: "25,5",
      carbs: null,
      fat: undefined,
      fiber: "0",
    });
    expect(payload(calls, "ingredients", "insert")).toMatchObject({
      name_nl: "Pindakaas",
      name_en: null,
      category_nl: null,
      kcal_per_100g: null,
      protein_g_per_100g: 25.5,
      carbs_g_per_100g: null,
      fat_g_per_100g: null,
      fiber_g_per_100g: 0,
      source: "eigen",
      nutrient_basis: "per_100g",
    });
  });

  it("stamps source_version with today's ISO date", async () => {
    const calls = fakeClient();
    await createEigenIngredient(valid);
    expect(payload(calls, "ingredients", "insert").source_version).toBe(new Date().toISOString().slice(0, 10));
  });

  it("writes an eigen unit mass and replaces the previous one on update", async () => {
    const calls = fakeClient();
    const result = await updateEigenIngredient({
      ingredientId: ID,
      ...valid,
      unitMass: { unit: "stuk", grams: "60" },
    });
    expect(result.success).toBe(true);
    expect(calls.some((c) => c.table === "ingredient_unit_masses" && c.op === "delete")).toBe(true);
    expect(payload(calls, "ingredient_unit_masses", "insert")).toMatchObject({
      ingredient_id: ID,
      unit: "stuk",
      grams: 60,
      source: "eigen",
    });
  });

  it("filters updates and deletes on source = eigen", async () => {
    const calls = fakeClient();
    await updateEigenIngredient({ ingredientId: ID, ...valid });
    await deleteEigenIngredient({ ingredientId: ID });
    const sourceFilters = calls.filter((c) => c.op === "eq" && c.args[0] === "source" && c.table === "ingredients");
    expect(sourceFilters).toHaveLength(2);
  });

  it("reports not-found when RLS hides the row (e.g. a NEVO row)", async () => {
    fakeClient({ "ingredients.update": { data: [] }, "ingredients.delete": { data: [] } });
    expect(await updateEigenIngredient({ ingredientId: ID, ...valid })).toEqual({ success: false, error: "not-found" });
    expect(await deleteEigenIngredient({ ingredientId: ID })).toEqual({ success: false, error: "not-found" });
  });
});

describe("schemas", () => {
  it("rejects negatives, non-numbers and mass units", () => {
    expect(createEigenIngredientSchema.safeParse({ nameNl: "x", kcal: "-1" }).success).toBe(false);
    expect(createEigenIngredientSchema.safeParse({ nameNl: "x", kcal: "abc" }).success).toBe(false);
    expect(createEigenIngredientSchema.safeParse({ nameNl: "x", unitMass: { unit: "gram", grams: 5 } }).success).toBe(false);
    expect(createEigenIngredientSchema.safeParse({ nameNl: "x", unitMass: { unit: "stuk", grams: 0 } }).success).toBe(false);
    expect(createEigenIngredientSchema.safeParse({ nameNl: " ", kcal: 1 }).success).toBe(false);
  });
  it("requires a uuid target", () => {
    expect(createAliasSchema.safeParse({ name: "a", ingredientId: "x" }).success).toBe(false);
  });
});
