# Assistant tuning

For Opus, when a member hands over an export of their Assistent log. Why it exists: ADR-0060. The pattern rules being tuned: ADR-0046 §3.

## Getting the data

Settings, "Verbanden en slim zoeken", "Assistent-logboek", "Exporteer voor analyse". The route `GET /api/assistant-log/export` runs under the member's session and returns one JSON file. No LLM and no tokens are involved.

The file holds the member's own note and card text (titles and fragments of at most 300 characters). Read it in the session, never commit it, never paste it into an issue, ADR or doc (the repo is public).

## The file

`{ format: "atlas.assistant-log.v1", exported_at, config, runs, traces }`. Neither list carries a user id.

**`config`** is the setup right now, not at the time of each run (each run has its own `config`):
- `model`, `prompt_version` (first 12 hex characters of the sha256 of the system prompt, so it changes when the prompt does), `similarity_threshold`, `cluster_min`, `cluster_max`, `max_calls_per_day`, `max_candidates`;
- `patterns_enabled` (false while the pattern step is paused), `locale`.

**`runs`**: one row per pattern step, newest first, counts only. Up to 180 days.
- `path`: `lazy` (after a page view) or `cron` (05:30). `started_at`, `duration_ms`.
- `outcome`: `no_edges | no_clusters | all_known | no_candidates | paused | budget | ok | error`. `error_code` when it failed.
- The funnel, in the order a run goes through it:
  - `edges` and `similarity_bands` (bands of 0.05 from 0.80, keyed `"0.80"`, `"0.85"`, `"0.90"`, `"0.95"`);
  - `clusters` and `cluster_sizes` (keyed by size, `"3"` to `"8"`);
  - `known` (already in `agent_signals`, so never asked again), `not_fresh` (stale cards only, rejected by the freshness check), `candidates`;
  - `calls`, `helpful`, `not_helpful`, `rejected_by_cleaner`, `call_failures`: `calls` counts only calls Anthropic may have billed. `call_failures` counts every failed call: an unbilled one (HTTP error response, e.g. 429 or 529) was released, so it left no trace, no budget use and the cluster is asked again next run; a billed one (the model answered but not usably, or a connection/timeout) keeps its reservation and has a trace with `answer` null;
  - `input_tokens`, `output_tokens`.

**`traces`**: one row per cluster that reached the call stage, newest first (`last_seen_at`). Kept 90 days after `last_seen_at`.
- `status`: `asked` (Haiku was called) or `paused` (what Haiku would have received). A paused trace that is later asked becomes `asked`.
- `items`: exactly what was sent, in order: `type` and `id` (from SQL), `kind`, `title`, `fragment`, `stale`. A note deleted since then can still be here.
- `similarities`: `{ a, b, similarity }` for each pair in the cluster that `pattern_edges()` returned (`a` and `b` are `type:id`). A pair that is missing is a pair under 0.80, so a cluster can hang together through a chain.
- `answer` (asked only): `helpful`, `message_raw` (what Haiku wrote), `message` (the cleaned text that was stored, or null), `rejected` (`empty` or `link`, why the cleaner dropped a helpful answer). `answer` is null when a billed call failed; `input_tokens` and `output_tokens` are then the response's, or null when the connection died.
- `prompt_version`, `model`, `input_tokens`, `output_tokens`, `duration_ms` (null while paused).
- `signal_id`, and `signal_status` with `status_changed_at`, read from `agent_signals`: `new` (not acted on yet), `dismissed`, `acted` (opened), `skipped` (nothing was said), or null (paused, or the signal is gone).
- `first_seen_at`, `last_seen_at`, `seen_count`: a paused cluster that keeps coming back raises `seen_count`; a high count means a stable cluster that is waiting for the pause to end.

## Questions to answer

1. **Where does the funnel run empty?** Per outcome count the runs. Many `no_edges`: the threshold is too high or there is too little content. Many `no_clusters`: edges exist but no group of three. Many `all_known` or `not_fresh`: the pool is small or stale. `budget`: more candidates than the 3 calls a day. Look at `similarity_bands` for how close the edges sit to the floor.
2. **Are the clusters coherent?** Read `items` and `similarities` of each trace. Does one theme tie them together, or is it a chain through one generic note? Report weak clusters by `dedupe_key`, with the item that caused the drift.
3. **Would you judge `helpful` the same?** For each asked trace, decide from `items` alone whether a message was worth saying. Compare with `answer.helpful`, and say where you differ. Check `message_raw` for invented facts, nagging about stale cards, or text the cleaner dropped that was fine.
4. **How are signals received?** Count `signal_status` over asked traces with a message. `dismissed` without `acted` means the pattern is noise to the member. Small numbers say little: state the sample size.

## Proposal format

End with a proposal, or with "no change" and why. A proposal names one lever:
- **Threshold**: `pattern_edges()` floor (0.80), `max_candidates`, `STALE_DAYS`, the daily budget in `reserve_pattern_signal`.
- **Clustering**: `MIN_CLUSTER_SIZE` or `MAX_CLUSTER_SIZE` in `lib/assistant/clusters.ts`, or how a chain is cut.
- **Prompt**: the change to `PATTERN_SYSTEM` in `lib/assistant/patterns.ts`.

Each proposal gives the evidence (counts, `dedupe_key`s), the expected effect on the funnel, and the risk. It is implemented as a migration (where SQL changes) plus an update of ADR-0046 §3, as that ADR's Consequences say, and the next export shows its effect through `prompt_version` and `config`.
