# ADR-0006: One generic embedding pipeline — jobs table + worker + bge-m3

**Status**: Accepted. **Amended by ADR-0018 (2026-10-07)**: the queue/trigger/`embeddings`/`search_semantic` design stands, but "bge-m3 via Ollama" is reopened. Phase 8 picks a hosted multilingual embedding model behind `lib/ai/`, and the worker host is undecided.

## Context

Semantic search and the AI-agent both need embeddings over notes and recipes (and future modules). Without a shared pattern, each module grows ad-hoc embedding code. Constraint: everything runs locally (Ollama on the Mac mini), and a small model must be able to keep up.

## Decision

- **Model**: `bge-m3` via Ollama `/api/embed` — multilingual (NL/EN + future languages), 1024 dimensions. Explicitly not Supabase's built-in `gte-small` (English-only). Column type: `vector(1024)`; changing models later means a re-embed migration and is a new ADR.
- **Queue**: a plain `jobs` table (`pending|running|done|failed`, `run_at`, `attempts`, `last_error`) polled with `FOR UPDATE SKIP LOCKED`. No pgmq, no Redis, no external broker — one consumer, low volume.
- **Flow**: DB triggers on embeddable tables enqueue `embed` jobs → worker builds canonical text per source, skips when `content_hash` is unchanged, chunks, embeds, upserts into a single `embeddings` table (`source_table`, `source_id`, `chunk_index`, `content_text`, `content_hash`, `embedding`, `user_id`).
- **Query path**: security-invoker SQL function `search_semantic(...)` so RLS applies to results automatically; query embedding is computed server-side in the route handler.
- Adding a new embeddable module = one trigger + one canonical-text builder. No other code.

## Consequences

- Embedding work never sits in a user's request path; failures retry with backoff and are observable in `jobs`.
- Worker is a single Node process; if it dies, jobs accumulate harmlessly until restart (launchd/compose keeps it up).
- The same `jobs` table serves agent runs (ADR: architecture §5) and calendar sync (ADR-0008) — one infrastructure pattern for all async work.
