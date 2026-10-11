# ADR-0032: Deploy and release on Vercel + Supabase Cloud

**Status**: Accepted (2026-10-11, #412). **Supersedes** ADR-0012 and its five amendments, which remain the history of how this came about. Builds on ADR-0018 (hosted is the target topology).

## Context

ADR-0012 grew through five amendments: automatic promotion was reversed, Claude Code got a confirm-then-apply route for migrations, `main` builds were made visible but unaliased, `deploy.yml` was verified, and a `target` input was proposed and then shipped (#280). Then #408 stopped Vercel from building anything except `main`, because preview builds used up deploys that were never looked at. Nobody could tell the current rules without reading all five amendments. This ADR states them once.

## Decision

1. **Topology.** Vercel (region `fra1`) hosts the Next.js app. One Supabase Cloud project (production) holds Postgres, Auth and RLS. Cloudflare R2 holds uploaded binaries (ADR-0024). Anthropic is the hosted inference provider behind `lib/ai/` (ADR-0018). There is no staging environment.
2. **Builds.** Vercel builds pushes to `main` only (`vercel.json` `ignoreCommand` skips every other ref, #408). Pull requests get no preview deployment. `github.autoAlias: false` keeps every `main` build unaliased.
3. **Promotion is manual.** The user promotes a reviewed `main` build to production (dashboard "Promote to Production" or `vercel promote`). Nothing reaches production automatically.
4. **Migrations reach hosted in one of two ways.**
   - `deploy.yml` (`workflow_dispatch` only) with `target`: `migrate` applies pending migrations with `supabase db push`; `deploy` builds and promotes `main`; `both` (default) does migrate, then deploy. The deploy job runs only when migrate succeeded or was skipped. Never `db reset`, never `--force`.
   - Claude Code via the Supabase MCP. It first presents the exact migration and states that it is additive. It applies the migration only after the user explicitly says yes for that migration. Destructive migrations (drop, narrowing type change, data delete) are never applied this way: the user runs them.
   - A migration applied outside `db push` is recorded under that route's own timestamp. Correct the `supabase_migrations.schema_migrations` row to the filename version before the next `db push`.
5. **Ordering is the dispatcher's job.** Apply a migration before promoting code that needs it. Write migrations additively (add, backfill, then tighten; never rename-and-drop in one step), so old code keeps working against the new schema while promotion lags.
6. **CI proves, it does not deploy.** `ci.yml`, `ci-visual.yml` and `ci-db.yml` run on pull requests only. `ci-db` applies all migrations to an ephemeral local stack and runs the RLS suite. No CI job runs `next build`.
7. **Secrets.** `deploy.yml` reads its secrets only from the GitHub Environments `supabase-production` and `vercel-production`, both restricted to `main`. `VERCEL_TOKEN` must be account-scoped (a project-scoped token breaks `vercel pull`). A required-reviewer rule is recommended and not applied.

## Consequences

- A change that only breaks `next build` is first seen on `main`'s Vercel build. Production stays safe because that build is unaliased. Fix forward before promoting.
- Visual review of a branch happens locally or in Ladle, not on a preview URL.
- The Vercel Preview environment variables (development R2 bucket) are now used only if previews are turned back on. Local development uses the development bucket through `.env`.
- Hosted settings that live outside the repo (env vars, exposed schemas, environments, buckets) are listed in `docs/operations.md`.
