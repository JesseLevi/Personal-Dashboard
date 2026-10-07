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
import { magnitudeOf } from "@/lib/recipes/units";
import type { Locale } from "@/lib/profile/types";
import { storeRecipeThumbnail } from "@/lib/recipes/thumbnails";
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
//   refs) -> resolve ingredient ids -> grams for counts ->
//   replace_recipe_contents (the manual write path) -> thumbnail -> done.
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
    const stored = await storeRecipeThumbnail(job.supabase, job.userId, new Uint8Array(image.body));
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

/**
 * Grams to save instead of the parsed amount, or null to keep it. Only for a
 * linked line whose amount the nutrition calculator could not weigh: a count
 * ("1 ui") or an unmapped measure word ("2 teentjes"), or a volume the
 * ingredient has no mass for. NEVO's own measured weight per piece wins over
 * the LLM estimate (user decision 2026-10-07).
 */
export function gramsInstead(line: FilledLine, ingredientId: string | null, unitGrams: UnitGramsLookup): number | null {
  const { quantity, unit } = line.parsed;
  if (!ingredientId || quantity === null || !asksGrams(line.parsed)) return null;
  const perUnit = unit ? unitGrams(ingredientId, unit) : null;
  if (perUnit !== null && unit !== null && magnitudeOf(unit) === "volume") return null;
  const grams = perUnit !== null ? quantity * perUnit : line.gramsEstimate;
  return grams !== null && grams > 0 ? roundGrams(grams) : null;
}

async function run(job: ImportJob, deps: PipelineDeps): Promise<void> {
  const { supabase, userId, recipeId, url, locale } = job;
  const fetchPage = deps.safeFetch ?? safeFetch;

  const recipe = await loadRecipe(url, fetchPage);
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
    locale,
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
  for (const [i, entry] of entries.entries()) {
    const line = linked.lines[i]!;
    const ingredientId = ingredientIds[i] ?? null;
    const grams = gramsInstead(line, ingredientId, unitGrams);
    const unitMissing = line.parsed.unit === null;
    // recipe_ingredients has no note column: the stated amount of a grams
    // conversion ("1 stuk"), or an unmapped measure word ("teentje"), stays
    // readable in the name instead of being dropped (ADR-0019 §8).
    const aside = grams !== null ? line.amount : unitMissing ? line.parsed.note : null;
    const label = aside ? `${line.parsed.name} (${aside})` : line.parsed.name;
    const quantity = grams ?? line.parsed.quantity;
    ingredients.push({
      name: (label.trim() || line.parsed.raw).slice(0, MAX_TITLE),
      quantity: quantity !== null && Number.isFinite(quantity) && quantity > 0 ? quantity : null,
      unit: grams !== null ? "gram" : (line.parsed.unit ?? PLACEHOLDER_UNIT),
      ingredientId,
      groupLabel: entry.groupLabel,
      needsReview: ingredientId === null || (grams === null && (line.needsReview || unitMissing)),
    });
  }

  const recipeSteps: StepLine[] = steps.map((instruction, i) => ({
    instruction: instruction.slice(0, MAX_INSTRUCTION),
    ingredientRefs: (linked.stepIngredientRefs[i] ?? []).filter((ref) => ref < ingredients.length),
  }));

  const contents = await replaceRecipeContents(supabase, userId, recipeId, ingredients, recipeSteps);
  if (!contents.ok) throw new Error("Failed to save the imported recipe contents");

  const thumbnailPath = recipe.image ? await fetchThumbnailPath(job, recipe.image, fetchPage) : null;

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
