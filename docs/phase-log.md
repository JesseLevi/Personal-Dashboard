# Phase log — what is already built (do NOT create tickets for these)

Authoritative completion record against the phasing in `Architecture.md` §10 / ADR-0004.
**Opus: skip ticket creation for anything marked ✅; create tickets only for ⬜ and the listed follow-ups.** Keep this file updated whenever a phase item lands.

## Phase 0 — Foundation: ✅ largely complete (2026-07-20, by Fable)

### ✅ Done, verified working (lint + typecheck + tests + build all pass locally)

| Item | Where | Notes |
|---|---|---|
| Repo scaffold: Next.js 15 (App Router) + TS strict + pnpm | `package.json`, `tsconfig.json`, `app/` | Node 24, pnpm 11 via corepack; build verified |
| Tailwind v4 via PostCSS | `postcss.config.mjs`, `app/globals.css` | CSS-first, no tailwind.config file (v4 style) |
| Design tokens pipeline (ADR-0010) | `design/tokens.json` → `scripts/generate-theme.mjs` → `app/theme.css` | `pnpm sync:tokens`; tokens filled with real values from Figma MCP (2026-07-20); generated theme is CI-checked for drift |
| Token generator unit tests | `tests/tokens.test.ts` (vitest) | 5 tests, all pass |
| Figma↔code map (ADR-0010) | `design/figma-map.json` | Paths reserved for all known components; `nodeId: null` until each is built in Phase 2 |
| i18n (ADR-0007) | `next.config.ts`, `i18n/request.ts`, `messages/{nl,en}.json` | next-intl wired, NL default; locale-from-profile is a Phase 1 TODO in `i18n/request.ts` |
| Supabase project structure | `supabase/config.toml` (via `supabase init`), CLI as devDependency | Docker is NOT on this dev machine — `db:reset`/`test:rls` run in CI or on the server |
| First migration: `profiles` + `set_updated_at()` + signup trigger + full RLS | `supabase/migrations/20260720000001_profiles.sql` | This is the Phase 1 "profiles" ticket's schema half, already done |
| RLS harness (ADR-0009) | `supabase/tests/000-rls-enabled.sql` (all tables RLS'd + ≥1 policy), `supabase/tests/rls-profiles.sql` (two-user pattern) | pgTAP; rls-profiles.sql is the copy-me template |
| RLS coverage gate (ADR-0009) | `scripts/check-rls-coverage.sh` | Fails CI when a public table lacks `supabase/tests/rls-<table>.sql` |
| Security greps (ADR-0002/0003/0010) | `scripts/check-server-only.sh` | service_role placement, no NEXT_PUBLIC_SUPABASE, no dangerouslySetInnerHTML, no raw hex in components |
| Localhost-binding check (§7) | `scripts/check-localhost-binding.sh` | Run ON THE SERVER; also wire into deploy workflow later |
| Supabase server client (ADR-0003 pattern) | `lib/supabase/server.ts` | `server-only`, cookie-based, **no NEXT_PUBLIC_ vars by design** |
| Worker skeleton (ADR-0006) | `worker/index.ts` | Poll loop, backoff/retry, graceful shutdown, heartbeat ping; handlers intentionally empty until Phases 7–9. Depends on `claim_next_job()` SQL fn that ships WITH the jobs-table migration in Phase 7 |
| Ladle workbench (ADR-0010) | `components/Welcome.stories.tsx` | Placeholder story; delete when first real story lands |
| CI pipeline | `.github/workflows/ci.yml` | app job (tokens-drift, lint, typecheck, test, greps, build) + db job (supabase start, pgTAP, coverage gate). **Not yet executed — no GitHub remote; verify on first push** |
| Supply-chain policy | `pnpm-workspace.yaml` (`allowBuilds`), lockfile committed | CI uses `--frozen-lockfile` |
| `.env.example` | repo root | Real `.env` git-ignored; no secrets in repo (`.mcp.json` also ignored) |

### ⬜ Phase 0 remainder — needs tickets (all server-side/GitHub-side; could not be done from this dev machine)

1. ~~**GitHub repo + first push**~~ ✅ done 2026-07-20: private repo `JesseLevi/Personal-Dashboard`, `main` pushed, `gh` installed + authenticated, tickets/milestones created, Project kanban board live. **Still open: confirm CI goes green** — first runs hit a GitHub Actions platform outage (`startup_failure`, githubstatus.com incident); rerun when the outage is over (expect possible quirks in the db job).
2. **Mac mini: staging + prod Supabase stacks** — two Docker compose projects, **every published port bound to 127.0.0.1** (run `scripts/check-localhost-binding.sh` afterwards), staging stopped by default (RAM, §8). **GoTrue: `GOTRUE_DISABLE_SIGNUP=true`** — no self-signup; accounts are provisioned via admin API/Studio (matches `shouldCreateUser: false` in the app and `enable_signup = false` in local config).
3. **Mac mini: Cloudflare Tunnel** — `cloudflared` with `dash.<domain>` → prod, `staging.<domain>` → staging; staging behind Cloudflare Access; rate-limit rule on `/auth/*`. (ADR-0003; consider Access on prod too — §7 recommendation.)
4. **Mac mini: Ollama** — native install, `OLLAMA_HOST=127.0.0.1`, pull `bge-m3` + chat model sized to RAM (ADR-0006).
5. **Backups** — nightly `pg_dump` + Storage rsync via restic to an S3-compatible bucket, **pgsodium/Vault root key backed up separately**, Healthchecks.io pings, monthly restore drill onto staging (§7).
6. **GitHub Actions self-hosted runner** on the Mac mini (deploy only; hardened per §7) + deploy workflow (migrate → restart app/worker; staging on merge to main, prod on tag).
7. **Playwright** — add `@playwright/test` + screenshot baselines when the first Ladle stories exist (Phase 2); deliberately not installed yet.

## Phase 1 — Auth: ⬜ partially pre-done

- ✅ `profiles` schema + RLS + signup-trigger (see above). ✅ Supabase server client.
- ⬜ Remaining tickets: login/logout UI (plain, existing atoms only — ADR-0004), session middleware/refresh, profile settings (display_name, locale), **SMTP provider for magic links** (§7 — GoTrue config on the server), wire `i18n/request.ts` locale to `profiles.locale`.

## Phases 2–9: ⬜ not started — ticket per Architecture §10

No code exists for these beyond what's listed above. The worker skeleton and RLS/token/CI infrastructure they depend on is in place.

## Conventions locked in by this foundation (tickets must follow)

- New table ⇒ same PR contains: migration + `supabase/tests/rls-<table>.sql` (copy `rls-profiles.sql` pattern) — CI hard-fails otherwise.
- New table ⇒ migration must also `grant select, insert, update, delete on public.<table> to authenticated;` and `grant select on public.<table> to anon;` (RLS policies are the real boundary; without these grants every query 42501s with "permission denied for table", since `api.auto_expose_new_tables` is unset/off — discovered 2026-07-20 when CI's first real run failed on `rls-profiles.sql`). Copy the grants block in `20260720000001_profiles.sql`.
- New component ⇒ same PR contains: `design/figma-map.json` entry + `// figma: node-id=...` header + Ladle story.
- Token change ⇒ edit `design/tokens.json`, run `pnpm sync:tokens`, commit both (CI fails on drift).
- User-facing string ⇒ `messages/nl.json` **and** `messages/en.json` in the same PR.
- No `NEXT_PUBLIC_SUPABASE*` anywhere, ever (grep-enforced).
