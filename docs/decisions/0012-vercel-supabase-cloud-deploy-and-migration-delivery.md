# ADR-0012: Vercel + Supabase Cloud as the current deploy target; migrations delivered by CI

**Status**: Accepted by the user as the operating decision for the foreseeable future (2026-07-31). **This ADR has not yet been reviewed or ratified by the architecture layer (Fable)** — see Provenance. It supersedes `Architecture.md` §8 for as long as it stands; the Mac-mini/self-hosted topology §8 previously described is reframed as a **future/optional** target (§6 below), not deleted.

**Authored by**: Claude Code (Opus 5), at the user's explicit instruction, writing up a decision the user made — not one this agent originated. Per `CLAUDE.md` and `docs/guides/ticket-workflow.md`, Claude Code is not the architecture layer; ADRs normally come from Fable's analysis of `Vision.md`. This one does not, for the same reason ADR-0011 didn't: production was broken and the fix could not wait for the next architecture round. **A later session must get Fable's ratification of this ADR** (or a revision superseding it) the next time the architecture layer runs. Until then this is the user's operating decision, faithfully recorded — not an architecturally-reviewed conclusion.

## Context

`/recepten` returns 500 in production with `PGRST205 Could not find the table 'public.recipe_categories'`. Root cause, confirmed before this ADR was written: **migrations have no delivery path to the hosted database.**

- CI's `db` job (`.github/workflows/ci.yml`) runs `supabase start` (an ephemeral local Postgres container), applies migrations against it, runs the RLS suite, then `supabase stop` — the container and everything applied to it is discarded at job end. This job proves the *migration files* are syntactically and RLS-wise sound; it proves nothing about the *hosted* project's schema.
- Vercel's GitHub integration auto-deploys every merge to `main` to production. Application code therefore ships automatically on every merge.
- No process ever pushes `supabase/migrations/*` to the hosted project. `/te-doen` works only because its migration was applied by hand when the project was set up (`docs/HANDOFF.md`, `docs/phase-log.md`). Nothing repeatable has run since.
- Net effect: code ships on every merge, schema ships never (except by hand, once). Two Phase 4 migrations — `supabase/migrations/20260730000001_ingredient_library.sql` and `20260730000002_recipe_schema.sql` — are sitting unapplied against the hosted project while `/recepten`'s application code (merged via #119–#124) already expects them.
- `Architecture.md` §8 (and §1's system diagram) describes a Mac-mini homeserver running two Supabase Docker stacks behind a Cloudflare Tunnel, deployed by a hardened self-hosted GitHub Actions runner. **None of that infrastructure exists.** `docs/HANDOFF.md` and `docs/phase-log.md` record the Mac-mini items (#1–#5) as not started. The gap between documented and real topology is part of how this shipped silently: `Architecture.md` reads as though a deploy pipeline exists, so a reader has no reason to suspect migrations aren't reaching production.
- The user's decision, made explicitly and out of band from a ticket, is: **for the foreseeable future the platform runs on Vercel (app hosting) + Supabase Cloud (database)**, not the Mac mini. This ADR records that decision and builds the missing migration-delivery mechanism.

## Decision

### 1. Current topology: Vercel + Supabase Cloud

- **Vercel** hosts the Next.js app (production + preview deployments per PR, via its GitHub integration). Vercel's own build/deploy mechanics (Node runtime, edge network, image optimization, etc.) replace the Mac-mini Next.js instances described in `Architecture.md` §1/§8.
- **Supabase Cloud** hosts Postgres + Auth + RLS + Storage for the single hosted project. Supabase Cloud's automatic backups replace the Mac mini's restic/pg_dump plan from `Architecture.md` §7 for now (still worth revisiting once/if the Mac-mini path is picked back up — Cloud backup retention depends on plan tier).
- Ollama/local inference (`Architecture.md` §5) has no cloud equivalent decided here — out of scope for this ADR. AI-pipeline phases (7–8) will need their own decision about where inference runs; this ADR only settles app hosting + database + migration delivery.
- The worker (`worker/`, job queue consumer) is not addressed here either — it currently has no host. Out of scope; flag when Phase 7 starts.

### 2. Migrations reach production exclusively through CI

- `package.json` gains a `db:push` script (`supabase db push`, resolved via the `supabase` devDependency exactly like the existing `db:reset`/`test:rls`/`db:types` scripts — no global install, no Docker needed to *run* this script, though it does need network access to the hosted project).
- A new workflow, `.github/workflows/deploy.yml`, adds a `migrate` job that runs `supabase link` + `supabase db push --linked` against the hosted project using repo secrets. It:
  - triggers only on `push` to `main` and `workflow_dispatch` — **never on `pull_request`**, so no fork PR or unreviewed branch can touch the hosted schema;
  - never runs `supabase db reset`, `--force`, or any other destructive/rewriting operation — `db push` only ever applies pending migrations forward, matching the Supabase CLI's own semantics (confirmed against the CLI source: `db push` has no reset/drop path; that's what `db reset` is for, and this ADR forbids using it against anything hosted);
  - has no `continue-on-error` and no output piped through a filter — a failed push fails the job, fails the workflow, and (per §3) blocks the production deploy that depends on it.
- Studio/psql manual edits against the hosted project remain forbidden per ADR-0009 except for the one-time remediation in §5 below, which exists precisely because this mechanism didn't exist yet when the two Phase 4 migrations were written.

### 3. The ordering problem: Vercel must not deploy ahead of its schema

Vercel's Git integration deploys the instant `main` moves — it does not know or wait for a GitHub Actions job. A naive "CI migrates after merge" job races the very Vercel deploy that just fired, reproducing this outage for the window between merge and migration completion (worse, if migration then fails, the broken window becomes permanent, not transient).

Three options were considered:

- **(A) Gate Vercel's production build on the migration job.** E.g. a build-time script that polls the GitHub Actions API for the migration job's status before deciding whether to proceed. Rejected as the primary mechanism: it requires the Vercel build container to poll an external API for an unbounded/unclear amount of time before Vercel's own build-timeout budget, and there is no first-class "wait for an external CI job" primitive — only "skip this build" (`ignoreCommand`), which cannot un-skip itself later without a manual re-trigger. Building a robust poll-with-timeout-and-safe-failure script was judged more fragile than option B for the same outcome.
- **(B) Decouple Vercel's production deploy from Git; deploy from CI after migrations succeed.** ✅ **Chosen.** Vercel's own documented pattern for "atomic deploys with DB migrations" is exactly this: migrate → verify → deploy/promote. Concretely:
  - `vercel.json` (new, committed) sets `"ignoreCommand": "if [ \"$VERCEL_ENV\" = \"production\" ]; then exit 0; else exit 1; fi"`. `VERCEL_ENV` is a Vercel system environment variable, available during the Ignored Build Step, always `production` exactly when a build targets the production domain. Exit `0` = Vercel skips/ignores that build; exit `1` = it proceeds. Effect: **Vercel's own Git-triggered build for production is always skipped.** Preview deployments (any PR, any non-production branch) are completely unaffected — the condition only matches `VERCEL_ENV=production`, and preview builds are `VERCEL_ENV=preview`.
  - `.github/workflows/deploy.yml`'s `deploy` job (`needs: migrate`, so it only starts after migrations succeed) runs `vercel pull --environment=production` → `vercel build --prod` → `vercel deploy --prebuilt --prod` using a `VERCEL_TOKEN`/`VERCEL_ORG_ID`/`VERCEL_PROJECT_ID`. This is now the **only** path that ever produces a production deployment.
  - This is fully in-repo (no manual Vercel dashboard toggle required for the gating mechanism itself — `vercel.json` is read automatically) and reviewable in this PR.
- **(C) Accept a documented window + forward-compatible-migrations rule.** Rejected as the *primary* mechanism (it doesn't fix the race, it just bounds the blast radius), but its discipline is **adopted as a secondary rule regardless of (B)**: migrations should still be written additive/forward-compatible where practical (add-nullable-then-backfill-then-tighten, never rename-and-drop-in-one-migration) because `deploy.yml`'s two jobs are not one atomic transaction — a migration can succeed while the subsequent Vercel deploy step fails for unrelated reasons (bad token, Vercel outage), leaving old code running against new schema for an unknown period until the deploy job is retried. Additive migrations keep that window harmless; option (B) keeps the window itself as short as a CI job pair rather than eliminating it outright, since no purely additive mechanism eliminates all cross-service coordination.

**Trade-off written down, as required**: option (B) means production no longer deploys "the instant you merge" — it deploys once `migrate` finishes, adding the migration job's runtime (typically well under a minute for these migration sizes) to the merge-to-live latency. That is the cost of correctness here; the alternative (A) was rejected for fragility, and (C) alone would have left the race live.

### 4. Security trade-off: CI now has write access to the production schema

Giving a GitHub Actions job `SUPABASE_ACCESS_TOKEN` + `SUPABASE_DB_PASSWORD` for the hosted project means **anyone who can get a workflow run of `deploy.yml` executed can alter the production schema** (and, via `vercel deploy`, replace the production app). This is a materially higher-privilege CI job than anything else in this repo's CI, so:

- The workflow triggers **only** on `push` to `main` (never `pull_request`, never a fork) and `workflow_dispatch` (a maintainer manually clicking "Run workflow" in the Actions UI, which requires write access to the repo).
- Secrets are scoped to two **GitHub Environments** — `supabase-production` (holds `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_REF`) and `vercel-production` (holds `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`) — rather than repo-wide secrets, so a job that doesn't declare `environment: supabase-production`/`vercel-production` cannot read them, even if a future workflow is added carelessly.
- **The user should add environment protection rules** to both (Settings → Environments in the GitHub repo): at minimum "deployment branches: `main` only" (blocks the environment's secrets from ever being usable from a branch build even if the trigger condition above were ever loosened by mistake), and ideally a required-reviewer rule so a human approves each production migration/deploy run. This ADR recommends it; it is not applied by this PR, since changing repo-level environment protection is a repo-admin action outside what this PR's code changes do.
- Least-privilege on the credentials themselves: `SUPABASE_ACCESS_TOKEN` should be a personal access token scoped to this project only if the Supabase dashboard supports project-scoped tokens at creation time; `VERCEL_TOKEN` likewise scoped to the single Vercel team/project rather than an account-wide token, if the plan supports it.
- Who can trigger it in practice: anyone with push access to `main` (i.e., anyone who can merge a PR) or write access to trigger `workflow_dispatch`. This is not a wider blast radius than "anyone who can merge to main can already ship arbitrary app code to production" (true today via Vercel's Git integration) — it adds schema-level access to that same trust boundary, which is the accepted cost of closing the outage.

### 5. Manual remediation for the tables that are missing today (one-time, human-run)

The two Phase 4 migrations have never reached the hosted project. Until a human runs one of the two routes below, `/recepten` continues to 500. **Claude Code must not run either route** — no `db push`, no `link`, no remote SQL, from this agent, ever. The user runs this.

**Route 1 — SQL editor (no CLI setup required):**

1. Open the hosted project's Supabase Studio → SQL Editor.
2. Paste and run the full contents of `supabase/migrations/20260730000001_ingredient_library.sql` first.
3. Paste and run the full contents of `supabase/migrations/20260730000002_recipe_schema.sql` second. **Order matters**: migration 2's `recipe_ingredients.unit` and both `ingredient_unit_masses` tables reuse the `public.recipe_unit` enum that migration 1 creates; running 2 before 1 fails on a missing type.
4. Continue to the "reference schema exposure" step below — required either way.

**Route 2 — Supabase CLI (`supabase link` + `db push`):**

1. `supabase login` (or export `SUPABASE_ACCESS_TOKEN` for the session) and `supabase link --project-ref <the hosted project's ref>`.
2. **Before pushing, run `supabase migration list --linked`** and compare it against the local migration list. Neither `20260730000001_ingredient_library` nor `20260730000002_recipe_schema` should show as already applied. This check matters specifically because **none of the `create table` statements in either migration use `if not exists`** — if a partial/prior application ever happened by hand, re-running blindly errors (best case) or silently duplicates objects it can (worst case, for anything not itself already guarded). If `migration list` shows anything unexpected, stop and reconcile by hand rather than pushing.
3. `pnpm db:push` (equivalently `supabase db push --linked`) applies both migrations, in filename/timestamp order, in one step.
4. Continue to the "reference schema exposure" step below — required either way.

**Reference schema exposure (required by both routes, easy to miss):**

`lib/recipes/queries.ts` calls `.schema("reference")` in two places (`referenceIngredientsMatching`, line 164, and `resolveIngredientUnitMass`'s reference-mass lookup, line 335). `supabase/config.toml`'s `[api].schemas = ["public", "graphql_public", "reference"]` **only configures the local CLI stack** — it has no effect on the hosted project. On the hosted project, go to **Settings → Data API → Exposed schemas** and add `reference` alongside `public`/`graphql_public`. Skipping this step leaves both migrations applied correctly but every `.schema("reference")` call failing with `PGRST106` ("The schema must be one of the following: ..."), which looks like a different bug from the one this ADR fixes and is easy to chase down the wrong path if this step is forgotten.

### 6. Relationship to the Mac-mini path (`Architecture.md` §8, §1, §7)

The Mac-mini/self-hosted design in `Architecture.md` is not wrong or discarded — it was designed before any hosting decision was exercised in production, and none of its infrastructure (#1–#5 in `docs/phase-log.md`) was ever built. This ADR does not retire it; it demotes it to a **future/optional target**: something to pick back up if/when running fully locally (CLAUDE.md priority 2) becomes practical again, e.g. once Ollama/local-inference phases (7–8) are underway and the Mac mini is provisioned for that anyway. Until then, Vercel + Supabase Cloud is what actually runs, and this ADR — not `Architecture.md` §8 — is authoritative for deploy topology.

## Consequences

- **Activation order is not optional: create all six secrets BEFORE this ADR's PR merges.** The moment `vercel.json` lands on `main`, Vercel stops building production from Git (§3) — but `deploy.yml` cannot take over until its secrets exist, and it fails at `supabase link` without them. Merging first and adding secrets later therefore leaves production with *no* deploy path at all: the currently-live deployment keeps serving (so there is no outage, and no rollback), but every subsequent merge silently never reaches production, and the only symptom is that the site quietly stops changing. Recovery is simply to add the secrets and re-run the workflow, but the failure is easy to misread as "the deploy is slow" rather than "the deploy never ran". If the secrets cannot be created yet, hold the PR rather than merging it in a half-armed state.
- **`Architecture.md` §8 is amended** to point here for the current topology, with the Mac-mini plan kept as a clearly labeled future/optional section rather than deleted.
- **Merge-to-live latency increases** by the `migrate` job's runtime (§3) — an accepted, documented trade-off, not a regression to silently work around later.
- **A GitHub Actions job now holds production-schema-altering and production-app-replacing credentials.** Mitigated by trigger restriction, environment scoping, and (recommended, not yet applied) environment protection rules and required reviewers — see §4.
- **This ADR needs Fable's ratification.** Until that happens, treat §1's topology decision as the user's word, not the architecture layer's; if a later architecture pass disagrees (e.g., decides the Mac-mini path should be primary again, or that a different CD sequencing is preferable), that pass supersedes this document, same as any ADR can supersede another.
- **The two Phase 4 migrations remain unapplied against the hosted project until a human runs §5.** This ADR and its CI mechanism prevent the *next* migration from silently failing to ship; they do not, by themselves, fix `/recepten` today.
- **Supabase Cloud's own backup/retention behavior replaces the Mac-mini restic plan for now** — worth an explicit revisit (separate ADR) once the Mac-mini path is picked back up, since `Architecture.md` §7's Vault-root-key-backed-up-separately requirement was written for the self-hosted pgsodium setup and may not map directly onto Supabase Cloud's managed Vault.
