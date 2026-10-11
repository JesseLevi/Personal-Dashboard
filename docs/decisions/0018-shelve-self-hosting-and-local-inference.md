# ADR-0018: Shelve the Mac-mini/self-hosted target and local Ollama inference

**Status**: Accepted by the user (2026-10-07). **Supersedes** ADR-0003 (Cloudflare Tunnel exposure — it only ever applied to the Mac mini). **Amends** ADR-0006 (the embedding model host is reopened; the pipeline shape stands), ADR-0012 §6 (the Mac-mini path is no longer "future/optional" but shelved), `Architecture.md` §1/§5/§7/§8, `Vision.md` (Technische context), and `CLAUDE.md` priorities 2–3.

## Context

- ADR-0012 moved the running platform to Vercel + Supabase Cloud on 2026-07-31 and kept the Mac-mini homeserver (two self-hosted Supabase stacks, Cloudflare Tunnel, native Ollama, a self-hosted CI runner, restic backups) as a "future/optional" target.
- None of that infrastructure was ever built (#1–#5 never started). The user has now said it will most likely never be built.
- The docs still describe it as the plan: the system diagram, the AI pipeline ("Ollama `/api/embed`"), the worker ("runs on Mac mini"), security §7, and CLAUDE.md's priority 2 ("Runs fully locally (Mac mini + Ollama)"). That is the same documented-vs-real gap ADR-0012 found as a root cause, and it already steers new work: #309 (recipe import via URL) had to reason around a production Ollama that cannot exist, because Vercel cannot reach a model on a home machine.

## Decision

1. **Vercel + Supabase Cloud is the target topology, not an interim.** The Mac-mini/self-hosted design is shelved. Reviving it requires a new ADR; nothing should be built "in case we go back".
2. **No local inference in any production path.** AI features call **hosted inference APIs, pay-per-use**, through one provider-neutral seam (`lib/ai/`). The provider and model are chosen per feature in that feature's ticket/ADR. The first is #309, which uses Claude Haiku (4.5 at first, 5.5 since 2026-10-07, see ADR-0019 §3).
3. **Cost guardrails apply to every AI feature.** Use deterministic code first and call the LLM only for what code can't do. Every LLM output is schema-constrained and validated with zod. Every AI feature has a per-user rate limit, and the provider console has a hard monthly spend cap. A feature must still work in a degraded form when no provider is configured.
4. **There is no always-on worker host.** Short async work (a few seconds to tens of seconds) runs in the request lifecycle via Next.js `after()`. Longer or scheduled work (embeddings, agent detectors, calendar sync) gets a managed mechanism, such as Supabase Cron/Edge Functions or Vercel Cron, decided when Phase 7/8 starts. `worker/` stays a skeleton until then. Code is written as plain modules so it can move behind a job handler without a rewrite.
5. **ADR-0006 keeps its queue/trigger/`embeddings`/`search_semantic` design.** Only "bge-m3 via Ollama" is reopened. Phase 8 must pick a hosted multilingual embedding model; the `vector(1024)` column doesn't exist yet, so changing the dimension costs nothing today.
6. **Local dev**: `supabase start` + `next dev`, unchanged. Ollama is optional for local experiments, never required.

## Consequences

- **Privacy trade-off, accepted by the user:** content sent to an AI feature leaves the house and goes to the inference provider. This is low-stakes for recipe pages that are already public. For notes (embeddings, agent), Phase 8 must make this explicit again in its own ADR.
- Running cost becomes a small, variable amount that depends on usage, kept in check by the guardrails in §3. No machine to buy, power or maintain.
- The following are obsolete: ADR-0003, `scripts/check-localhost-binding.sh`, the Mac-mini parts of `Architecture.md` §7 (strict localhost binding, `cloudflared`, self-hosted runner, restic/Vault root-key backups, homeserver dead-man's-switch), and board tickets #1–#5. Supabase Cloud's backups cover the backup role (ADR-0012). The Vault root-key concern is Supabase-managed on Cloud.
- `Architecture.md` keeps the shelved Mac-mini text only where it explains a past decision, clearly labelled. The current topology lives in §8 "Current" and this ADR.
