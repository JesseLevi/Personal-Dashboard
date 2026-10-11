# ADR-0017: Lazy, idempotent "ensure defaults" for every per-user seed

**Status**: Accepted (user decision, 2026-10-06, #293)

## Context

`seed_default_board`, `seed_default_recipe_categories` and `seed_default_note_categories` are `after insert on auth.users` triggers. They never fire for accounts that existed before the trigger did (the two hosted accounts have no `note_categories`), and every future seed function would inherit the same gap. #293 asked to either decide on a lazy "ensure defaults" or do nothing, and to combine it with #189 (the seed functions are `security definer`).

## Decision

Lazy, idempotent "ensure defaults" on authenticated load, **one mechanism for all seed functions** (user decision):

- `public.ensure_user_defaults()` (`20261007000001_ensure_user_defaults.sql`): `security definer`, `set search_path = ''`, scoped to `auth.uid()` with no user-id parameter, EXECUTE for `authenticated`/`service_role` only. Called from `app/(app)/layout.tsx` via `lib/defaults/ensure.ts` (server code only, ADR-0033).
- One marker table `public.user_seeds (user_id, seed_key)` (FK, RLS select-own, no client write policy/grant, `rls-user_seeds.sql`). `apply_seed(user_id, key)` claims the marker with `insert ... on conflict do nothing` and runs the seed body only if the claim was its own. The primary key serialises concurrent callers, and marker and seed rows commit in one transaction. Chosen over a bare "zero rows" check (racy; would resurrect categories a user deleted on purpose) and over an advisory lock (needs an extra existence check anyway, and does not remember past runs). Each seed body keeps a zero-rows guard so legacy accounts that already have data are marked, not topped up.
- Triggers stay (new accounts are seeded at signup, no first-load race) but are now thin wrappers around `apply_seed`; each seed has one body (`seed_*_for`). A future seed = a key in `seed_keys()`, a body, a `case` branch.
- #189 for this family: seed bodies and `apply_seed` take a user id, so EXECUTE is revoked from `public`, `anon` and `authenticated`; the trigger functions have no client grants (#304). `anon` cannot execute `ensure_user_defaults`.
- Steady-state cost: one indexed count on `user_seeds`, early exit.
- No production backfill is written: each existing account is seeded by its own first load after deploy (ADR-0012 delivery).

## Consequences

- Layouts and pages render concurrently in Next.js, so on that very first load the page may render before the seeds commit; one refresh shows them. Accepted for a once-per-account event.
- A legacy account that had already deleted every row of a seed table is reseeded once.
- `lib/database.types.ts` is regenerated in CI; until it contains `ensure_user_defaults` and `user_seeds`, `lib/defaults/ensure.ts` calls the RPC through a typed cast (remove after regeneration).
- `20260731212646_backfill_recipe_categories.sql` stays as the historical one-off; it is not repeated for other seeds.
