# ADR-0009: RLS test harness and migration discipline enforced in CI

**Status**: Accepted

## Context

Vision.md §2 fixes security-by-design as a fundament. RLS is the isolation mechanism (ADR-0001), but an RLS policy that was never tested — or a table that silently shipped without one — is an intention, not a guarantee. Schema drift between environments is the other classic solo-maintainer failure mode.

## Decision

- **Migrations**: every schema change is a file in `supabase/migrations` via the Supabase CLI. Studio/psql edits in staging/prod are forbidden; CI deploys run migrations, humans don't.
- **RLS suite** in `supabase/tests`, run in CI against `supabase db reset`: seed two users; for **every** table assert (a) RLS is enabled, (b) user A cannot select/insert/update/delete user B's rows, (c) anon gets nothing. Storage buckets get the same two-user object test.
- **Completeness gate**: a CI script compares `information_schema.tables` (public schema) against the tables covered by the test suite and **fails the build on any gap**. A new table cannot merge without its RLS test.
- Additional CI greps: no `service_role` outside server/worker boundaries (ADR-0002), no hardcoded hex colors in components (CLAUDE.md), no missing i18n keys (ADR-0007).

## Consequences

- The security fundament becomes machine-checked; Sonnet cannot forget RLS on a ticket without CI catching it.
- Slightly slower CI (db reset + suite) — trivial at this project's scale.
- The two-user seed fixture becomes shared test infrastructure from Phase 0 onward.
