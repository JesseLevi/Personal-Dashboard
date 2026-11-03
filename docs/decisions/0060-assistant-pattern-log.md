# ADR-0060: Assistent pattern log, pattern pause and an export for tuning

**Status**: Accepted (user decision, 2026-11-03, #755, #756, #757). Amends ADR-0046 §3, §6 and §7.

## Context

- The pattern step (ADR-0046 §3) runs in production for every member who opted in: lazily after a page view (at most every 6 hours) and in the 05:30 cron.
- Very little of a run is kept:
  - a pattern call leaves one `agent_signals` row with source ids and maybe a message;
  - what Haiku was shown is not stored, nor how SQL and the clustering got to the candidates;
  - a run that ends before a call (no edges, no clusters, every cluster already known, budget used) leaves no trace;
  - token usage only goes to the Vercel console, which keeps it briefly.
- The user wants to see what the Assistent does, and to hand that record to Opus. Opus then judges whether Haiku gets interesting input or whether the algorithm (thresholds, clustering, prompt) needs tuning. Opus needs enough data for that.
- For the coming weeks there is too little history for useful patterns. Spending up to 3 Haiku calls a day on that is waste. The user wants to pause the calls while embeddings, rhythms and the log keep going.
- ADR-0046 §6 said there is no second toggle. Pausing is not a consent question: it only stops calls. Consent stays `profiles.ai_enabled`.

## Decision

1. **Pattern pause: a second, subordinate setting.**
   - `profiles.assistant_patterns_enabled boolean not null default true`, written only through `set_assistant_patterns_enabled(boolean)` (column grants, like `ai_enabled`).
   - In Settings it is a checkbox under the AI opt-in, disabled while `ai_enabled` is off.
   - **Off** means the pattern step still runs up to the candidate list, then stops before reserving: no Haiku call, no `agent_signals` row. `reserve_pattern_signal*()` returns `'paused'`, so the database enforces it, like the budget.
   - Everything else continues: embeddings, rhythms, the run log (§2) and paused traces (§3).
   - Turning it off deletes nothing. Turning `ai_enabled` off still deletes embeddings and `pattern` signals, and now also the traces (§3).
2. **Run log `public.assistant_pattern_runs`: one row per pattern step of a consenting member, counts only.**
   - Columns: `user_id`, `path` (`lazy|cron`), `started_at`, `duration_ms`, `outcome`, `error_code`, and the funnel:
     - `edges`, plus a similarity histogram in bands of 0.05 from 0.80 (`jsonb`);
     - `clusters` and their sizes (`jsonb`);
     - `known` (already in `agent_signals`), `not_fresh` (rejected by `hasEnoughFreshSources`), `candidates`;
     - `calls`, `helpful`, `not_helpful`, `rejected_by_cleaner`, `call_failures`;
     - `input_tokens`, `output_tokens`;
     - `config jsonb`: model, prompt version (a hash of the system prompt), similarity threshold, cluster size bounds, budget.
   - `outcome` is one of `no_edges | no_clusters | all_known | no_candidates | paused | budget | ok | error`.
   - No titles, fragments or messages in this table.
   - **Access**: the owner selects. Written only by `security definer` functions on `auth.uid()`, with `_for(user)` variants that only `service_role` may execute (ADR-0046 §5 pattern).
   - Rows older than 180 days are pruned by the detector run.
   - For the operator, a view in `private` sums the funnel per day over all members, without `user_id`. It is read in the Supabase SQL editor only.
3. **Traces `public.assistant_pattern_traces`: what Haiku saw and said, for the owner only.**
   - One row per candidate cluster that reached the call stage, unique on `(user_id, dedupe_key)`.
   - `status`: `asked` (a call was made) or `paused` (§1: what Haiku would have received).
   - Columns:
     - `items jsonb`: exactly what was sent, in order (source type and id from SQL, kind, title, fragment, stale);
     - `similarities jsonb`: the pairwise similarities inside the cluster;
     - `prompt_version`, `model`;
     - `answer jsonb`: `helpful`, the raw message and the cleaned one, and why the cleaner rejected it (`empty|link`);
     - `input_tokens`, `output_tokens`, `duration_ms`;
     - `signal_id` (nullable, `on delete set null`) to the `agent_signals` row. The outcome (`new|dismissed|acted`) is read from that row, never copied.
     - `first_seen_at`, `last_seen_at`, `seen_count`: a paused cluster seen again updates these instead of adding rows.
   - A paused cluster is not stored in `agent_signals`. It stays unknown, so it is asked once the pause ends.
   - **Access** as in §2. Clients have no write grant.
   - **Retention**: deleted 90 days after `last_seen_at`, by the detector run. Deleted at once when `ai_enabled` is turned off (in `set_ai_enabled`), and with the account.
   - A trace keeps a copy of fragments of at most 300 characters. A deleted note's fragment can stay in a trace until the 90 days are up. The user accepted this.
4. **Token usage comes from the API response.** `lib/ai/` gains a variant of `generateObject` that also returns `{ inputTokens, outputTokens }`. The seam stays provider-neutral. There are no extra calls and no larger prompt: the model is not asked for a reason.
5. **Assistent log in Settings.** A subpanel opened from the AI subpanel. It reads the member's own runs, traces and the linked signal status through the RLS client:
   - runs per day with their outcome and funnel;
   - each trace with what was sent, the answer and the outcome;
   - an "Export for analysis" action: a server route under the member's session returns one JSON file (`format: "atlas.assistant-log.v1"`) with runs, traces, the linked signal status and the current config. No LLM is involved.
   - The Sidebar item "Assistent" stays removed (ADR-0051 §5).
   - The Settings text says the Assistent keeps this log, visible only to the member, kept 90 days, deleted on opt-out.
6. **Tuning guide `docs/guides/assistant-tuning.md`** tells Opus what each export field means and what to answer:
   - where the funnel empties (edges, clusters, known, freshness, budget);
   - whether clusters are coherent (read the items and similarities);
   - whether Haiku's `helpful` matches Opus's own judgement of the same input;
   - how signals are received (acted, dismissed, ignored);
   - a proposal: thresholds, clustering or prompt. A change is a migration plus an update of ADR-0046 §3, as that ADR's Consequences say.

## Consequences

- Pausing stops pattern spend, while the log keeps showing what Haiku would have received. That tells you when there is enough to resume.
- Content of other members never reaches the operator: they only appear as totals. A content analysis by Opus only uses exports that members make of their own log.
- Two new owner-only tables, each with RLS, grants and pgTAP tests. A trace copies small fragments of content for up to 90 days.
- At up to 3 calls a day per member, a month gives at most about 90 asked traces per member. The run log covers every run, including the many runs that end early.
- Changing what a run records is a migration plus an update of this ADR.
