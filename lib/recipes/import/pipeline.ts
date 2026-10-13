import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { SafeFetchError, safeFetch } from "@/lib/net/safe-fetch";
import { replaceRecipeContents, type IngredientLine, type StepLine } from "@/lib/recipes/contents";
import { type ImportErrorCode } from "@/lib/recipes/enums";
import {
  ImportAiError,
  asksGrams,
  extractRecipeFromText,
  linkIngredients,
  prepareRecipe,
  type FilledLine,
} from "@/lib/recipes/import/ai-fill";
import { ExtractError, extractRecipe, type ExtractedRecipe } from "@/lib/recipes/import/extract";
import {
  MAX_MATCH_LINES,
  matchIngredients,
  resolveIngredientId,
  widenMatches,
} from "@/lib/recipes/import/match-ingredients";
import { parseIngredientLine, type ParsedIngredient } from "@/lib/recipes/import/parse-ingredient";
import { ImportRateLimitError } from "@/lib/recipes/import/rate-limit";
import { loadUnitGrams, type UnitGramsLookup } from "@/lib/recipes/import/unit-grams";
import { hostOf } from "@/lib/recipes/import/url";
import type { UnitCode } from "@/lib/recipes/units";
import type { Locale } from "@/lib/profile/types";
import { discardRecipeThumbnail, storeRecipeThumbnail } from "@/lib/recipes/thumbnails";
import { MAX_THUMBNAIL_BYTES, isAllowedThumbnailMimeType } from "@/lib/recipes/thumbnail-validation";

// The recipe import pipeline (#318, ADR-0019 §2): a plain module with no
// `after()`/request coupling, so it can move behind a job handler later
// (ADR-0018 §4). The caller hands in the user's own RLS-scoped client and
// user id (captured BEFORE `after()` is scheduled, see lib/recipes/import/
// start.ts); nothing here reaches for service_role or for request cookies.
//
//   safeFetch -> extractRecipe -> (text page: extractRecipeFromText) ->
//   parse lines -> matchIngredients -> prepareRecipe (search terms,
//   translation) -> widenMatches -> linkIngredients (choice, grams, step
//   refs) -> resolve ingredient ids -> weight per unit for counts ->
//   replace_recipe_contents (the manual write path) -> done. The thumbnail
//   download runs alongside all of that (#446), not after it.
//
// Everything that can fail runs before the first write; a typed error ends in
// `import_status='failed'` + `import_error=<code>` in ONE update (the
// recipes_import_error_only_when_failed CHECK, #312). Never throws.

type Client = SupabaseClient<Database>;

/** `locale` is the user's UI language: a recipe in another language is translated into it. */
export type ImportJob = { supabase: Client; userId: string; recipeId: string; url: string; locale: Locale };
export type PipelineDeps = { safeFetch?: typeof safeFetch };

const MAX_TITLE = 200;
const MAX_GROUP_LABEL = 100;
const MAX_INSTRUCTION = 5000;
const DEFAULT_SERVINGS = 4;
const PLACEHOLDER_UNIT = "stuk" as const;

/** Maps any pipeline error to the one reason code stored in recipes.import_error. */
export function toImportErrorCode(error: unknown): ImportErrorCode {
  if (error instanceof SafeFetchError) return error.code;
  if (error instanceof ExtractError) return error.code;
  if (error instanceof ImportAiError) return error.code;
  if (error instanceof ImportRateLimitError) return error.code;
  return "import_failed";
}

type Entry = { parsed: ParsedIngredient; groupLabel: string | null };

/** Group headings become `group_label` on the lines below them, like manual groups. */
function parseLines(rawLines: string[]): Entry[] {
  const entries: Entry[] = [];
  let groupLabel: string | null = null;
  for (const raw of rawLines) {
    const line = parseIngredientLine(raw);
    if (line.kind === "group") {
      groupLabel = line.label.trim().slice(0, MAX_GROUP_LABEL) || null;
    } else if (entries.length < MAX_MATCH_LINES) {
      entries.push({ parsed: line, groupLabel });
    }
  }
  return entries;
}

async function loadRecipe(url: string, fetchPage: typeof safeFetch): Promise<ExtractedRecipe> {
  const page = await fetchPage(url);
  const html = new TextDecoder("utf-8").decode(page.body);
  const extraction = extractRecipe(html, page.url);
  return extraction.kind === "recipe" ? extraction.recipe : extractRecipeFromText(extraction);
}

/** Best effort: a missing, odd or unreadable image never fails the import. */
async function fetchThumbnailPath(job: ImportJob, imageUrl: string, fetchPage: typeof safeFetch): Promise<string | null> {
  try {
    const image = await fetchPage(imageUrl, { allowImages: true });
    if (!isAllowedThumbnailMimeType(image.contentType) || image.body.byteLength > MAX_THUMBNAIL_BYTES) return null;
    const stored = await storeRecipeThumbnail(job.userId, new Uint8Array(image.body));
    return stored.success ? stored.data.path : null;
  } catch (error) {
    console.warn("[recipes] import thumbnail skipped:", error instanceof Error ? error.message : error);
    return null;
  }
}

/** Grams with one decimal below 10 g, whole grams above. */
function roundGrams(grams: number): number {
  return grams >= 10 ? Math.round(grams) : Math.round(grams * 10) / 10;
}

export type AmountPlan =
  /** Keep the amount as written; the calculator can already weigh it (or nothing can). */
  | { kind: "keep" }
  /** Keep "2 stuk" as written and store this weight for ONE unit as the user's own override. */
  | { kind: "unit-weight"; gramsPerUnit: number }
  /** No unit to keep ("2 teentjes"): save the line in grams. */
  | { kind: "grams"; grams: number };

/**
 * How a linked line's amount reaches the nutrition calculator (user decision
 * 2026-10-07): the recipe keeps its own amount ("2 stuks selderij"), and a
 * missing weight per unit is stored for that ingredient instead
 * (public.ingredient_unit_masses, the user-override layer of ADR-0011 §3).
 * NEVO's or the user's own weight always wins: an estimate only fills a unit
 * nothing resolves yet. A line without a unit cannot carry a per-unit weight,
 * so it becomes grams (its measure word stays in the name, ADR-0019 §8).
 */
export function planAmount(line: FilledLine, ingredientId: string | null, unitGrams: UnitGramsLookup): AmountPlan {
  const { quantity, unit } = line.parsed;
  if (!ingredientId || quantity === null || !asksGrams(line.parsed)) return { kind: "keep" };
  if (unit !== null && unitGrams(ingredientId, unit) !== null) return { kind: "keep" };
  if (line.gramsEstimate === null || line.gramsEstimate <= 0) return { kind: "keep" };
  if (unit === null) return { kind: "grams", grams: roundGrams(line.gramsEstimate) };
  return { kind: "unit-weight", gramsPerUnit: roundGrams(line.gramsEstimate / quantity) };
}

/** Stores estimated weights per unit; best effort, an existing row is never overwritten. */
async function saveUnitWeights(
  supabase: Client,
  userId: string,
  weights: Array<{ ingredientId: string; unit: UnitCode; grams: number }>,
): Promise<void> {
  const unique = new Map(weights.map((w) => [`${w.ingredientId}:${w.unit}`, w]));
  if (unique.size === 0) return;
  const { error } = await supabase.from("ingredient_unit_masses").upsert(
    [...unique.values()].map((w) => ({ user_id: userId, ingredient_id: w.ingredientId, unit: w.unit, grams: w.grams })),
    { onConflict: "user_id,ingredient_id,unit", ignoreDuplicates: true },
  );
  if (error) console.error("[recipes] import unit weights failed:", error.code, error.message);
}

async function run(job: ImportJob, deps: PipelineDeps): Promise<void> {
  const { url } = job;
  const fetchPage = deps.safeFetch ?? safeFetch;

  const recipe = await loadRecipe(url, fetchPage);
  // Started right away and awaited last (#446): the LLM steps below can eat
  // most of the function's time budget, and a thumbnail fetched after them was
  // silently cut off. fetchThumbnailPath never rejects.
  const thumbnail = recipe.image ? fetchThumbnailPath(job, recipe.image, fetchPage) : Promise.resolve(null);
  try {
    await importContents(job, recipe, thumbnail);
  } catch (error) {
    // The recipe ends up failed: do not leave the downloaded image orphaned in R2.
    const stored = await thumbnail;
    if (stored) await discardRecipeThumbnail(stored);
    throw error;
  }
}

async function importContents(
  job: ImportJob,
  recipe: ExtractedRecipe,
  thumbnail: Promise<string | null>,
): Promise<void> {
  const { supabase, userId, recipeId, url, locale } = job;
  const entries = parseLines(recipe.recipeIngredient);

  const firstPass = await matchIngredients(
    supabase,
    userId,
    entries.map((entry) => entry.parsed.name),
  );
  const prepared = await prepareRecipe(
    entries.map((entry) => entry.parsed),
    { name: recipe.name, steps: recipe.steps },
    locale,
    // Alias-settled lines need no search terms (ADR-0020 §3); translation still sees every line.
    firstPass.map((match) => match.needsReview),
  );
  const matches = await widenMatches(
    supabase,
    userId,
    firstPass,
    prepared.lines.map((line, i) => {
      const renamed = line.parsed.name !== entries[i]!.parsed.name ? [line.parsed.name] : [];
      return [...new Set([...renamed, ...line.searchTerms])];
    }),
  );
  const steps = prepared.translation?.steps ?? recipe.steps;
  const linked = await linkIngredients(
    prepared.lines.map((line, i) => ({ parsed: line.parsed, match: matches[i]! })),
    steps,
  );

  const ingredientIds: Array<string | null> = [];
  for (const line of linked.lines) {
    ingredientIds.push(line.match.chosen ? await resolveIngredientId(supabase, userId, line.match.chosen) : null);
  }
  const unitGrams = await loadUnitGrams(
    supabase,
    userId,
    ingredientIds.filter((id): id is string => id !== null),
  );

  const ingredients: IngredientLine[] = [];
  const unitWeights: Array<{ ingredientId: string; unit: UnitCode; grams: number }> = [];
  for (const [i, entry] of entries.entries()) {
    const line = linked.lines[i]!;
    const ingredientId = ingredientIds[i] ?? null;
    const plan = planAmount(line, ingredientId, unitGrams);
    if (plan.kind === "unit-weight" && ingredientId && line.parsed.unit) {
      unitWeights.push({ ingredientId, unit: line.parsed.unit, grams: plan.gramsPerUnit });
    }
    const unitMissing = line.parsed.unit === null;
    // recipe_ingredients has no note column: an unmapped measure word
    // ("teentje") stays readable in the name instead of being dropped
    // (ADR-0019 §8). The name is otherwise the recipe's own.
    const label = unitMissing && line.parsed.note ? `${line.parsed.name} (${line.parsed.note})` : line.parsed.name;
    const quantity = plan.kind === "grams" ? plan.grams : line.parsed.quantity;
    const weighed = plan.kind !== "keep";
    ingredients.push({
      name: (label.trim() || line.parsed.raw).slice(0, MAX_TITLE),
      quantity: quantity !== null && Number.isFinite(quantity) && quantity > 0 ? quantity : null,
      unit: plan.kind === "grams" ? "gram" : (line.parsed.unit ?? PLACEHOLDER_UNIT),
      ingredientId,
      groupLabel: entry.groupLabel,
      needsReview: ingredientId === null || (!weighed && (line.needsReview || unitMissing)),
    });
  }

  const recipeSteps: StepLine[] = steps.map((instruction, i) => ({
    instruction: instruction.slice(0, MAX_INSTRUCTION),
    ingredientRefs: (linked.stepIngredientRefs[i] ?? []).filter((ref) => ref < ingredients.length),
  }));

  const contents = await replaceRecipeContents(supabase, userId, recipeId, ingredients, recipeSteps);
  if (!contents.ok) throw new Error("Failed to save the imported recipe contents");
  await saveUnitWeights(supabase, userId, unitWeights);

  const thumbnailPath = await thumbnail;

  const { error } = await supabase
    .from("recipes")
    .update({
      title: (prepared.translation?.title ?? recipe.name).trim().slice(0, MAX_TITLE) || hostOf(url) || url.slice(0, MAX_TITLE),
      servings: recipe.servings ?? DEFAULT_SERVINGS,
      time_minutes: recipe.timeMinutes,
      ...(thumbnailPath ? { thumbnail_path: thumbnailPath } : {}),
      import_status: "done",
      import_error: null,
    })
    .eq("id", recipeId)
    .eq("user_id", userId);
  if (error) {
    console.error("[recipes] import final update failed:", error.code, error.message);
    throw new Error("Failed to finish the import");
  }
}

/**
 * Runs one import to completion. Never throws: every failure becomes
 * `failed` + a reason code on the row (and an unexpected one is logged).
 */
export async function runRecipeImport(job: ImportJob, deps: PipelineDeps = {}): Promise<void> {
  try {
    await run(job, deps);
  } catch (error) {
    const code = toImportErrorCode(error);
    if (code === "import_failed") console.error("[recipes] import failed:", error);
    const { error: updateError } = await job.supabase
      .from("recipes")
      .update({ import_status: "failed", import_error: code })
      .eq("id", job.recipeId)
      .eq("user_id", job.userId);
    // Still `importing` after this: the lazy sweep turns it into failed/timeout.
    if (updateError) console.error("[recipes] import failure update failed:", updateError.code, updateError.message);
  }
}
