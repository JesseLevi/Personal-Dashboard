import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { findOrCreateOwnIngredient } from "@/lib/recipes/ingredients";
import { normalizeIngredientName } from "@/lib/recipes/import/normalize-name";

// Matches parsed ingredient names (#315) to the ingredient library (#316,
// ADR-0019 §2): user alias first, then pg_trgm candidates from the SQL
// function public.match_ingredient_candidates. Only the parser's `name` is
// used; quantity and unit are never touched. A line it cannot link with
// confidence gets needsReview=true and keeps its candidates for the LLM step
// (#317).
//
// Own vs reference: recipe_ingredients.ingredient_id points at the USER's
// public.ingredients row (ADR-0011 §2). A best match that is a NEVO reference
// ingredient the user has not adopted yet stays a `{ source: "reference",
// referenceId }` candidate here (matching writes nothing); the save step (#318)
// turns the chosen candidate into an ingredientId with resolveIngredientId,
// which uses the same findOrCreateOwnIngredient as the manual picker.

// The caller's RLS-scoped, typed client (lib/database.types.ts knows
// ingredient_aliases and match_ingredient_candidates since #312/#316).
export type MatcherClient = SupabaseClient<Database>;

/**
 * Link only when the best trigram score is at least this. pg_trgm's own
 * default is 0.3, far too loose for auto-linking. 0.55 passes a vowel-length
 * slip ("tomat" vs "tomaat" = 0.63) and exact names (1.0) but rejects
 * different products that share a stem ("paprika" vs "paprikapoeder" = 0.47,
 * "melk" vs "kokosmelk" = 0.25). Scores are hand-computed from the trigram
 * definition (see tests/recipes-match-ingredients.test.ts), not yet measured
 * on real NEVO data: tune there.
 */
export const MATCH_THRESHOLD = 0.55;

/**
 * Required lead of the best candidate over the runner-up. 0.1 keeps
 * near-duplicates ("rode ui" 0.53 / "ui" 0.31 style pairs) in review instead
 * of guessing. An exact own-vs-reference tie is exempt (see decideMatch).
 */
export const MATCH_MARGIN = 0.1;

const EXACT_SCORE = 0.999;

export type Candidate =
  | { source: "own"; id: string; name: string; score: number }
  | { source: "reference"; referenceId: string; name: string; score: number };

export type LineMatch = {
  /** Set when the line links to one of the user's own ingredients (alias or trigram). */
  ingredientId: string | null;
  /** The linked candidate, own or reference; null when needsReview. A reference one still needs resolveIngredientId. */
  chosen: Candidate | null;
  needsReview: boolean;
  /** Top candidates, best first; empty on an alias hit. */
  candidates: Candidate[];
};

export { normalizeIngredientName };

// ---------------------------------------------------------------------------
// Decision
// ---------------------------------------------------------------------------

/**
 * Pure threshold/margin decision over candidates sorted best first. Returns
 * the candidate to link, or null (needs review). Exemption: when the best is
 * an exact match on the user's own ingredient, an equally exact reference
 * runner-up does not count against the margin, because the user's own row is
 * the one they would pick anyway.
 */
export function decideMatch(candidates: Candidate[]): Candidate | null {
  const [best, runnerUp] = candidates;
  if (!best || best.score < MATCH_THRESHOLD) return null;
  if (!runnerUp) return best;
  if (best.source === "own" && runnerUp.source === "reference" && best.score >= EXACT_SCORE) {
    return best;
  }
  return best.score - runnerUp.score >= MATCH_MARGIN - 1e-9 ? best : null;
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

type CandidateRow = {
  input_index: number;
  source: string;
  id: string;
  name: string;
  score: number;
};

function toCandidate(row: CandidateRow): Candidate | null {
  if (row.source === "own") {
    return { source: "own", id: row.id, name: row.name, score: row.score };
  }
  if (row.source === "reference") {
    return { source: "reference", referenceId: row.id, name: row.name, score: row.score };
  }
  return null;
}

export const MAX_MATCH_LINES = 200;
const CANDIDATES_PER_LINE = 5;

/**
 * Matches every parsed name (index-aligned result). Two round trips at most:
 * one alias lookup, one RPC for the names the alias did not settle. Throws on
 * a database error so the import pipeline can fail loudly rather than silently
 * produce an all-review recipe.
 */
export async function matchIngredients(
  supabase: MatcherClient,
  userId: string,
  names: string[],
): Promise<LineMatch[]> {
  if (names.length > MAX_MATCH_LINES) throw new Error("Too many ingredient lines to match");
  const normalized = names.map(normalizeIngredientName);
  const results: LineMatch[] = names.map(() => ({
    ingredientId: null,
    chosen: null,
    needsReview: true,
    candidates: [],
  }));

  const keys = [...new Set(normalized.filter(Boolean))];
  if (keys.length === 0) return results;

  const { data: aliasRows, error: aliasError } = await supabase
    .from("ingredient_aliases")
    .select("alias_normalized, ingredient_id")
    .eq("user_id", userId)
    .in("alias_normalized", keys);
  if (aliasError) {
    console.error("[recipes] matchIngredients/alias-lookup failed:", aliasError.code, aliasError.message);
    throw new Error("Failed to look up ingredient aliases");
  }
  const aliasByKey = new Map<string, string>(
    (aliasRows ?? []).map((row) => [row.alias_normalized, row.ingredient_id]),
  );

  const pending: number[] = [];
  normalized.forEach((key, index) => {
    const ingredientId = key ? aliasByKey.get(key) : undefined;
    if (ingredientId) {
      results[index] = {
        ingredientId,
        chosen: { source: "own", id: ingredientId, name: key, score: 1 },
        needsReview: false,
        candidates: [],
      };
    } else if (key) {
      pending.push(index);
    }
  });
  if (pending.length === 0) return results;

  const { data: rows, error } = await supabase.rpc("match_ingredient_candidates", {
    p_names: pending.map((index) => normalized[index]),
    p_limit: CANDIDATES_PER_LINE,
  });
  if (error) {
    console.error("[recipes] matchIngredients/candidates failed:", error.code, error.message);
    throw new Error("Failed to match ingredients");
  }

  const byPending = new Map<number, Candidate[]>();
  for (const row of (rows ?? []) as CandidateRow[]) {
    const candidate = toCandidate(row);
    if (!candidate) continue;
    const list = byPending.get(row.input_index) ?? [];
    list.push(candidate);
    byPending.set(row.input_index, list);
  }

  pending.forEach((lineIndex, pendingIndex) => {
    const candidates = (byPending.get(pendingIndex) ?? []).sort((a, b) => b.score - a.score);
    const chosen = decideMatch(candidates);
    results[lineIndex] = {
      ingredientId: chosen?.source === "own" ? chosen.id : null,
      chosen,
      needsReview: chosen === null,
      candidates,
    };
  });
  return results;
}

/**
 * Turns a chosen candidate into the user's ingredient id for
 * recipe_ingredients.ingredient_id. Own: its id. Reference: reuses or creates
 * the user's row through findOrCreateOwnIngredient, exactly like picking it
 * in the manual panel. Returns null when adoption fails (save the line with
 * needs_review instead of dropping it).
 */
export async function resolveIngredientId(
  supabase: MatcherClient,
  userId: string,
  chosen: Candidate,
): Promise<string | null> {
  if (chosen.source === "own") return chosen.id;
  const result = await findOrCreateOwnIngredient(supabase, userId, {
    name: chosen.name,
    referenceId: chosen.referenceId,
  });
  return result.ok ? result.ingredient.id : null;
}

/**
 * Remembers "this name means that ingredient" for the user so the next import
 * short-circuits at the alias lookup. RLS (ingredient_aliases insert/update
 * policies) rejects an ingredient that is not the caller's own. Returns
 * false on an empty normalized name or a database error.
 */
export async function upsertAlias(
  supabase: MatcherClient,
  userId: string,
  name: string,
  ingredientId: string,
): Promise<boolean> {
  const aliasNormalized = normalizeIngredientName(name);
  if (!aliasNormalized) return false;
  const { error } = await supabase
    .from("ingredient_aliases")
    .upsert(
      { user_id: userId, alias_normalized: aliasNormalized, ingredient_id: ingredientId },
      { onConflict: "user_id,alias_normalized" },
    );
  if (error) {
    console.error("[recipes] upsertAlias failed:", error.code, error.message);
    return false;
  }
  return true;
}
