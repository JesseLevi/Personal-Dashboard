# ADR-0046: Assistent signals: deterministic rhythms for everyone, LLM patterns on opt-in

**Status**: Accepted (user decision, 2026-10-26, #630, epic #32). Amends ADR-0043 §2 (consent now also covers Anthropic for the Assistent).

## Context

- The Vision's Assistent reports signals from a member's own data in plain language. Phase 8 built what it reads: `embeddings` and `search_semantic` (ADR-0043) and `activity_events` (ADR-0044).
- The detectors, as #32 first described them:
  - cards that sit too long in one column;
  - an expired `due_at`;
  - recurring themes from vector neighbours;
  - rhythms of buying and cooking.
- **The user rejected stuck-card reminders**: being told a card is stuck causes irritation. A stuck card is worth something only as part of a pattern that the Assistent can help with.
- A rhythm is counting and date arithmetic. Deterministic code does it better and cheaper, and nothing has to leave Atlas (ADR-0018 §3, ADR-0044 §6). Recognising a theme across notes and cards, and saying something helpful about it, is what an LLM is for.
- Where signals appear in the app is not decided yet.
- Opt-in (ADR-0043 §2) names only Cloudflare. A pattern needs titles and fragments of notes and cards to go to the LLM, Claude Haiku via Anthropic. No member can have opted in yet: the toggle reads "Nog niet beschikbaar" until #574 sets the Cloudflare variables.

## Decision

1. **Two kinds of signal, one table.**
   - **Rhythms** (`buy_rhythm`, `cook_rhythm`) are found in SQL for every member, without AI and without consent. They are stored as `kind` + `payload` (ids and numbers) and phrased at display time from nl/en catalog strings, so they follow the viewer's language and stay LLM-readable data.
   - **Patterns** (`pattern`) are found for consenting members only. SQL proposes the candidates, and one Haiku call per candidate decides whether it is worth saying and phrases it. The stored `message` is plain text in `profiles.locale` (ADR-0007).
   - **A stuck card or an expired deadline is never a signal on its own.** A card whose `updated_at` is older than 21 days counts as *stale* and is context for a pattern only.
2. **Rhythm rules.** Thresholds are constants in the detector function and must match this list:
   - **`buy_rhythm`**: per `item_key`, take the distinct days with a `basket_item_checked` event in the last 365 days.
     - Conditions: ≥ 4 days; median interval `M` between 5 and 120 days; days since the last purchase ≥ `round(0.85·M)`.
     - The signal does not apply while an unchecked item with that `item_key` is in one of the member's baskets.
   - **`cook_rhythm`**: per `recipe_id`, take the distinct days with a `recipe_cooked` event in the last 365 days.
     - Conditions: ≥ 3 days; `M` ≤ 60 days; days since the last cook ≥ `greatest(2·M, 21)`.
     - The signal does not apply while a meal plan for that recipe exists from today on.
   - **One signal per cycle**: `dedupe_key` is the key plus the date of the last event. Dismissing hides the signal until the next purchase or cook starts a new cycle.
   - A `new` signal whose condition no longer holds is deleted on the next run. At most 5 new signals per kind per run, most overdue first.
3. **Pattern rules.**
   - **Candidates**:
     - seeds are notes and cards changed in the last 30 days;
     - their neighbours are notes and cards with a cosine similarity ≥ 0.80 (best chunk per source);
     - pure TS groups these into clusters of 3–8 sources;
     - `dedupe_key` is a hash of the sorted source ids;
     - a cluster whose key is already stored, in any status, is never asked again.
   - **The call**:
     - input: titles and fragments of at most 300 characters per source, plus which cards are stale, delimited as untrusted data;
     - output: zod `{ helpful: boolean, message: string ≤ 280 }`;
     - `helpful: false` is stored as `skipped`, so the cluster is not asked again.
   - **Budget**: at most 3 calls per member per day, counted from that day's `pattern` rows. Clients cannot delete those rows.
4. **Prompt-injection limits** (hard requirement):
   - the LLM has no tools and writes nothing;
   - code writes its validated result into the member's own `agent_signals` row;
   - `payload.sources` (type + id), and so every link a signal offers, comes from SQL, never from LLM output;
   - the message is rendered as plain text only.
5. **Table `public.agent_signals`**:
   - `user_id`, `kind`, `dedupe_key`, `payload jsonb`, `message` (patterns only, ≤ 400 characters), `locale`;
   - `status` `new | dismissed | acted | skipped`, plus `status_changed_at`;
   - unique on `(user_id, kind, dedupe_key)`.
   - **Access**: the owner selects. `authenticated` has no insert, update or delete grant.
     - Detectors write through `security definer` functions that act on `auth.uid()`, with `_for(user)` variants that only `service_role` may execute.
     - A member changes a status only through `set_agent_signal_status()`: `new → dismissed` or `new → acted`.
   - Closed rows older than 180 days are pruned by the detector run.
6. **Consent: the existing opt-in is extended**; there is no second toggle.
   - `profiles.ai_enabled` now also allows pattern signals. The Settings text names Anthropic as the recipient for the Assistent, next to Cloudflare for the index.
   - Turning it off deletes the member's `pattern` signals in the same transaction as their embeddings (`set_ai_enabled`).
   - Rhythm signals stay: they never leave Atlas.
7. **Runtime (ADR-0039 §6)**:
   - **Lazy**: after a signed-in page renders, `after()` runs the Assistent with the member's RLS client. It runs at most once per 6 hours per member (`claim_assistant_run()`) and does three steps: settle cooked meals, detect rhythms, then the pattern step.
   - **Backstop**: a daily cron at 05:30 UTC, after embeddings, behind `CRON_SECRET`, with `service_role`. It covers rhythms for every member and patterns for consenting ones. If Vercel Hobby allows no further cron job, the embeddings route runs this step after its drain.
   - Without `ANTHROPIC_API_KEY`, Cloudflare credentials or consent, the pattern step does nothing, and rhythms still work.
8. **One follow-up action per kind**, taken by the member, not by the agent:
   - `buy_rhythm`: add the item to the default basket;
   - `cook_rhythm`: open the recipe;
   - `pattern`: open the first source.
   - Each action also sets `acted`. A member can dismiss any signal.
9. **No surface yet.** This phase ends at a read contract: server-only view-models, a count of new signals, and server actions for dismiss and act. The Sidebar item stays a no-op. Choosing a place in the app is a later decision; it needs no schema change.

## Consequences

- Rhythms cost nothing and work for every member, but only once the history has weeks of data (ADR-0044 started recording on 2026-10-24).
- Pattern cost stays below 3 Haiku calls per consenting member per day, inside the Console spend cap.
- A member in a shared basket contributes to the owner's history, so rhythm signals go to the basket owner only.
- `item_key` grouping is exact, so "pindakaas" and "pindakaas 600g" are two rhythms (ADR-0044).
- Thresholds are guesses. Changing them is a migration plus an update of this ADR's §2–3, not a new ADR.
- A conversation over the member's own data (RAG on `search_semantic`) stays out of this phase.
