import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { embeddedCounts } from "@/lib/ui/embedded-counts";
import { getAuthenticatedUserId } from "@/lib/recipes/session";
import {
  EMPTY_BRIDGE_UNIT_GRAMS,
  resolveMassWithBridge,
  type BridgeUnitGrams,
} from "@/lib/recipes/mass-resolution";
import { EMPTY_KITCHEN_UNIT_MASSES, type KitchenUnitMasses } from "@/lib/recipes/kitchen-units";
import { EMPTY_NUTRIENTS } from "@/lib/recipes/nutrition";
import type { IngredientNutrients } from "@/lib/recipes/nutrition";
import { magnitudeOf, type UnitCode } from "@/lib/recipes/units";
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
  const userId = await getAuthenticatedUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from("recipe_categories")
    .select(
      `
      id, user_id, name, icon, position, created_at, updated_at,
      recipes (
        id, user_id, category_id, title, servings, thumbnail_path,
        time_minutes, position, created_at, updated_at,
        source_url, import_status, import_error
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
 * Batched nutrition inputs for #160's per-person nutrition row: for every
 * `recipe_ingredients` row with a linked `ingredient_id`, its
 * `reference.ingredients` nutrient-per-100g columns (via the public
 * ingredient's nullable `reference_id`) and its resolved grams-per-unit
 * (ADR-0011 §3's user-override-then-reference precedence, extended by
 * #164/#157 with the volume→ml and spoon bridges — via mass-resolution.ts's
 * `resolveMassWithBridge`, the same precedence `resolveIngredientUnitMass`
 * below uses, applied here as four batched queries total instead of one
 * round trip per ingredient row). The two mass queries below already
 * select every `unit` row per ingredient (no `.eq("unit", ...)` filter),
 * so the milliliter/eetlepel/theelepel rows the bridge tiers need are
 * already present in `userGramsByKey`/`referenceGramsByKey` — no extra
 * round trip was needed to satisfy the bridge, just reading more of what
 * was already fetched (see `bridgeUnitGramsFrom` below).
 *
 * Rows with no `ingredient_id` (the FK is an enrichment link, never a
 * precondition for rendering, ADR-0011 §2) are simply absent from the
 * returned map — the caller falls back to all-null inputs, which
 * `computeRecipeNutritionPerPerson` (lib/recipes/nutrition.ts) already
 * treats as "unknown", never "zero". A linked row whose reference ingredient
 * is `nutrient_basis = 'per_100ml'` is treated the same way (ADR-0013 §4,
 * see the guard below) — its numbers exist but aren't per-100g, so they're
 * unknown to this per-100g pipeline rather than silently misread.
 */
/**
 * Builds one ownership layer's `BridgeUnitGrams` (mass-resolution.ts) from
 * a `unit -> grams` lookup already fetched for one ingredient — shared by
 * `nutritionInputsForIngredients`' batched map lookup and
 * `resolveIngredientUnitMass`'s single-ingredient row list below. Only
 * `milliliter`/`eetlepel`/`theelepel` are ever populated here
 * (`tablespoon`/`teaspoon` stay `null`): this app's recipes are authored
 * in Dutch `eetlepel`/`theelepel`, not US `tablespoon`/`teaspoon`, so
 * fetching those two extra units for every ingredient would be dead
 * weight — `resolveMassWithBridge` itself stays fully bidirectional for
 * tests/future callers, this is just what the two query sites below
 * choose to feed it.
 */
function bridgeUnitGramsFrom(gramsForUnit: (unit: string) => number | null): BridgeUnitGrams {
  return {
    milliliter: gramsForUnit("milliliter"),
    eetlepel: gramsForUnit("eetlepel"),
    theelepel: gramsForUnit("theelepel"),
    tablespoon: null,
    teaspoon: null,
  };
}

// #164/#157 slice 2: grams-per-cup/tablespoon/teaspoon/fluid_ounce for one
// ingredient, resolved via the exact same resolveMassWithBridge/userBridge/
// referenceBridge inputs nutritionInputsForIngredients already builds for
// the row's own unit -- reads more of what nutritionInputsForIngredients
// already fetched (userGramsByKey/referenceGramsByKey carry every `unit`
// row per ingredient, no `.eq("unit", ...)` filter, see that function's own
// header) rather than a second round trip. Feeds
// lib/recipes/kitchen-units.ts's convertToKitchenUnit, via
// RecipeIngredientWithNutrition's new `kitchenUnitMasses` field.
function kitchenUnitMassesFor(
  ingredientId: string,
  referenceId: string | null,
  userGramsByKey: Map<string, number>,
  referenceGramsByKey: Map<string, number>,
  userBridge: BridgeUnitGrams,
  referenceBridge: BridgeUnitGrams,
): KitchenUnitMasses {
  function gramsFor(unit: "cup" | "tablespoon" | "teaspoon" | "fluid_ounce"): number | null {
    const userGrams = userGramsByKey.get(`${ingredientId}:${unit}`) ?? null;
    const referenceGrams = referenceId
      ? (referenceGramsByKey.get(`${referenceId}:${unit}`) ?? null)
      : null;
    const resolved = resolveMassWithBridge(unit, userGrams, referenceGrams, userBridge, referenceBridge);
    return resolved.status === "resolved" ? resolved.grams : null;
  }
  return {
    cup: gramsFor("cup"),
    tablespoon: gramsFor("tablespoon"),
    teaspoon: gramsFor("teaspoon"),
    fluid_ounce: gramsFor("fluid_ounce"),
  };
}

async function nutritionInputsForIngredients(
  supabase: Client,
  userId: string,
  ingredients: RecipeIngredientRow[],
): Promise<
  Map<
    string,
    {
      nutrients: IngredientNutrients;
      unitMassGrams: number | null;
      kitchenUnitMasses: KitchenUnitMasses;
      referenceIngredientId: string | null;
    }
  >
> {
  const result = new Map<
    string,
    {
      nutrients: IngredientNutrients;
      unitMassGrams: number | null;
      kitchenUnitMasses: KitchenUnitMasses;
      referenceIngredientId: string | null;
    }
  >();
  const ingredientIds = [
    ...new Set(ingredients.map((row) => row.ingredient_id).filter((id): id is string => id !== null)),
  ];
  if (ingredientIds.length === 0) return result;

  const { data: ownRows, error: ownError } = await supabase
    .from("ingredients")
    .select("id, reference_id")
    .eq("user_id", userId)
    .in("id", ingredientIds);
  if (ownError) {
    console.error(
      "[recipes] nutritionInputsForIngredients (ingredients) failed:",
      ownError.code,
      ownError.message,
    );
    return result;
  }

  const { data: userMassRows, error: userMassError } = await supabase
    .from("ingredient_unit_masses")
    .select("ingredient_id, unit, grams")
    .eq("user_id", userId)
    .in("ingredient_id", ingredientIds);
  if (userMassError) {
    console.error(
      "[recipes] nutritionInputsForIngredients (user masses) failed:",
      userMassError.code,
      userMassError.message,
    );
    return result;
  }

  const referenceIdByIngredientId = new Map(ownRows.map((row) => [row.id, row.reference_id] as const));
  const referenceIds = [
    ...new Set(ownRows.map((row) => row.reference_id).filter((id): id is string => id !== null)),
  ];

  let nutrientsByReferenceId = new Map<
    string,
    Pick<
      ReferenceIngredientRow,
      | "kcal_per_100g"
      | "protein_g_per_100g"
      | "carbs_g_per_100g"
      | "fat_g_per_100g"
      | "fiber_g_per_100g"
      | "nutrient_basis"
    >
  >();
  let referenceGramsByKey = new Map<string, number>();

  if (referenceIds.length > 0) {
    const [nutrientsResult, referenceMassResult] = await Promise.all([
      supabase
        .schema("reference")
        .from("ingredients")
        .select(
          "id, kcal_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g, fiber_g_per_100g, nutrient_basis",
        )
        .in("id", referenceIds),
      supabase
        .schema("reference")
        .from("ingredient_unit_masses")
        .select("ingredient_id, unit, grams")
        .in("ingredient_id", referenceIds),
    ]);
    if (nutrientsResult.error || referenceMassResult.error) {
      const error = nutrientsResult.error ?? referenceMassResult.error!;
      console.error(
        "[recipes] nutritionInputsForIngredients (reference) failed:",
        error.code,
        error.message,
      );
      return result;
    }
    nutrientsByReferenceId = new Map(nutrientsResult.data.map((row) => [row.id, row] as const));
    referenceGramsByKey = new Map(
      referenceMassResult.data.map((row) => [`${row.ingredient_id}:${row.unit}`, row.grams] as const),
    );
  }

  const userGramsByKey = new Map<string, number>(
    userMassRows.map((row) => [`${row.ingredient_id}:${row.unit}`, row.grams] as const),
  );

  for (const row of ingredients) {
    if (row.ingredient_id === null) continue;
    const referenceId = referenceIdByIngredientId.get(row.ingredient_id) ?? null;
    const referenceRow = referenceId ? nutrientsByReferenceId.get(referenceId) : undefined;
    // ADR-0013 §4 guard: a `per_100ml` reference row's five nutrient columns
    // are expressed per 100 ml, not per 100 g (NEVO's 53 infant-formula
    // rows). Feeding those numbers into nutrition.ts's per-100g math would
    // be a silent lie -- so a per_100ml row's nutrients are treated as
    // unknown, the same EMPTY_NUTRIENTS path an unlinked ingredient takes,
    // rather than mixed in. A real volume-based nutrition path is a
    // separate mechanism (ADR-0011 §3's standing rule) and out of scope
    // here.
    const nutrients: IngredientNutrients =
      referenceRow && referenceRow.nutrient_basis === "per_100g"
        ? {
            kcalPer100g: referenceRow.kcal_per_100g,
            proteinGPer100g: referenceRow.protein_g_per_100g,
            carbsGPer100g: referenceRow.carbs_g_per_100g,
            fatGPer100g: referenceRow.fat_g_per_100g,
            fiberGPer100g: referenceRow.fiber_g_per_100g,
          }
        : EMPTY_NUTRIENTS;

    const userGrams = userGramsByKey.get(`${row.ingredient_id}:${row.unit}`) ?? null;
    const referenceGrams = referenceId
      ? (referenceGramsByKey.get(`${referenceId}:${row.unit}`) ?? null)
      : null;
    const ingredientId = row.ingredient_id;
    const userBridge = bridgeUnitGramsFrom(
      (unit) => userGramsByKey.get(`${ingredientId}:${unit}`) ?? null,
    );
    const referenceBridge = referenceId
      ? bridgeUnitGramsFrom((unit) => referenceGramsByKey.get(`${referenceId}:${unit}`) ?? null)
      : EMPTY_BRIDGE_UNIT_GRAMS;
    const mass = resolveMassWithBridge(row.unit, userGrams, referenceGrams, userBridge, referenceBridge);
    const kitchenUnitMasses = kitchenUnitMassesFor(
      ingredientId,
      referenceId,
      userGramsByKey,
      referenceGramsByKey,
      userBridge,
      referenceBridge,
    );

    result.set(row.id, {
      nutrients,
      unitMassGrams: mass.status === "resolved" ? mass.grams : null,
      kitchenUnitMasses,
      // #179: same referenceIdByIngredientId lookup nutrients already used,
      // exposed on the row rather than recomputed by a caller.
      referenceIngredientId: referenceId,
    });
  }

  return result;
}

/**
 * One recipe — ingredients ordered by `position`, steps ordered by
 * `position` — fetched in a single PostgREST round trip (plus #160's
 * batched nutrition-input queries, `nutritionInputsForIngredients` above).
 * Returns `null` if the recipe doesn't exist, isn't owned by the signed-in
 * user, or the caller is signed out. Feeds the recipe detail page (later
 * ticket) but is built here per #122's scope.
 */
export async function getRecipeWithIngredientsAndSteps(
  recipeId: string,
): Promise<RecipeWithIngredientsAndSteps | null> {
  const parsedId = z.uuid().safeParse(recipeId);
  if (!parsedId.success) return null;

  const supabase = await createSupabaseServerClient();
  const userId = await getAuthenticatedUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from("recipes")
    .select(
      `
      id, user_id, category_id, title, servings, thumbnail_path,
      time_minutes, position, created_at, updated_at,
      source_url, import_status, import_error,
      recipe_ingredients (
        id, user_id, recipe_id, ingredient_id, name, quantity, unit,
        position, group_label, needs_review, created_at, updated_at
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
  const nutritionByIngredientId = await nutritionInputsForIngredients(
    supabase,
    userId,
    recipe_ingredients,
  );
  return {
    ...recipe,
    ingredients: [...recipe_ingredients]
      .sort((a, b) => a.position - b.position)
      .map((ingredient) => ({
        ...ingredient,
        ...(nutritionByIngredientId.get(ingredient.id) ?? {
          nutrients: EMPTY_NUTRIENTS,
          unitMassGrams: null,
          kitchenUnitMasses: EMPTY_KITCHEN_UNIT_MASSES,
          referenceIngredientId: null,
        }),
      })),
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
  const userId = await getAuthenticatedUserId();
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
  // Sorted by name_nl regardless of viewer locale -- deliberately not made
  // locale-aware here (#161/ADR-0013 §6, which only sourced the display
  // name in IngredientSearchPanel.tsx). #162 landed and i18n/request.ts now
  // reads the real profiles.locale, but this Server Action still has no
  // locale of its own to sort by -- next-intl's guidance is to pass a
  // locale explicitly into a Server Action rather than infer one, which
  // would mean widening searchIngredients' input contract (actions.ts) for
  // a sort-order-only change. Left as-is; revisit if locale-aware sort
  // order is ever actually requested.
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
 * `public.ingredients.id`), following ADR-0011 §3's order as extended by
 * #164/#157: user override for the exact unit → reference for the exact
 * unit → user override bridge (volume→ml, then eetlepel/theelepel↔
 * tablespoon/teaspoon) → reference bridge → unresolved. "Unresolved" is
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
 * lib/recipes/mass-resolution.ts (resolveMassWithBridge) — pulled out of
 * this module specifically because it, unlike this function, is
 * unit-testable without a database (tests/recipes-mass-resolution.test.ts):
 * this function is the thin, Supabase-dependent shell around it, same
 * split as lib/boards/positioning.ts's pure nextPosition vs. its
 * DB-touching callers in actions.ts.
 */
export async function resolveIngredientUnitMass(
  ingredientId: string,
  unit: UnitCode,
): Promise<MassResolution> {
  const parsedId = z.uuid().safeParse(ingredientId);
  if (!parsedId.success) return { status: "unresolved" };

  const supabase = await createSupabaseServerClient();
  const userId = await getAuthenticatedUserId();
  if (!userId) return { status: "unresolved" };

  // Bridge tiers only ever fire for a volume-magnitude unit
  // (mass-resolution.ts's mlBridgeGrams/spoonBridgeGrams both no-op
  // otherwise), so mass/count units (gram, stuk, ...) fetch only the exact
  // unit row, same query shape as before the bridge existed.
  const bridgeUnits: UnitCode[] =
    magnitudeOf(unit) === "volume" ? ["milliliter", "eetlepel", "theelepel"] : [];
  const unitsToFetch = [...new Set<UnitCode>([unit, ...bridgeUnits])];

  const { data: userRows, error: userError } = await supabase
    .from("ingredient_unit_masses")
    .select("unit, grams")
    .eq("user_id", userId)
    .eq("ingredient_id", parsedId.data)
    .in("unit", unitsToFetch);
  if (userError) {
    console.error(
      "[recipes] resolveIngredientUnitMass (override) failed:",
      userError.code,
      userError.message,
    );
    return { status: "unresolved" };
  }
  const userExact = userRows.find((row) => row.unit === unit)?.grams ?? null;
  const userBridge = bridgeUnitGramsFrom(
    (candidate) => userRows.find((row) => row.unit === candidate)?.grams ?? null,
  );
  // Reference layer is deliberately not fetched at all once a user override
  // for the EXACT unit is found — resolveMassWithBridge's ordering already
  // makes it irrelevant to the outcome (tier 1 beats every other tier), so
  // skipping the extra round trip is a real (not just theoretical) savings
  // for every overridden ingredient.
  if (userExact !== null) {
    return resolveMassWithBridge(unit, userExact, null, userBridge, EMPTY_BRIDGE_UNIT_GRAMS);
  }

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
  if (!ingredient?.reference_id) {
    return resolveMassWithBridge(unit, null, null, userBridge, EMPTY_BRIDGE_UNIT_GRAMS);
  }

  const { data: referenceRows, error: referenceError } = await supabase
    .schema("reference")
    .from("ingredient_unit_masses")
    .select("unit, grams")
    .eq("ingredient_id", ingredient.reference_id)
    .in("unit", unitsToFetch);
  if (referenceError) {
    console.error(
      "[recipes] resolveIngredientUnitMass (reference) failed:",
      referenceError.code,
      referenceError.message,
    );
    return { status: "unresolved" };
  }

  const referenceExact = referenceRows.find((row) => row.unit === unit)?.grams ?? null;
  const referenceBridge = bridgeUnitGramsFrom(
    (candidate) => referenceRows.find((row) => row.unit === candidate)?.grams ?? null,
  );

  return resolveMassWithBridge(unit, null, referenceExact, userBridge, referenceBridge);
}

/**
 * Recipes per category in `position` order — count-only read for the loading
 * skeleton (embedded `recipes(count)`). Empty array if signed out.
 */
export async function getRecipeCategoryRecipeCounts(): Promise<number[]> {
  const supabase = await createSupabaseServerClient();
  const userId = await getAuthenticatedUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from("recipe_categories")
    .select("id, recipes(count)")
    .eq("user_id", userId)
    .order("position", { ascending: true })
    .overrideTypes<Array<{ id: string; recipes: Array<{ count: number }> }>, { merge: false }>();

  if (error) {
    console.error("[recipes] getRecipeCategoryRecipeCounts failed:", error.code, error.message);
    throw new Error("Failed to load recipe category counts");
  }
  return embeddedCounts(data, "recipes");
}
