# Phase log — what is already built

Completion record against the phasing in `Architecture.md` §10 / ADR-0004. Update it whenever a phase item lands.

**Scope of this file**: infrastructure and decisions that are *not* obvious from reading the code. Per-ticket status lives on the GitHub Project board (`gh project item-list 1 --owner JesseLevi`), not here — don't duplicate it. The built-component inventory (which atoms/molecules/organisms exist, their Figma node-ids) belongs to `design/figma-map.json` (ADR-0010), not here — don't duplicate that either.

## Phase 0 — Foundation: ✅ complete in-repo (server-side remainder is ticketed)

Standard scaffold (Next.js 15 App Router, TS strict, Tailwind v4 via PostCSS, pnpm 11, Vitest, ESLint) is in the repo and self-evident from `package.json`. The parts worth knowing:

| Thing | Where | Why it matters |
|---|---|---|
| Token pipeline | `design/tokens.json` → `scripts/generate-theme.mjs` → `app/theme.css` | `pnpm sync:tokens` after every token edit; CI fails on drift. Never hand-edit `theme.css`. Unit-tested in `tests/tokens.test.ts` |
| Figma↔code map | `design/figma-map.json` | Canonical per ADR-0010 — the component inventory, not `Architecture.md` §3.1 or this file. Records node-ids and Figma→code name translations; the per-component design notes and flagged discrepancies live in `design/notes/<Component>.md` |
| RLS harness | `supabase/tests/000-rls-enabled.sql`, `rls-profiles.sql` | pgTAP; `rls-profiles.sql` is the copy-me template for new tables |
| CI gates | `scripts/check-rls-coverage.sh`, `check-server-only.sh` | Coverage gate fails on a table without an RLS test; greps block service_role misplacement, `NEXT_PUBLIC_SUPABASE*`, `dangerouslySetInnerHTML`, and raw hex in `components/` (comments included) |
| Localhost-binding check | `scripts/check-localhost-binding.sh` | Run **on the server**, not here; wire into the deploy workflow |
| Supabase server client | `lib/supabase/server.ts` | `server-only`, cookie-based, deliberately no `NEXT_PUBLIC_` vars (ADR-0003) |
| Worker skeleton | `worker/index.ts` | Poll loop + backoff + heartbeat only. Calls `claim_next_job()`, a SQL function that **ships with the Phase 7 jobs migration (#31)** — the worker is incomplete by design; don't "fix" it earlier |
| CI pipeline | `.github/workflows/ci.yml` | app job + db job (supabase start, pgTAP, coverage gate). Both verified green 2026-07-20 |

### ⬜ Phase 0 remainder — all server-side, ticketed as #1–#6

Mac mini Supabase stacks (#1, incl. `GOTRUE_DISABLE_SIGNUP=true` — no self-signup; matches `shouldCreateUser: false` in the app), Cloudflare Tunnel + Access (#2), Ollama (#3), restic backups incl. **separately backed-up Vault root key** (#4), hardened self-hosted runner + deploy workflow (#5), Playwright screenshot baselines (#6).

## Phase 1 — Auth: ✅ merged to `main`

`profiles` schema + RLS + signup trigger, Supabase server client, login/logout UI with magic link (#7). Self-signup is disabled end to end. Remaining as separate tickets: session middleware/refresh (#8), profile settings (#9), SMTP provider (#10), wire `i18n/request.ts` to `profiles.locale` (#11).

## Phase 2 — Design system core: 🔶 in progress (all atoms/molecules/organisms built; milestone has non-component work open)

Every atom, molecule, and organism in the Phase 2 milestone has a merged implementation, a filled-in `nodeId` in `design/figma-map.json`, and a Ladle story — see that file for the current inventory, not this section. The milestone's tickets stay open until the user reviews and closes them (per the board workflow in `CLAUDE.md`), so `gh issue list --milestone "Phase 2 — Design system core" --state open` still lists them; that is a review-queue state, not unbuilt work.

Genuinely open (non-component) work in the Phase 2 milestone:
- **#49** — Ladle chrome theming (`appendToHead`) emits a dev-only `/@fs/` path that 404s in `pnpm ladle:build`; not started.

Conventions the design-system components locked in are in `docs/guides/ui-components.md` → "Component code conventions" — they exist because parallel agent work diverged on each point.

## Phase 3 — Te-Doen (Kanban): ✅ feature-complete, merged to `main`

Schema (`boards`/`board_columns`/`cards`/`labels`/`card_labels`), server actions, `BoardView` (dnd-kit drag & drop), `SidePanel`, the app-shell route group, and the `/te-doen` + `/te-doen/[boardId]` pages are built and merged (#87–#98). No Phase 3 database path has ever run against a live Supabase — see `docs/HANDOFF.md` for the verification gaps.

## Phases 4–9: ⬜ not started

One tracking ticket per phase (#28–33), all still in Backlog with no implementation work. Ticket detail per `Architecture.md` §10. The token/RLS/CI infrastructure and the worker skeleton they depend on are in place.
