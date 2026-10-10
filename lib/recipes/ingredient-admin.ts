import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/recipes/session";
import type { Database } from "@/lib/database.types";

// Read side of the admin ingredient page (#325, ADR-0020 §2/§4). User's
// RLS-bound client only; non-admins get empty lists (the page 404s first).

type RecipeUnit = Database["public"]["Enums"]["recipe_unit"];

export interface AdminAlias {
  id: string;
  aliasNormalized: string;
  ingredient: { id: string; nameNl: string; nameEn: string | null; source: string };
}

export interface AdminEigenIngredient {
  id: string;
  nameNl: string;
  nameEn: string | null;
  categoryNl: string | null;
  categoryEn: string | null;
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
  unitMass: { unit: RecipeUnit; grams: number } | null;
  sourceVersion: string;
}

export interface IngredientAdminData {
  aliases: AdminAlias[];
  eigen: AdminEigenIngredient[];
}

export async function getIngredientAdminData(): Promise<IngredientAdminData> {
  if (!(await isAdmin())) return { aliases: [], eigen: [] };
  const supabase = await createSupabaseServerClient();

  const [aliasResult, eigenResult, massResult] = await Promise.all([
    supabase
      .schema("reference")
      .from("ingredient_aliases")
      .select("id, alias_normalized, ingredients(id, name_nl, name_en, source)")
      .order("alias_normalized", { ascending: true }),
    supabase
      .schema("reference")
      .from("ingredients")
      .select("*")
      .eq("source", "eigen")
      .order("name_nl", { ascending: true }),
    supabase.schema("reference").from("ingredient_unit_masses").select("*").eq("source", "eigen"),
  ]);

  if (aliasResult.error || eigenResult.error || massResult.error) {
    const error = aliasResult.error ?? eigenResult.error ?? massResult.error!;
    console.error("[recipes] getIngredientAdminData failed:", error.code, error.message);
    throw new Error("Failed to load ingredient admin data");
  }

  const aliases: AdminAlias[] = [];
  for (const row of aliasResult.data) {
    const ingredient = row.ingredients;
    if (!ingredient) continue;
    aliases.push({
      id: row.id,
      aliasNormalized: row.alias_normalized,
      ingredient: {
        id: ingredient.id,
        nameNl: ingredient.name_nl,
        nameEn: ingredient.name_en,
        source: ingredient.source,
      },
    });
  }

  const massByIngredient = new Map(massResult.data.map((mass) => [mass.ingredient_id, mass]));
  const eigen: AdminEigenIngredient[] = eigenResult.data.map((row) => {
    const mass = massByIngredient.get(row.id);
    return {
      id: row.id,
      nameNl: row.name_nl,
      nameEn: row.name_en,
      categoryNl: row.category_nl,
      categoryEn: row.category_en,
      kcal: row.kcal_per_100g,
      protein: row.protein_g_per_100g,
      carbs: row.carbs_g_per_100g,
      fat: row.fat_g_per_100g,
      fiber: row.fiber_g_per_100g,
      unitMass: mass ? { unit: mass.unit, grams: mass.grams } : null,
      sourceVersion: row.source_version,
    };
  });

  return { aliases, eigen };
}
