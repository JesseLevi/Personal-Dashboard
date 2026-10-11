# Phase log — what is already built

Completion record against the phasing in `Architecture.md` §10 / ADR-0004. Update it whenever a phase item lands.

**Scope of this file**: infrastructure and decisions that are *not* obvious from reading the code. Per-ticket status lives on the GitHub Project board (`gh project item-list 1 --owner JesseLevi`), not here — don't duplicate it. The built-component inventory (which atoms/molecules/organisms exist, their Figma node-ids) belongs to `design/figma-map.json` (ADR-0010), not here — don't duplicate that either.

## Phase 0 — Foundation: ✅ complete in-repo (server-side remainder is ticketed)

Standard scaffold (Next.js 15 App Router, TS strict, Tailwind v4 via PostCSS, pnpm 11, Vitest, ESLint) is in the repo and self-evident from `package.json`. The parts worth knowing:

| Thing | Where | Why it matters |
|---|---|---|
| Token pipeline | `design/figma-variables/` (DTCG export, source) → `design/tokens.json` (curated mirror) → `scripts/generate-theme.mjs` → `app/theme.css` | `pnpm sync:tokens` after every token edit; CI fails on drift. Never hand-edit `theme.css`. Unit-tested in `tests/tokens.test.ts` |
| Token drift gate | `scripts/check-tokens-drift.mjs` (`pnpm check:tokens-drift`, in CI as of #203) | Diffs `design/tokens.json` against the `design/figma-variables/` export on name, `figmaVariableId` and value; only entries flagged `$pendingFigmaValue` may differ. Added once #203 established that `get_variable_defs` returns real Figma variable names (previously assumed hex-only, see `docs/decisions/0010-…md`) — semantic token names now follow their Figma path (`color/` stripped, trailing `/default` dropped) instead of being derived from measured colour |
| Figma↔code map | `design/figma-map.json` | Canonical per ADR-0010 — the component inventory, not `Architecture.md` §3.1 or this file. Records node-ids and Figma→code name translations; the per-component design notes and flagged discrepancies live in `design/notes/<Component>.md` |
| RLS harness | `supabase/tests/000-rls-enabled.sql`, `rls-profiles.sql` | pgTAP; `rls-profiles.sql` is the copy-me template for new tables |
| CI gates | `scripts/check-rls-coverage.sh`, `check-server-only.sh` | Coverage gate fails on a table without an RLS test; greps block service_role misplacement, `NEXT_PUBLIC_SUPABASE*`, `dangerouslySetInnerHTML`, and raw hex in `components/` (comments included) |
| Localhost-binding check | `scripts/check-localhost-binding.sh` | Shelved with the Mac mini (ADR-0018); not run anywhere |
| Supabase server client | `lib/supabase/server.ts` | `server-only`, cookie-based, deliberately no `NEXT_PUBLIC_` vars (ADR-0003) |
| Worker skeleton | `worker/index.ts` | Poll loop + backoff + heartbeat only. Calls `claim_next_job()`, a SQL function that **ships with the Phase 7 jobs migration (#31)** — the worker is incomplete by design; don't "fix" it earlier |
| CI pipeline | `.github/workflows/ci.yml` (app), `ci-visual.yml` (visual), `ci-db.yml` (db) | Split into three files (#259, was one `ci.yml` with three jobs) so each carries its own `paths:` filter — safe with no branch protection/rulesets on this Free-plan repo, since a `paths:`-skipped workflow can't leave a required check stuck pending. All three: `pull_request`-only (no `push: [main]` — a merge no longer re-runs the suite on the merge commit) + `workflow_dispatch` + `concurrency: cancel-in-progress`. `app` no longer runs `pnpm build` (Vercel already builds every push as a Preview and reports it as a commit status; `pnpm typecheck` remains the TS gate). Projected ≈720 min/month against the 2000 limit, down from ≈4150 projected pre-#259. |

### ⬜ Phase 0 remainder — all server-side, ticketed as #1–#6

> **Mac-mini items #1–#5 are shelved (ADR-0018)**: the platform stays on Vercel + Supabase Cloud. Of the text below only the non-Mac-mini items still apply.

Mac mini Supabase stacks (#1, incl. `GOTRUE_DISABLE_SIGNUP=true` — no self-signup; matches `shouldCreateUser: false` in the app), Cloudflare Tunnel + Access (#2), Ollama (#3), restic backups incl. **separately backed-up Vault root key** (#4), hardened self-hosted runner + deploy workflow (#5), Playwright screenshot baselines (#6).

## Phase 1 — Auth: ✅ merged to `main`

`profiles` schema + RLS + signup trigger, Supabase server client, login/logout UI with magic link (#7). Self-signup is disabled end to end. Remaining as separate tickets: session middleware/refresh (#8), profile settings (#9), SMTP provider (#10), wire `i18n/request.ts` to `profiles.locale` (#11).

## Phase 2 — Design system core: 🔶 in progress (all atoms/molecules/organisms built; milestone has non-component work open)

Every atom, molecule, and organism in the Phase 2 milestone has a merged implementation, a filled-in `nodeId` in `design/figma-map.json`, and a Ladle story — see that file for the current inventory, not this section. The milestone's tickets stay open until the user reviews and closes them (per the board workflow in `CLAUDE.md`), so `gh issue list --milestone "Phase 2 — Design system core" --state open` still lists them; that is a review-queue state, not unbuilt work.

**#49 — Ladle chrome theming survives `pnpm ladle:build`**: `appendToHead` (@ladle/react's own `transformIndexHtml` hook) runs at "normal" priority, which Vite's build-time HTML handling only stamps into the final HTML as an inert string — it never scans it for `<link>`/`<script>` tags to bundle, which is why the dev-only `/@fs/<absolute path>` href it emitted 404'd in the built output. Fixed by registering the same `<link>` through a real Vite plugin instead: `.ladle/config.mjs` points `viteConfig` at `.ladle/vite.config.mjs`, whose plugin injects the tag via a `pre`-order `transformIndexHtml` hook — Vite scans "pre"-order output *before* deciding what to bundle, so the stylesheet goes through the normal CSS pipeline (Tailwind processing intact) and comes out fingerprinted in `build/assets/`, with no machine-specific path anywhere in the build. Dev (`pnpm ladle`) is unaffected — same `/@fs/` request, just now sourced from the plugin instead of `appendToHead`.

Conventions the design-system components locked in are in `docs/guides/ui-components.md` → "Component code conventions" — they exist because parallel agent work diverged on each point.

## Phase 3 — Te-Doen (Kanban): ✅ feature-complete, merged to `main`

Schema (`boards`/`board_columns`/`cards`/`labels`/`card_labels`), server actions, `BoardView` (dnd-kit drag & drop), `SidePanel`, the app-shell route group, and the `/te-doen` + `/te-doen/[boardId]` pages are built and merged (#87–#98). No Phase 3 database path has ever run against a live Supabase — see `docs/HANDOFF.md` for the verification gaps.

## Phase 4 — Recepten: 🔶 in progress

Merged so far: the unit library (#120 — `lib/recipes/units.ts`, the canonical 17-code list plus same-magnitude `convert()`/`scaleQuantity()`/`formatQuantity()`), the two-layer ingredient library and the `reference` schema (#130, `ADR-0011`), the recipe schema (#119 — `recipe_categories`/`recipes`/`recipe_ingredients`/`recipe_steps`, sharing the `public.recipe_unit` enum), the data layer (#122 — `lib/recipes/queries.ts` + `app/(app)/recepten/actions.ts`), the portion-stepper molecule (#123), the `/recepten` category-kanban page (#124 — `ReceptenBoard.tsx` driving the generic `BoardView`), the category add/rename/delete panel (#125 — `CategoryPanel.tsx`, 8-icon curated picker), and the ingredient search panel (#131 — `components/organisms/IngredientSearchPanel.tsx` + the `searchIngredients` action; `CardContentIngredient` gained optional `quantity`/`divider`).

Still open: #121 (thumbnails bucket, parallel), then #126/#127 → #128. `recipes` has no `position` column by design, so the overview ships with dragging disabled — see `docs/HANDOFF.md`. `IngredientSearchPanel` exists but has no caller until #126 wires it to the ingredient name field.

## R2 object storage (epic #359, ADR-0024): ✅ live; #384 migration pending deploy

Merged: the `lib/storage/` seam (#361), the delivery helper (#362), recipe thumbnails on R2 (#363), the note-image backend (#338; UI is #339), and docs and the backup decision (Option B: no off-site sync, #365). The hosted setup is done and the one-time backfill ran (13 recipes, 28 objects); production holds only R2 stems. #384 removes the Supabase thumbnail bucket, its policies, the read fallback and the backfill scripts; its migration (`20261011000001`) takes effect only after a user-dispatched `deploy.yml` (target `migrate` or `both`).

## R2 setup checklist (#360, ADR-0024 §6) — user runs these, hosted actions

1. Cloudflare dashboard -> R2: create two buckets, `<app>-production` and `<app>-development`. Leave "r2.dev subdomain" disabled and attach no custom domain.
2. Per bucket -> Settings -> Object lifecycle rules: add "Abort incomplete multipart uploads" after 1 day.
3. Per bucket: no CORS policy (the browser never talks to R2).
4. R2 -> Manage API tokens: create one token per bucket, permission *Object Read & Write*, "Apply to specific buckets only" = that bucket. Note the Access Key ID + Secret.
5. Local `.env`: check the existing `R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY` token is scoped to the development bucket only; if it is account-wide, replace it. Set `R2_ACCOUNT_ID` and `R2_BUCKET_NAME` (development bucket).
6. Vercel -> Settings -> Environment Variables (all four `R2_*`, no `NEXT_PUBLIC_` prefix, mark secrets Sensitive): Production = production bucket + its token; Preview = development bucket + its token.
7. Verify (dry run first, then add `--apply`), once per bucket with that bucket's token in env:
   `pnpm exec tsx --env-file=.env scripts/verify-r2-buckets.ts --bucket <own> --other <other> [--apply]`
   Expect: anonymous GETs non-2xx, PUT to the other bucket 403, PUT+DELETE in own bucket OK.

## Phases 5–9: ⬜ not started

One tracking ticket per phase (#29–33), all still in Backlog with no implementation work. Ticket detail per `Architecture.md` §10. The token/RLS/CI infrastructure and the worker skeleton they depend on are in place.
