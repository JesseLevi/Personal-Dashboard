"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/recipes/session";
import { normalizeIngredientName } from "@/lib/recipes/import/match-ingredients";
import {
  createAliasSchema,
  createEigenIngredientSchema,
  deleteAliasSchema,
  deleteEigenIngredientSchema,
  updateAliasSchema,
  updateEigenIngredientSchema,
} from "@/lib/recipes/ingredient-admin-schemas";
import type { ActionResult, RecipesErrorCode } from "@/lib/recipes/types";
import type { Database } from "@/lib/database.types";

// Admin ingredient management (#325, ADR-0020 §2/§4/§6). Every action:
//   1. rejects non-admins with "forbidden" (UI gate; RLS is the real boundary);
//   2. validates input with zod;
//   3. writes through the signed-in user's RLS-bound client -- never service_role.
// `eigen` rows are the only reference rows an admin may change (RLS enforces
// source = 'eigen'; the explicit filters below make a mismatch a clean not-found).

type RecipeUnit = Database["public"]["Enums"]["recipe_unit"];

const PAGE = "/recepten/ingredienten";
const UNIQUE_VIOLATION = "23505";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

async function adminClient() {
  if (!(await isAdmin())) return null;
  return createSupabaseServerClient();
}

type Client = NonNullable<Awaited<ReturnType<typeof adminClient>>>;
type EigenInput = ReturnType<typeof createEigenIngredientSchema.parse>;

function failure(error: RecipesErrorCode) {
  return { success: false, error } as const;
}

// ---------------------------------------------------------------------------
// Koppelingen (reference.ingredient_aliases)
// ---------------------------------------------------------------------------

export async function createAlias(input: unknown): Promise<ActionResult<{ id: string }>> {
  const supabase = await adminClient();
  if (!supabase) return failure("forbidden");
  const parsed = createAliasSchema.safeParse(input);
  if (!parsed.success) return failure("invalid-input");
  const key = normalizeIngredientName(parsed.data.name);
  if (key === "") return failure("invalid-input");

  const { data, error } = await supabase
    .schema("reference")
    .from("ingredient_aliases")
    .insert({ alias_normalized: key, ingredient_id: parsed.data.ingredientId })
    .select("id")
    .single();
  if (error) {
    if (error.code === UNIQUE_VIOLATION) return failure("duplicate");
    console.error("[recipes] createAlias failed:", error.code, error.message);
    return failure("generic");
  }
  revalidatePath(PAGE);
  return { success: true, data: { id: data.id } };
}

export async function updateAlias(input: unknown): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return failure("forbidden");
  const parsed = updateAliasSchema.safeParse(input);
  if (!parsed.success) return failure("invalid-input");
  const key = normalizeIngredientName(parsed.data.name);
  if (key === "") return failure("invalid-input");

  const { data, error } = await supabase
    .schema("reference")
    .from("ingredient_aliases")
    .update({ alias_normalized: key, ingredient_id: parsed.data.ingredientId })
    .eq("id", parsed.data.aliasId)
    .select("id");
  if (error) {
    if (error.code === UNIQUE_VIOLATION) return failure("duplicate");
    console.error("[recipes] updateAlias failed:", error.code, error.message);
    return failure("generic");
  }
  if (data.length === 0) return failure("not-found");
  revalidatePath(PAGE);
  return { success: true, data: undefined };
}

export async function deleteAlias(input: unknown): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return failure("forbidden");
  const parsed = deleteAliasSchema.safeParse(input);
  if (!parsed.success) return failure("invalid-input");

  const { data, error } = await supabase
    .schema("reference")
    .from("ingredient_aliases")
    .delete()
    .eq("id", parsed.data.aliasId)
    .select("id");
  if (error) {
    console.error("[recipes] deleteAlias failed:", error.code, error.message);
    return failure("generic");
  }
  if (data.length === 0) return failure("not-found");
  revalidatePath(PAGE);
  return { success: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Eigen ingrediënten (reference.ingredients, source = 'eigen')
// ---------------------------------------------------------------------------

function ingredientColumns(input: EigenInput) {
  return {
    name_nl: input.nameNl,
    name_en: input.nameEn,
    category_nl: input.categoryNl,
    category_en: input.categoryEn,
    kcal_per_100g: input.kcal,
    protein_g_per_100g: input.protein,
    carbs_g_per_100g: input.carbs,
    fat_g_per_100g: input.fat,
    fiber_g_per_100g: input.fiber,
    source_version: todayIso(),
  };
}

// Replaces the single optional eigen weight-per-unit of one ingredient.
async function replaceUnitMass(
  supabase: Client,
  ingredientId: string,
  unitMass: EigenInput["unitMass"],
): Promise<boolean> {
  const removed = await supabase
    .schema("reference")
    .from("ingredient_unit_masses")
    .delete()
    .eq("ingredient_id", ingredientId)
    .eq("source", "eigen");
  if (removed.error) return false;
  if (!unitMass) return true;
  const inserted = await supabase
    .schema("reference")
    .from("ingredient_unit_masses")
    .insert({
      ingredient_id: ingredientId,
      unit: unitMass.unit as RecipeUnit,
      grams: unitMass.grams,
      source: "eigen",
      source_version: todayIso(),
    });
  return !inserted.error;
}

export async function createEigenIngredient(input: unknown): Promise<ActionResult<{ id: string }>> {
  const supabase = await adminClient();
  if (!supabase) return failure("forbidden");
  const parsed = createEigenIngredientSchema.safeParse(input);
  if (!parsed.success) return failure("invalid-input");

  const { data, error } = await supabase
    .schema("reference")
    .from("ingredients")
    .insert({ ...ingredientColumns(parsed.data), source: "eigen", nutrient_basis: "per_100g" })
    .select("id")
    .single();
  if (error) {
    console.error("[recipes] createEigenIngredient failed:", error.code, error.message);
    return failure("generic");
  }
  if (!(await replaceUnitMass(supabase, data.id, parsed.data.unitMass))) {
    // Compensate so a half-saved ingredient never lingers without its weight.
    await supabase
      .schema("reference")
      .from("ingredients")
      .delete()
      .eq("id", data.id)
      .eq("source", "eigen");
    return failure("generic");
  }
  revalidatePath(PAGE);
  return { success: true, data: { id: data.id } };
}

export async function updateEigenIngredient(input: unknown): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return failure("forbidden");
  const parsed = updateEigenIngredientSchema.safeParse(input);
  if (!parsed.success) return failure("invalid-input");

  const { data, error } = await supabase
    .schema("reference")
    .from("ingredients")
    .update(ingredientColumns(parsed.data))
    .eq("id", parsed.data.ingredientId)
    .eq("source", "eigen")
    .select("id");
  if (error) {
    console.error("[recipes] updateEigenIngredient failed:", error.code, error.message);
    return failure("generic");
  }
  if (data.length === 0) return failure("not-found");
  if (!(await replaceUnitMass(supabase, parsed.data.ingredientId, parsed.data.unitMass))) {
    return failure("generic");
  }
  revalidatePath(PAGE);
  return { success: true, data: undefined };
}

// Users' public.ingredients.reference_id goes to null (FK set null) and the
// ingredient's aliases and unit masses cascade (ADR-0020 §4).
export async function deleteEigenIngredient(input: unknown): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return failure("forbidden");
  const parsed = deleteEigenIngredientSchema.safeParse(input);
  if (!parsed.success) return failure("invalid-input");

  const { data, error } = await supabase
    .schema("reference")
    .from("ingredients")
    .delete()
    .eq("id", parsed.data.ingredientId)
    .eq("source", "eigen")
    .select("id");
  if (error) {
    console.error("[recipes] deleteEigenIngredient failed:", error.code, error.message);
    return failure("generic");
  }
  if (data.length === 0) return failure("not-found");
  revalidatePath(PAGE);
  return { success: true, data: undefined };
}
