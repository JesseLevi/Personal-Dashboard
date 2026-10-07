# ADR-0019: Recipe import via URL

**Status**: Accepted (2026-10-07, epic #309, #311). Amended 2026-10-07 (user decision): §4 linking, grams and translation. **Amends** `Vision.md` (Recepten: import moves from "buiten scope" to in scope). Builds on ADR-0018 (hosted inference, no worker host); first user of its `lib/ai/` seam and cost guardrails.

## Context

- `Vision.md` listed importing/scraping external recipes as out of scope. The user now wants to paste a recipe URL and get a saved recipe (epic #309).
- ADR-0018 shelved the Mac mini and Ollama: there is no worker host and no local model, so the LLM step can only be a hosted API called from Vercel.
- Recipe pages are public, so sending them to a provider is low-stakes (ADR-0018 consequences). They are also untrusted input: the URL is user-supplied (SSRF) and the page text can contain prompt injection.
- Most recipe sites ship schema.org JSON-LD. An LLM is only needed for the messy remainder, so deterministic code can do most of the work cheaply.

## Decision

1. **Where it runs.** A server action validates the URL, inserts the `recipes` row with `import_status='importing'` and returns at once. The pipeline then runs in Next.js `after()` on Vercel. The pipeline is a plain module (`lib/recipes/import/`) with no `after()`/request coupling, so it can move behind a job handler later (ADR-0018 §4). **Constraint:** `after()` shares the function's max duration on Vercel (plan-dependent, tens of seconds up to a few minutes). The pipeline must stay well inside it: fetch 10 s / 3 MB (#313), one LLM call, no retry loops. A run that dies mid-way would leave a row stuck in `importing`, so a **lazy sweep** (same pattern as ADR-0017) runs on every Recepten board load: one RLS-scoped `update` sets the user's `importing` rows older than 5 minutes to `failed` with `import_error='timeout'`. The database then never claims an import is running when it isn't, and every import row is always visible on the board, as a skeleton or as a failed card with retry/delete (#312, #318). No cron or worker is needed.
2. **Pipeline order** (each step is its own ticket): SSRF-guarded fetch (`lib/net/safe-fetch`, #313) → extraction, JSON-LD first, Readability fallback (#314) → deterministic ingredient parser NL/EN with confidence high/low, ranges become the lower bound with the original text in the note (`lib/recipes/import/parse-ingredient.ts`, #315) → matching against the ingredient library via `pg_trgm` + aliases (#316) → LLM fill-in (#317) → save, set `import_status`.
3. **LLM seam.** `lib/ai/` exposes one provider-neutral function: prompt + zod schema in, validated object out. One provider for now: Anthropic, **Claude Haiku 5.5** (`claude-haiku-5-5`, switched from Haiku 4.5 on 2026-10-07, the day it was released) via `@anthropic-ai/sdk`, structured outputs, effort `low`, no sampling parameters (Haiku 5.5 rejects them). Ollama is dropped (ADR-0018). Another provider is a new file behind the same function, not a rewrite.
4. **Deterministic first.** JSON-LD, the regex parser and `pg_trgm` always run first. With a key configured, the LLM then makes two calls (three for a text page): a *prepare* call and a *link* call (`lib/recipes/import/ai-fill.ts`). It may only:
   - re-parse ingredient lines the parser marked low confidence;
   - extract title, ingredients and steps from pages without usable JSON-LD (Readability text);
   - give per line 1–3 Dutch NEVO-style search terms; the deterministic matcher runs again on them (`widenMatches`), because raw names ("onion", "ui") score below the auto-link threshold against NEVO's "Ui rauw";
   - for a line `pg_trgm` could not settle, choose the best-fitting candidate from the list it was given (prefer the plain raw product unless the line says otherwise), not only an identical one;
   - estimate the weight of a count, unmapped or volume amount. The recipe keeps its own amount and name ("2 stuks selderij"); when nothing resolves that unit for the linked ingredient yet, deterministic code stores the estimate per unit as the user's own weight (`public.ingredient_unit_masses`, ADR-0011 §3, never overwriting an existing row) so the calculator can weigh it. NEVO's or the user's own weight always wins. A line without a unit ("2 teentjes") is saved in grams instead (user decision 2026-10-07, replacing the earlier grams-in-the-name variant);
   - translate title, ingredient names and steps into the user's UI language (`profiles.locale`) when the recipe is in another one; a translation with a different step count is discarded;
   - link steps to the ingredients they use (`ingredientRefs`).

   The LLM must not: fetch anything, replace a high-confidence parser, JSON-LD or deterministic match result, invent missing ingredients or steps, write to the database, or create library ingredients or aliases on its own (the per-unit weights above are written by deterministic code, only for a unit nothing resolves yet). Every key or index it returns is checked against what was sent.

5. **Guardrails** (ADR-0018 §3 applied). 20 imports per hour per user. Hard monthly spend cap set in the Anthropic Console. The LLM has no tools. Output is validated with zod and rendered as plain text, never as HTML/markdown (Architecture.md §5.5). Scraped page text is untrusted: it is passed as quoted data, never as instructions, and the worst case is a wrong recipe the user can edit. Fetching goes only through the SSRF-guarded `safe-fetch` (Architecture.md §6): https only, port 443 only, DNS-pinned, max 3 redirects, 3 MB, 10 s, typed errors.
6. **Degraded mode.** Without `ANTHROPIC_API_KEY` the import still works with JSON-LD + parser + matching. Lines or pages that would have needed the LLM become `needs_review` lines or a failed import with a clear reason, never a crash.
7. **Data model** (migration in #312; details belong there). `recipes.source_url`, `recipes.import_status` (`importing|done|failed`), `recipes.import_error`; `recipe_ingredients.needs_review`; new table `ingredient_aliases`. Every new table has `user_id` FK + RLS + an RLS test in the same PR (ADR-0009); reference data stays per ADR-0011.
8. **Persisting ingredients.** Every imported line is saved exactly like a manually entered one: `name`, `quantity`, `unit` (the `recipe_unit` enum, never null) and, when matched, `ingredient_id` to the user's or NEVO library ingredient, so the nutrition calculator works unchanged. Pack notation is multiplied out ("2 x 400 g" → 800 g); a count without a unit becomes `stuk`. A line whose unit can't be resolved is saved with `needs_review` and `stuk` as placeholder unit (the raw word kept in the name or note), never dropped, unless §4's grams conversion applies to a linked line.
9. **Failure states.** A failed import shows a failed card with a reason (typed error from `safe-fetch`, extraction, rate limit, LLM) and retry/delete actions. A successful import with uncertain lines is saved with `needs_review` ingredient lines, visibly flagged for the user to confirm. All strings via next-intl (ADR-0007). UI in #318.

## Consequences

- Recipe import is in scope; `Vision.md` and `Architecture.md` §5/§6 link here.
- Cost per import is two Haiku calls (three for a text page, $0.10 / $0.50 per MTok), none without a key; bounded by the rate limit and the console cap.
- Page content leaves the house to Anthropic (accepted in ADR-0018 for public recipe pages).
- The `after()` duration limit caps how heavy extraction can get. Pages needing a headless browser (JS-rendered, no JSON-LD) are not supported.
- A killed function leaves an `importing` row until the user's next board load, where the lazy sweep turns it into a visible failed card. Failed imports are never deleted automatically; the user retries or deletes them.
- The `recipes` embed trigger (ADR-0006) fires on the import's inserts like on manual edits; no special handling.

## Alternatives considered

- **Job queue + worker** (ADR-0006 `jobs`): needs an always-on host, which ADR-0018 rules out; overkill for one ~10 s task. The plain-module pipeline keeps this door open.
- **Client-side fetch**: blocked by CORS on most sites and breaks the rule that the browser never talks to third parties or Supabase directly (ADR-0002); no SSRF guard or rate limit would be enforceable.
- **LLM for everything**: simplest code, but slower, costlier, less predictable, and a larger injection surface than deterministic-first.
- **Other providers / local inference**: Ollama is unreachable from Vercel and shelved (ADR-0018). Other hosted providers fit behind `lib/ai/` later; Haiku is chosen for price and structured-output support.
