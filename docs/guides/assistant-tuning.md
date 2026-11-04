# Guide: Assistent tuning

For Opus. A member exports their own log (Settings, Assistent-logboek, "Exporteer voor analyse") and hands you the JSON file. You judge whether Haiku gets interesting input or whether the algorithm needs tuning. Background: ADR-0060, ADR-0046 §3. Only use exports members made themselves; never read other members' rows.

## The export (`format: "atlas.assistant-log.v1"`)

`{ format, exported_at, config, runs, traces }`. Everything is plain data, no `user_id`.

- `config`: the current settings: `model`, `prompt_version` (first 12 hex of the system prompt's sha256), `similarity_threshold` (0.80, the floor of `pattern_edges()`), `cluster_min`/`cluster_max` (3 and 8), `max_calls_per_day` (3), `max_candidates` (6 per run).
- `runs`: one per pattern step of this member, counts only. Each carries its own `config`, so compare `prompt_version` across runs.
  - `path` is `lazy` (after a page view, at most every 6 hours) or `cron` (05:30).
  - `outcome` is one of `no_edges`, `no_clusters`, `all_known`, `no_candidates`, `paused`, `budget`, `ok`, `error`. `error_code` names the failure (never content).
  - Funnel, in order: `edges` (pairs at 0.80 or higher), `similarity_bands` (0.80, 0.85, 0.90, 0.95), `clusters`, `cluster_sizes`, `known` (already in `agent_signals`), `candidates` (the first `max_candidates` unknown clusters), `not_fresh` (rejected by `hasEnoughFreshSources`), `calls`, `helpful`, `not_helpful`, `rejected_by_cleaner`, `call_failures`, `input_tokens`, `output_tokens`.
- `traces`: one per candidate cluster that reached the call stage, unique per cluster (`dedupe_key`).
  - `status`: `asked` (Haiku was called) or `paused` (what Haiku would have received while the pause was on). A paused cluster seen again bumps `last_seen_at` and `seen_count`; it becomes `asked` when asked later.
  - `items`: exactly what was sent, in order: `type` and `id` (from SQL), `kind`, `title` (120 chars), `fragment` (300 chars), `stale`.
  - `similarities`: pairs inside the cluster, `a` and `b` are indexes into `items`.
  - `answer` (null when paused): `helpful`, `message_raw` (what Haiku wrote), `message` (what the cleaner kept, null when rejected), `rejected` (`empty` or `link`).
  - `prompt_version`, `model`, `input_tokens`, `output_tokens`, `duration_ms`.
  - `signal_id`, `signal_status` (`new`, `dismissed`, `acted`, `skipped`, or null) and `status_changed_at`: how the signal was received. `skipped` and null mean it was never shown.
  - `first_seen_at`, `last_seen_at`, `seen_count`.

Retention: traces 90 days after `last_seen_at`, runs 180 days. A trace keeps fragments after the source note changed.

## Questions to answer

1. **Where does the funnel empty?** Sum the runs per `outcome` and per stage. Many `no_edges` or `no_clusters` points at the threshold or the embeddings; `all_known` means the same clusters recur; `no_candidates` and a high `not_fresh` point at freshness; `budget` means the 3-a-day cap bites. Say which stage loses most and whether that is healthy.
2. **Are the clusters coherent?** Read `items` and `similarities` of several traces. Do the notes share a real theme, or only vocabulary? Look for weak links (a low pair joining two groups) and for clusters the size bounds distort.
3. **Would you rate `helpful` like Haiku?** Judge each asked trace's input yourself, without reading `answer` first, then compare. Note false positives (helpful but banal), false negatives, and `rejected` messages the cleaner dropped.
4. **How are the signals received?** Per `signal_status`: `acted` is the goal, `dismissed` is noise, `new` for long is ignored. Relate it to cluster size, similarity and message style. With few traces, say the sample is too small to conclude.

## A proposal

Name what to change and why, with the evidence (trace ids, counts). One of:

- **Threshold**: the similarity floor or the band that should count, with the expected effect on `edges`.
- **Clustering**: size bounds or trimming rules in `lib/assistant/clusters.ts`.
- **Prompt**: the wording of `PATTERN_SYSTEM` in `lib/assistant/patterns.ts`; `prompt_version` changes by itself.

A change ships as a migration (when SQL changes, e.g. `pattern_edges`) plus code, and updates ADR-0046 §3 in the same PR, as that ADR's Consequences say. Never change the log's shape without a migration and an update of ADR-0060.
