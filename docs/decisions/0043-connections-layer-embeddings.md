# ADR-0043: Connections layer: bge-m3 embeddings on Cloudflare Workers AI, opt-in per member

**Status**: Accepted (user decision, 2026-10-23, #575). **Supersedes** ADR-0006. Settles ADR-0018 §4–5 for embeddings.

## Context

- The Vision's first promise is making connections visible between tasks, notes, recipes, groceries and appointments. Phase 8 (epic #31) builds the semantic index under that promise. Its first visible use is search across all modules. The Assistent (Phase 9, #32) reuses the index for recurring themes.
- ADR-0006 designed a `jobs` table, DB triggers and an always-on worker running `bge-m3` via Ollama. ADR-0018 shelved local inference and any worker host, and reopened the model. ADR-0006 has been amended once already, so this ADR replaces it.
- ADR-0039 fixed the runtime for scheduled work on Vercel Hobby: a lazy trigger where a user is present, plus a daily cron as backstop.
- Notes are the most private data in Atlas. ADR-0018 requires an explicit stance before they go to a provider.
- Options weighed for the model: Voyage `voyage-4` (strong retrieval; training opt-out must be set per account), OpenAI `text-embedding-3-small` (cheapest; 30-day abuse retention), Mistral `mistral-embed` (EU; unclear terms and quality), and Cloudflare Workers AI `@cf/baai/bge-m3`.

## Decision

1. **Model**: `@cf/baai/bge-m3` on **Cloudflare Workers AI**, called over REST from server code, 1024 dimensions.
   - Multilingual and cross-lingual: an English query finds a Dutch note.
   - The model is open (MIT), so the same vectors can later be produced by another host without a re-embed.
   - Cloudflare does not train on customer content and is already Atlas's processor for R2 (ADR-0024).
   - The free allocation (10,000 neurons a day per account, about 9 M bge-m3 tokens) is the spend cap of ADR-0018 §3: with Workers Paid off, calls above it fail and the pipeline waits a day.
   - Only `lib/ai/cloudflare.ts` knows the endpoint and `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_AI_API_TOKEN` (a token scoped to Workers AI). `lib/ai/` exposes `embed(texts)` next to `generateObject()`; the LLM stays Claude Haiku.
   - Changing the model is a new ADR plus a re-embed; the stored `model` column makes stale rows detectable.
2. **Consent: opt-in per member, off by default** (`profiles.ai_enabled`, `ai_enabled_at`).
   - Without consent nothing of that member leaves Atlas: no embeddings, no search queries. They get keyword search only.
   - The settings text says what goes out (the text of notes, recipes, cards, appointments including imported ones, basket items, and search queries), to whom, that Cloudflare does not train on it, and that processing in the EU is not guaranteed.
   - Turning it off deletes all of that member's embeddings in the same transaction (`set_ai_enabled`).
   - Rows inside a shared container carry the owner's `user_id` (ADR-0035), so the owner's consent governs them, including items a member typed into the owner's basket.
3. **Sources**: notes, recipes (with ingredients and steps), cards, all calendar events (manual, recurring occurrences and synced), and basket items. Each source type has one pure builder that turns a row into canonical text from fields that bump the row's `updated_at`; dates and container names stay out, so repeats hash alike.
4. **No queue, no worker: a backlog scan.** A source needs embedding when it has no rows in `embeddings`, when its `updated_at` is newer than their `source_updated_at`, or when their `model` differs. A source must have rested two minutes first, so note autosave does not embed every few seconds.
   - No trigger can be forgotten and the index heals itself after any outage.
   - `embedding_backlog()` (`security invoker`) serves the lazy path; `embedding_backlog_for(user)` serves the cron and is executable by `service_role` only.
   - `worker/` is removed.
5. **Runtime (ADR-0039 §6)**:
   - **Lazy**: after a signed-in page renders, `after()` drains the member's own backlog with their RLS-bound client, at most once per 10 minutes per member (`claim_embedding_drain()`, a definer function on a `private` table), within a time budget. The page never waits.
   - **Backstop**: a second daily Vercel Cron route, `/api/cron/embeddings` (05:00 UTC, after calendar sync), behind `CRON_SECRET`, with `service_role`, for consenting members only, oldest backlog first, within a time budget.
   - A drain stops at its budget or at the first provider error; the rest waits for the next run.
6. **Table `embeddings`**, one row per chunk:
   - `user_id`; an exclusive arc of nullable FKs `note_id`, `recipe_id`, `card_id`, `calendar_event_id`, `shopping_list_item_id`, each `on delete cascade`, with `check (num_nonnulls(...) = 1)`, as `shares` does (ADR-0035). This replaces ADR-0006's `source_table`/`source_id`: cascades come free and there are no orphans.
   - `chunk_index`, `content_text`, `content_hash` (of model + text), `source_updated_at`, `model`, `embedding extensions.halfvec(1024)` (half the storage of `vector`, no measurable retrieval loss).
   - RLS: owner only, four policies, pgTAP test (ADR-0009).
7. **Identical text is embedded once.** Before calling the provider, the drain reuses a stored vector with the same `(user_id, content_hash, model)`. Four hundred occurrences of a recurring event, or "pindakaas" added every month, cost one call.
8. **Chunking**: by headings and paragraphs, around 1,200 characters with a little overlap and a hard cap per source. Pure and unit-tested.
9. **Exact search, no ANN index for now.** RLS filters after an HNSW scan, which loses recall with several users. A sequential scan over one member's rows takes milliseconds at Atlas's size. Revisit around 50k rows per member (pgvector iterative scans).
10. **Search across all modules** is the first surface:
    - `search_text(q, types, n)` (pg_trgm) and `search_semantic(query_embedding, types, n)`, both `security invoker`, return `(source_type, source_id, score)`;
    - the app merges them with Reciprocal Rank Fusion, collapses events with the same `content_hash` to the occurrence nearest today, and resolves titles and links per type;
    - the semantic branch is rate-limited per member; above the limit, without consent, without a token, or on any provider error, search silently degrades to keywords.
11. **Out of scope for this phase**: a "Verbonden" panel per item and `[[` links to recipes and cards. Both build on this table later without schema changes.

## Consequences

- Running cost is zero within the free allocation. The new production settings are the two Cloudflare variables and a second cron entry (`docs/operations.md`).
- A consenting member's existing data is indexed over a few page visits or by the next nightly run.
- Storage is about 2 KB per chunk. A daily recurring event adds about 400 rows (800 KB), which is acceptable for a small circle.
- A future editor of a shared board will not find the owner's cards in search until a policy amendment lets `embeddings` follow `private.board_role()`.
- Recording how often things are bought or cooked is not an embedding concern; ADR-0044 covers it.
