import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthenticatedUserId, isAdmin } from "@/lib/recipes/session";
import { normalizeIngredientName } from "@/lib/recipes/import/normalize-name";
import type { SupabaseClient } from "@supabase/supabase-js";
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

// ---------------------------------------------------------------------------
// Nog te koppelen (#326, ADR-0020 §6): the admin's OWN unlinked lines.
// ---------------------------------------------------------------------------

export interface PendingGroup {
  /** `normalizeIngredientName` of the line name; the grouping key. */
  key: string;
  /** Most common original spelling in the group, shown to the admin and used to create the alias. */
  name: string;
  count: number;
}

export interface PendingLine {
  id: string;
  name: string;
}

const PENDING_PAGE_SIZE = 1000;
const PENDING_MAX_LINES = 10000;

/**
 * The caller's own lines with needs_review or no ingredient. Filters on
 * user_id explicitly on top of RLS (ADR-0002/0003); never another user's lines.
 */
export async function fetchOwnPendingLines(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<PendingLine[]> {
  const lines: PendingLine[] = [];
  for (let from = 0; from < PENDING_MAX_LINES; from += PENDING_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("recipe_ingredients")
      .select("id, name")
      .eq("user_id", userId)
      .or("needs_review.eq.true,ingredient_id.is.null")
      .order("id", { ascending: true })
      .range(from, from + PENDING_PAGE_SIZE - 1);
    if (error) {
      console.error("[recipes] fetchOwnPendingLines failed:", error.code, error.message);
      throw new Error("Failed to load unlinked ingredient lines");
    }
    lines.push(...data);
    if (data.length < PENDING_PAGE_SIZE) break;
  }
  return lines;
}

export function groupPendingLines(lines: PendingLine[]): PendingGroup[] {
  const groups = new Map<string, { spellings: Map<string, number>; count: number }>();
  for (const line of lines) {
    const key = normalizeIngredientName(line.name);
    if (key === "") continue;
    const group = groups.get(key) ?? { spellings: new Map(), count: 0 };
    const spelling = line.name.trim();
    group.spellings.set(spelling, (group.spellings.get(spelling) ?? 0) + 1);
    group.count += 1;
    groups.set(key, group);
  }
  return [...groups.entries()]
    .map(([key, group]) => {
      const [name] = [...group.spellings.entries()].sort((a, b) => b[1] - a[1])[0];
      return { key, name, count: group.count };
    })
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

export async function getPendingIngredientGroups(): Promise<PendingGroup[]> {
  if (!(await isAdmin())) return [];
  const userId = await getAuthenticatedUserId();
  if (!userId) return [];
  const supabase = await createSupabaseServerClient();
  return groupPendingLines(await fetchOwnPendingLines(supabase, userId));
}

// ---------------------------------------------------------------------------
// Categories for the own-ingredient picker: every distinct NL/EN pair already
// in reference.ingredients (NEVO food groups plus categories added by an admin).
// ---------------------------------------------------------------------------

export interface IngredientCategory {
  nl: string;
  en: string | null;
}

const CATEGORY_PAGE_SIZE = 1000;
const CATEGORY_MAX_ROWS = 20000;

/** One entry per Dutch name; the first non-empty English name wins. Sorted by Dutch name. */
export function distinctCategories(
  rows: { category_nl: string | null; category_en: string | null }[],
): IngredientCategory[] {
  const byNl = new Map<string, string | null>();
  for (const row of rows) {
    const nl = row.category_nl?.trim();
    if (!nl) continue;
    const en = row.category_en?.trim() || null;
    if (!byNl.has(nl) || (byNl.get(nl) === null && en)) byNl.set(nl, en);
  }
  return [...byNl.entries()]
    .map(([nl, en]) => ({ nl, en }))
    .sort((a, b) => a.nl.localeCompare(b.nl, "nl"));
}

export async function getIngredientCategories(): Promise<IngredientCategory[]> {
  if (!(await isAdmin())) return [];
  const supabase = await createSupabaseServerClient();
  const rows: { category_nl: string | null; category_en: string | null }[] = [];
  // PostgREST caps a response at 1000 rows; NEVO alone has ~2300.
  for (let from = 0; from < CATEGORY_MAX_ROWS; from += CATEGORY_PAGE_SIZE) {
    const { data, error } = await supabase
      .schema("reference")
      .from("ingredients")
      .select("category_nl, category_en")
      .not("category_nl", "is", null)
      .order("id", { ascending: true })
      .range(from, from + CATEGORY_PAGE_SIZE - 1);
    if (error) {
      console.error("[recipes] getIngredientCategories failed:", error.code, error.message);
      throw new Error("Failed to load ingredient categories");
    }
    rows.push(...data);
    if (data.length < CATEGORY_PAGE_SIZE) break;
  }
  return distinctCategories(rows);
}
