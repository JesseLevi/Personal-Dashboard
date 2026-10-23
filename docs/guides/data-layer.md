# Guide: data, schema & product rules

Read this before touching `supabase/`, server components/actions, storage, AI, or any user-facing string. Hosted settings live in `docs/operations.md`.

- **All data access goes through Next.js server code** — the browser never talks to Supabase directly, and `service_role` never leaves server/worker modules (ADR-0033); in app code only `lib/supabase/service.ts`, imported by `app/api/cron/` alone (ADR-0039).
- Every table gets a `user_id` FK and an RLS policy, **plus an RLS test in `supabase/tests` in the same PR** (copy `rls-profiles.sql`) — CI fails on untested tables (ADR-0009). Schema changes only via `supabase/migrations`.
- **A new table's migration must also grant access**: `grant select, insert, update, delete on public.<table> to authenticated;` and `grant select on public.<table> to anon;`. Without the grants every query fails with `42501` — this project's Supabase does not auto-expose new tables. Copy the block in `20260720000001_profiles.sql`.
- Ownership is `user_id`; sharing is per container through `shares` (ADR-0035). Keep access decisions in RLS policies (via `private.<type>_role()` for shared types), never app-side `user_id` filters. A new module keeps a clear owning container.
- Per-user credentials (calendar accounts, later mail) go through the Vault pattern of ADR-0002 — never plaintext, never logged, decrypted only server-side. AI uses one app-level key (ADR-0018).
- No hardcoded user-facing strings — next-intl catalogs, `messages/nl.json` + `messages/en.json` in the same PR (ADR-0007); `tests/messages-key-parity.test.ts` fails on key-set drift.
- Render stored rich text only through TipTap's React renderer (fixed extension whitelist); render AI-agent output as plain text. Never `dangerouslySetInnerHTML` on user or model content.
- `Vision.md` lists explicit "buiten scope" items per module — real boundaries, not backlog.
- AI goes only through `lib/ai/` (prompt + zod schema in, validated object out): deterministic code first, per-user rate limit, degraded mode without a key, output rendered as plain text (ADR-0018/0019). Short async work runs in `after()` with a lazy sweep for stuck rows; there is no worker host yet. `embed()` (bge-m3 on Cloudflare Workers AI, ADR-0043) needs `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_AI_API_TOKEN` and throws `not_configured` without them.
- User-supplied URLs are fetched only through `lib/net/safe-fetch` (SSRF guard).

## Migrations reach hosted deliberately (ADR-0032)

- **Committing a migration does not apply it.** `deploy.yml` is `workflow_dispatch`-only: a push to `main` migrates nothing. Check `supabase_migrations.schema_migrations` on hosted *before* debugging a data-shaped bug.
- **`deploy.yml` `target`**: `migrate` applies migrations only; `deploy` promotes `main`; `both` (default) does both, migrate first. Confirm with the user before dispatching. Alternatively Claude applies an additive migration via the Supabase MCP after the user's per-migration yes. Write migrations additively so promotion may lag. Studio/psql edits against hosted are forbidden.
- **A migration applied by hand or via the Supabase MCP gets that route's own timestamp as its version**, not the filename, and the next `db push` then fails ("already exists"). Correct the ledger row every time.
- **Never batch a migration across parallel agents** — that raced two writers into 250 duplicate `reference.ingredients` rows (#161). One sequential call.
- **Two `db` CI jobs cannot run concurrently** (fixed Supabase ports; `failed to bind host port … 54324`, reads like a broken migration). Wait, then `gh run rerun <id> --failed`.

## Exposed schemas and `reference`

A non-`public` schema must also be exposed on the Data API, and that setting is **not in this repo**: `supabase/config.toml` `[api].schemas` is local only; hosted is a dashboard setting (Exposed schemas), so a migrated, granted, RLS'd schema can still return `PGRST106` in production.

**Hosted state for `reference`**: exposed through the dashboard (Settings → Data API → Exposed schemas = `public, graphql_public, reference`) with **no** `authenticator` role override. Never `alter role authenticator set pgrst.db_schemas`: it shadows the dashboard setting (UI changes then do nothing) and lives outside version control. Check with `scripts/check-reference-exposed.sh` (fails on `PGRST106`). `supabase gen types --linked` includes `reference` and the `public.ingredients.reference_id` FK.

## Generated types (`lib/database.types.ts`)

- CI's `db` job regenerates it (`pnpm db:types`) and fails on `git diff --exit-code`. **Never hand-edit it.**
- Red `db` job: download the `database-types` artifact (`gh run download <run-id> -n database-types`) and commit those bytes as-is.
- The CLI is on `version: latest` in CI on purpose, so red can just mean a new codegen template — adopt the file, don't revert.
- `public.ingredients.reference_id` generates `Relationships: []` (cross-schema FK); that is generator behaviour. `lib/recipes/queries.ts` resolves it with two queries, never an embedded join.

## Auth and server code

- `middleware.ts` only refreshes session tokens — **it is not a route guard.** The single unauthenticated redirect lives in `app/(app)/layout.tsx`; don't add a competing one.
- `getClaims()` verifies the JWT locally (deliberate, #168): a revoked session stays accepted until the access token expires.
- **Never catch `DYNAMIC_SERVER_USAGE` in a try/catch** — reading cookies/locale makes `next build` throw it to signal "not static"; swallowing it hides the bailout and spams build logs. Rethrow it untouched (see `i18n/request.ts`); other errors may fall back to `"nl"`.
- Seed functions (`seed_default_*`) are `after insert on auth.users` triggers (`security definer`; neither `anon` nor `authenticated` can call them, #304) and thin wrappers around `apply_seed()`. Pre-existing accounts are seeded lazily by `ensure_user_defaults()` (called in `app/(app)/layout.tsx`, marker table `user_seeds`, ADR-0017). New seed = key in `seed_keys()` + `seed_*_for` body + `case` in `apply_seed`; never grant EXECUTE on user-id-taking helpers.
- RPC form for atomic multi-statement writes (ADR-0015 precedent: `move_card`): `security invoker`, `search_path=''`, `revoke from public`, grants only to `authenticated`/`service_role`, pgTAP test. anon gets no implicit EXECUTE on new functions (default privileges revoked, #304); `rls-function-execute-grants.sql` fails if one slips through.

## Object storage (R2, ADR-0024)

- **One seam**: `lib/storage/` (`put`/`get`/`delete`/`deletePrefix`/`presignGet`, `fake.ts` for tests) is the only code that touches the S3 client or `R2_*` env; `check:server-only` enforces it.
- **Keys** come from the key builder in `lib/storage/keys.ts`: `<user_id>/<module>/…`, user id from the session, never client input.
- **Delivery**: app route -> `redirectToStoredObject` (`lib/storage/deliver.ts`): session, RLS-bound owner check on the owning row, then `302` to a presigned GET (hour-stable, so the browser caches it). Stored documents keep the app-route URL, never a presigned one.
- **No RLS on objects.** Ownership is proven by Vitest ownership tests against the fake (user B cannot reach user A's key), one per consumer.
- **Orphans**: `deletePrefix` when the owner is deleted; note images also get a lazy sweep (`sweepNoteImages`).
- **Hosted buckets and tokens live outside the repo**: checklist in `docs/operations.md`; backup decision in ADR-0024 Consequences.

## Constraints

- `public.recipe_unit` is the one unit enum — reuse it, never redeclare (`tests/recipes-units-enum-sync.test.ts` fails on drift).
- `reference` types are generated with `--schema public,reference`.
- NEVO nutrition: `NULL` means unknown — never coerce to `0`. The licence attribution line in the macro dropdowns is mandatory (ADR-0013 §2). Volume↔mass coverage is deliberately partial (ADR-0014): a remaining `?` is the specified fallback.
