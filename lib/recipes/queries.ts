import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthenticatedUserId } from "@/lib/recipes/session";
import { resolveMass } from "@/lib/recipes/mass-resolution";
import type { UnitCode } from "@/lib/recipes/units";
import type { Database } from "@/lib/database.types";
import type {
  CategoryWithRecipes,
  IngredientSearchResult,
  MassResolution,
  ReferenceIngredientRow,
  RecipeCategoryRow,
  RecipeIngredientRow,
  RecipeRow,
  RecipeStepIngredientRow,
  RecipeStepRow,
  RecipeWithIngredientsAndSteps,
} from "@/lib/recipes/types";

// Read side of #122 (mirrors lib/boards/queries.ts). Every function filters
// on the signed-in user's id in addition to relying on RLS (see the "don't
// trust the client for ownership" note on #92, applied here the same way)
// and never throws a database-shaped error message — the real detail goes to
// the server console only.

type Client = SupabaseClient<Database>;

// Exact shape of the nested selects below — declared once rather than
// inferred, for the same reason as lib/boards/queries.ts's
// RawBoardQueryRow: a raw multi-level embed string isn't reliably inferred
// by postgrest-js's generics, so overrideTypes() asserts it against these.
interface RawCategoryQueryRow extends RecipeCategoryRow {
  recipes: RecipeRow[];
}
// #149: each embedded recipe_steps row also carries its
// recipe_step_ingredients links (id-and-position only, not the full join
// row — nothing downstream needs the join row's own id/user_id/timestamps).
interface RawRecipeStepQueryRow extends RecipeStepRow {
  recipe_step_ingredients: Pick<RecipeStepIngredientRow, "recipe_ingredient_id" | "position">[];
}
interface RawRecipeQueryRow extends RecipeRow {
  recipe_ingredients: RecipeIngredientRow[];
  recipe_steps: RawRecipeStepQueryRow[];
}

/**
 * Every recipe category belonging to the signed-in user, ordered by
 * `position`, each with its recipes nested — the shape the recipe overview
 * (kanban-style, #124) needs in one round trip. Empty array if signed out.
 */
export async function getRecipeCategoriesWithRecipes(): Promise<CategoryWithRecipes[]> {
  const supabase = await createSupabaseServerClient();
  const userId = await getAuthenticatedUserId(supabase);
  if (!userId) return [];

  const { data, error } = await supabase
    .from("recipe_categories")
    .select(
      `
      id, user_id, name, icon, position, created_at, updated_at,
      recipes (
        id, user_id, category_id, title, servings, thumbnail_path,
        time_minutes, position, created_at, updated_at
      )
    `,
    )
    // Explicit ownership filter alongside RLS — see the module comment.
    // Not repeated on the nested `recipes` embed: RLS already scopes it to
    // the same user, same as lib/boards/queries.ts's board_columns/cards
    // embed.
    .eq("user_id", userId)
    .order("position", { ascending: true })
    .overrideTypes<RawCategoryQueryRow[], { merge: false }>();

  if (error) {
    console.error(
      "[recipes] getRecipeCategoriesWithRecipes failed:",
      error.code,
      error.message,
    );
    throw new Error("Failed to load recipe categories");
  }

  // #155: recipes now carry their own `position` (drag & drop reordering
  // within a category, 20260802010000_recipe_position.sql) -- sort by that,
  // same as every other position-ordered set in this codebase, instead of
  // the old `created_at` fallback from before that column existed.
  return data.map(({ recipes, ...category }) => ({
    ...category,
    recipes: [...recipes].sort((a, b) => a.position - b.position),
  }));
}

/**
 * One recipe — ingredients ordered by `position`, steps ordered by
 * `position` — fetched in a single PostgREST round trip. Returns `null` if
 * the recipe doesn't exist, isn't owned by the signed-in user, or the caller
 * is signed out. Feeds the recipe detail page (later ticket) but is built
 * here per #122's scope.
 */
export async function getRecipeWithIngredientsAndSteps(
  recipeId: string,
): Promise<RecipeWithIngredientsAndSteps | null> {
  const parsedId = z.uuid().safeParse(recipeId);
  if (!parsedId.success) return null;

  const supabase = await createSupabaseServerClient();
  const userId = await getAuthenticatedUserId(supabase);
  if (!userId) return null;

  const { data, error } = await supabase
    .from("recipes")
    .select(
      `
      id, user_id, category_id, title, servings, thumbnail_path,
      time_minutes, position, created_at, updated_at,
      recipe_ingredients (
        id, user_id, recipe_id, ingredient_id, name, quantity, unit,
        position, group_label, created_at, updated_at
      ),
      recipe_steps (
        id, user_id, recipe_id, position, instruction, created_at, updated_at,
        recipe_step_ingredients ( recipe_ingredient_id, position )
      )
    `,
    )
    .eq("id", parsedId.data)
    .eq("user_id", userId)
    .maybeSingle()
    .overrideTypes<RawRecipeQueryRow, { merge: false }>();

  if (error) {
    console.error(
      "[recipes] getRecipeWithIngredientsAndSteps failed:",
      error.code,
      error.message,
    );
    throw new Error("Failed to load recipe");
  }
  if (!data) return null;

  const { recipe_ingredients, recipe_steps, ...recipe } = data;
  return {
    ...recipe,
    ingredients: [...recipe_ingredients].sort((a, b) => a.position - b.position),
    steps: [...recipe_steps]
      .sort((a, b) => a.position - b.position)
      .map(({ recipe_step_ingredients, ...step }) => ({
        ...step,
        // #149: link rows aren't guaranteed embedded in position order —
        // sort explicitly, same as every other position-ordered set here.
        ingredientIds: [...recipe_step_ingredients]
          .sort((a, b) => a.position - b.position)
          .map((link) => link.recipe_ingredient_id),
      })),
  };
}

// ============================================================================
// ADR-0011 ingredient library functions (search, mass resolution). The third
// function the ticket describes — "create own ingredient" / "materialise a
// picked library ingredient" — is a write and lives in
// app/(app)/recepten/actions.ts's createOwnIngredient, not here.
// ============================================================================

// Escapes ilike's own wildcard characters in user-typed input so e.g.
// searching "50%" or "a_b" is treated as a literal substring, not a pattern
// the user didn't intend to write.
function escapeIlike(value: string): string {
  return value.replace(/[%_\\]/g, (char) => `\\${char}`);
}

async function referenceIngredientsMatching(
  supabase: Client,
  column: "name_nl" | "name_en",
  pattern: string,
  limit: number,
) {
  return supabase
    .schema("reference")
    .from("ingredients")
    .select("*")
    .ilike(column, pattern)
    .limit(limit);
}

/**
 * Searches the ingredient library (ADR-0011 §2) across both the user's own
 * `public.ingredients` and the shared, read-only `reference.ingredients` —
 * the data layer behind #131's search UI (that ticket builds the picker,
 * this function returns the matches). Empty array for a blank query or a
 * signed-out caller.
 *
 * Deviation from the ticket text, flagged rather than silently resolved:
 * the ticket asks for this to run "via pg_trgm (Architecture.md §103)", but
 * §103 scopes pg_trgm indexes to `notes.content_text`/`recipes.title`/
 * `recipe_ingredients.name` for Phase 7, not to the ingredient library, and
 * neither #130's nor #119's migration enables the `pg_trgm` extension or
 * indexes `ingredients.name`/`reference.ingredients.name_nl`. Adding the
 * extension + index now would be a schema change outside this ticket's
 * stated file list (a new migration), so this implementation uses
 * case-insensitive `ilike` substring matching instead — functionally
 * correct for the ~13-row hand-curated seed today, just not
 * similarity-ranked. Swapping this for real trigram search is a small,
 * self-contained follow-up once a migration adds the extension/index.
 */
export async function searchIngredientLibrary(
  query: string,
  limit = 20,
): Promise<IngredientSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const supabase = await createSupabaseServerClient();
  const userId = await getAuthenticatedUserId(supabase);
  if (!userId) return [];

  const pattern = `%${escapeIlike(trimmed)}%`;

  // Three separate queries rather than one `.or(...)` filter across
  // name_nl/name_en: PostgREST's `.or()` string syntax needs its own comma/
  // parenthesis escaping on top of ilike's, and this library is small
  // (hand-curated, ADR-0011 §5) — merging three short result sets in memory
  // is simpler and safer than getting that escaping right.
  const [ownResult, byNameNl, byNameEn] = await Promise.all([
    supabase
      .from("ingredients")
      .select("*")
      .eq("user_id", userId)
      .ilike("name", pattern)
      .order("name", { ascending: true })
      .limit(limit),
    referenceIngredientsMatching(supabase, "name_nl", pattern, limit),
    referenceIngredientsMatching(supabase, "name_en", pattern, limit),
  ]);

  if (ownResult.error) {
    console.error(
      "[recipes] searchIngredientLibrary (own) failed:",
      ownResult.error.code,
      ownResult.error.message,
    );
    throw new Error("Failed to search ingredients");
  }
  if (byNameNl.error || byNameEn.error) {
    const error = byNameNl.error ?? byNameEn.error!;
    console.error(
      "[recipes] searchIngredientLibrary (reference) failed:",
      error.code,
      error.message,
    );
    throw new Error("Failed to search ingredients");
  }

  // Dedupe: a hand-curated row could plausibly match both name_nl and
  // name_en for the same query (e.g. a loanword), and must only appear once.
  const referenceById = new Map<string, ReferenceIngredientRow>();
  for (const row of [...byNameNl.data, ...byNameEn.data]) {
    referenceById.set(row.id, row);
  }
  const reference = [...referenceById.values()].sort((a, b) =>
    a.name_nl.localeCompare(b.name_nl),
  );

  return [
    ...ownResult.data.map(
      (ingredient): IngredientSearchResult => ({ source: "own", ingredient }),
    ),
    ...reference.map(
      (ingredient): IngredientSearchResult => ({ source: "reference", ingredient }),
    ),
  ];
}

/**
 * Resolves the gram weight of one unit of `ingredientId` (a
 * `public.ingredients.id`), following ADR-0011 §3's order: user override
 * (`public.ingredient_unit_masses`) → reference
 * (`reference.ingredient_unit_masses`) → unresolved. "Unresolved" is
 * returned as an explicit `{ status: "unresolved" }`, never a `0`/`null`
 * grams value silently treated as a known weight — the exact pitfall
 * ADR-0011 §4 names for the (still-empty) nutrition columns, called out by
 * the ticket for this function specifically.
 *
 * Signed-out callers get `{ status: "unresolved" }` immediately (no
 * user-override table to check, and every call site so far is already
 * behind an authenticated recipe view) — same "no session, nothing to
 * resolve" shape as this module's other functions returning an empty/null
 * result when signed out.
 *
 * The precedence decision itself lives in the pure, framework-free
 * lib/recipes/mass-resolution.ts (resolveMass) — pulled out of this module
 * specifically because it, unlike this function, is unit-testable without a
 * database (tests/recipes-mass-resolution.test.ts): this function is the
 * thin, Supabase-dependent shell around it, same split as
 * lib/boards/positioning.ts's pure nextPosition vs. its DB-touching callers
 * in actions.ts.
 */
export async function resolveIngredientUnitMass(
  ingredientId: string,
  unit: UnitCode,
): Promise<MassResolution> {
  const parsedId = z.uuid().safeParse(ingredientId);
  if (!parsedId.success) return { status: "unresolved" };

  const supabase = await createSupabaseServerClient();
  const userId = await getAuthenticatedUserId(supabase);
  if (!userId) return { status: "unresolved" };

  const { data: override, error: overrideError } = await supabase
    .from("ingredient_unit_masses")
    .select("grams")
    .eq("user_id", userId)
    .eq("ingredient_id", parsedId.data)
    .eq("unit", unit)
    .maybeSingle();
  if (overrideError) {
    console.error(
      "[recipes] resolveIngredientUnitMass (override) failed:",
      overrideError.code,
      overrideError.message,
    );
    return { status: "unresolved" };
  }
  // Reference layer is deliberately not fetched at all once a user override
  // is found — resolveMass's ordering already makes it irrelevant to the
  // outcome, so skipping the extra round trip is a real (not just
  // theoretical) savings for every overridden ingredient.
  if (override) return resolveMass(override.grams, null);

  // reference.ingredient_unit_masses keys on reference.ingredients.id, not
  // public.ingredients.id (see 20260730000001_ingredient_library.sql) — the
  // owning ingredient row's reference_id is the bridge between the two.
  const { data: ingredient, error: ingredientError } = await supabase
    .from("ingredients")
    .select("reference_id")
    .eq("id", parsedId.data)
    .eq("user_id", userId)
    .maybeSingle();
  if (ingredientError) {
    console.error(
      "[recipes] resolveIngredientUnitMass (ingredient lookup) failed:",
      ingredientError.code,
      ingredientError.message,
    );
    return { status: "unresolved" };
  }
  if (!ingredient?.reference_id) return resolveMass(null, null);

  const { data: referenceMass, error: referenceError } = await supabase
    .schema("reference")
    .from("ingredient_unit_masses")
    .select("grams")
    .eq("ingredient_id", ingredient.reference_id)
    .eq("unit", unit)
    .maybeSingle();
  if (referenceError) {
    console.error(
      "[recipes] resolveIngredientUnitMass (reference) failed:",
      referenceError.code,
      referenceError.message,
    );
    return { status: "unresolved" };
  }

  return resolveMass(null, referenceMass?.grams ?? null);
}
