import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { findOrCreateOwnIngredient } from "@/lib/recipes/ingredients";

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

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

const STOPWORDS = new Set([
  // NL descriptors, state and size
  "verse", "vers", "fijngehakte", "gehakte", "fijngesneden", "gesneden", "geraspte",
  "gemalen", "gedroogde", "gedroogd", "biologische", "biologisch", "bio", "grote",
  "groot", "kleine", "klein", "middelgrote", "rijpe", "extra", "vierge",
  // NL function words
  "van", "of", "en", "de", "het", "een", "wat",
  // EN descriptors, state and size
  "fresh", "chopped", "finely", "minced", "diced", "sliced", "grated", "ground",
  "dried", "organic", "large", "small", "medium", "big", "ripe", "virgin",
  // EN function words
  "and", "or", "the", "a", "an", "of",
]);

// Words the plural rules would mangle, or irregular plurals. Keys are already
// lowercase/diacritic-free; "kaas", "ananas", "bloem" etc. pass through the
// rules untouched and are listed in the tests as guards.
const SINGULAR_EXCEPTIONS: Record<string, string> = {
  uien: "ui", eieren: "ei", bladeren: "blad", groen: "groen", olijven: "olijf", citroen: "citroen", peas: "pea",
  chickpeas: "chickpea", leaves: "leaf", knives: "knife", loaves: "loaf",
  radijs: "radijs", mais: "mais", anijs: "anijs", couscous: "couscous", hummus: "hummus",
  asparagus: "asparagus", molasses: "molasses", gras: "gras", bonus: "bonus",
};

const VOWELS = "aeiou";

function isVowel(ch: string | undefined): boolean {
  return ch !== undefined && VOWELS.includes(ch);
}

/** Conservative NL/EN plural to singular for one word; unknown shapes stay as-is. */
function singularize(word: string): string {
  const exception = SINGULAR_EXCEPTIONS[word];
  if (exception !== undefined) return exception;
  if (word.length < 4) return word;

  // EN -ies -> -y (cherries, berries); NL has no such plural.
  if (/[^aeiou]ies$/.test(word) && word.length > 4) return `${word.slice(0, -3)}y`;
  // EN -es after o/ch/sh/x/ss (tomatoes, peaches, radishes, boxes).
  if (/(o|ch|sh|x|ss)es$/.test(word)) return word.slice(0, -2);

  // NL -en: strip, then restore the stem (tomaten -> tomaat, kippen -> kip).
  if (word.endsWith("en") && word.length >= 5) {
    const stem = word.slice(0, -2);
    const last = stem[stem.length - 1];
    const prev = stem[stem.length - 2];
    if (last === prev && !isVowel(last)) return stem.slice(0, -1); // kippen, bessen
    if (!isVowel(last) && isVowel(prev) && !isVowel(stem[stem.length - 3]) && stem.length >= 3) {
      return `${stem.slice(0, -2)}${prev}${prev}${last}`; // tomat -> tomaat
    }
    return stem;
  }

  // Apostrophe plurals (paprika's, kiwi's).
  if (word.endsWith("'s")) return word.slice(0, -2);
  // -s: not after s/u/i/a (kaas, ananas, hummus, radijs-like), which are
  // singular far more often than plural.
  if (word.endsWith("s") && !/[suia]s$/.test(word) && word.length >= 5) return word.slice(0, -1);
  return word;
}

/**
 * Normalises a parsed ingredient name into the key stored in
 * `ingredient_aliases.alias_normalized` and fed to the trigram search:
 * lowercase, diacritics stripped, text after a comma/semicolon and in
 * parentheses dropped, punctuation and whitespace collapsed, descriptor and
 * function words removed, last word singularised. Pure; never returns an
 * empty string for a non-empty name (if every word is a stopword the words
 * are kept).
 */
export function normalizeIngredientName(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .split(/[,;]/)[0]
    .replace(/[^\p{L}\p{N}'\s-]/gu, " ")
    .replace(/['’](?!s\b)/g, "")
    .replace(/-/g, " ");
  const all = base.split(/\s+/).filter(Boolean);
  const kept = all.filter((word) => !STOPWORDS.has(word));
  const words = kept.length > 0 ? kept : all;
  if (words.length === 0) return "";
  words[words.length - 1] = singularize(words[words.length - 1]);
  return words.join(" ");
}

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
/** Per search term in the second pass, and per line after merging: what the link step chooses from. */
export const WIDE_CANDIDATES_PER_TERM = 8;
export const MAX_LINK_CANDIDATES = 10;

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
  candidatesPerName: number = CANDIDATES_PER_LINE,
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
    p_limit: candidatesPerName,
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

const candidateKey = (c: Candidate) => (c.source === "own" ? `own:${c.id}` : `ref:${c.referenceId}`);

/** Union of candidate lists, best score per ingredient, best first, capped. */
export function mergeCandidates(lists: Candidate[][], max: number = MAX_LINK_CANDIDATES): Candidate[] {
  const best = new Map<string, Candidate>();
  for (const candidate of lists.flat()) {
    const key = candidateKey(candidate);
    const current = best.get(key);
    if (!current || candidate.score > current.score) best.set(key, candidate);
  }
  return [...best.values()].sort((a, b) => b.score - a.score).slice(0, max);
}

/**
 * Second pass for the lines the first pass left in review: looks each one up
 * again under extra search terms (the LLM's Dutch NEVO-style names and, for a
 * translated recipe, the translated name). Raw recipe names ("onion",
 * "rode uien, gesnipperd") rarely score high against NEVO's "Ui rauw" style,
 * so this is what puts the right reference row in the link step's list. The
 * first term that settles (alias or confident trigram match) wins; otherwise
 * every term's candidates are merged for the link step to choose from. One
 * round trip pair (alias + RPC) for the whole recipe; terms beyond
 * MAX_MATCH_LINES are dropped.
 */
export async function widenMatches(
  supabase: MatcherClient,
  userId: string,
  matches: LineMatch[],
  termsPerLine: string[][],
): Promise<LineMatch[]> {
  const lookups: Array<{ line: number; term: string }> = [];
  matches.forEach((match, line) => {
    if (!match.needsReview) return;
    for (const term of termsPerLine[line] ?? []) {
      if (lookups.length < MAX_MATCH_LINES) lookups.push({ line, term });
    }
  });
  if (lookups.length === 0) return matches;

  const results = await matchIngredients(
    supabase,
    userId,
    lookups.map((l) => l.term),
    WIDE_CANDIDATES_PER_TERM,
  );
  const widened = [...matches];
  const settled = new Set<number>();
  const extra = new Map<number, Candidate[][]>();
  lookups.forEach(({ line }, n) => {
    const result = results[n];
    if (!result || settled.has(line)) return;
    if (!result.needsReview) {
      widened[line] = result;
      settled.add(line);
      return;
    }
    extra.set(line, [...(extra.get(line) ?? []), result.candidates]);
  });
  for (const [line, lists] of extra) {
    if (settled.has(line)) continue;
    widened[line] = { ...matches[line]!, candidates: mergeCandidates([matches[line]!.candidates, ...lists]) };
  }
  return widened;
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
