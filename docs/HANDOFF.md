# Handoff — start here in a new Claude Code session

`CLAUDE.md` = build rules and guide routing. This file = **state only**, one screen. History lives in `git log`, `docs/incidents.md` and `design/notes/<Component>.md`.

**Truth sources**: tickets → the board (`gh project item-list 1 --owner JesseLevi`); colours → `docs/design-tokens.md`; component↔node-id → `design/figma-map.json`; design gaps → `docs/open-questions.md`; infra per phase → `docs/phase-log.md`; per-component record → `design/notes/`.

**Keeping this file**: replace stale bullets, never append dated sections or per-ticket narrative. Anything that has a ticket lives on the ticket, not here. A fact about one component belongs in its note. Budget: ≤ 6KB.

## State (2026-10-06)

- `main` is green after #277. Per-ticket status lives on the board.
- Phases 0–3 done. Phases 4 (Recepten) and 5 (Boodschappenlijst) mid-flight per the board.
- Phase 6 (Notities) is code-complete (#225–#235, #263). **Editor round planned** (epic #328, tickets #329–#342, ADR-0021/0022/0023): UI is Claude-designed on request, executed one ticket at a time in the epic's order; it closes `notes-prose-typography-not-designed` (done, #329) and `notes-table-ui-not-designed` (done, #330).
- Phase 7+ (Agenda, AI) is backlog. #9–#11 need real accounts: don't start unprompted.
- **Mac mini/Ollama is shelved (ADR-0018)**: Vercel + Supabase Cloud is the target, and AI goes through hosted APIs behind `lib/ai/`. #1–#5 are obsolete.
- **#309 (recipe via URL)**: pipeline (#313–#317) and UI (#318, in review) are built. Follow-up on branch `fix/309-import-nevo-linking`: LLM search terms + best-fit NEVO choice, imported amounts kept with an estimated weight per unit stored as the user's override, translation into the user's locale, Haiku 5.5, add menu portalled (ADR-0019 §3/§4 amended). Nutrition now sums the recognised rows, with a counted/total line and "niet meegeteld" markers; the edit panel shows each row's NEVO link. Prompts are untested against the live model. Before it works on hosted: dispatch `deploy.yml` with the #312 migrations (user decision), set `ANTHROPIC_API_KEY`. `icon--all-icons` baseline needs regenerating (Globe added). Not yet exercised against a live deploy: `after()` keeping the session (checked in Next source only).
- **R2 object storage (epic #359, ADR-0024)**: live in production, thumbnails served from R2. #384 (drop the Supabase thumbnail bucket and fallback) is in review; its migration only applies after the user dispatches `deploy.yml` (target `migrate` or `both`).

## Next

1. **#185** — first signed-in run against hosted Supabase; nothing has ever run authenticated (incl. the perf round's auth rewrite). Beyond the ticket, cover: a drag (`move_*` RPCs), `/notities` (after the next deploy, `ensure_user_defaults()` seeds missing defaults once on first load — #293/ADR-0017; one refresh may be needed), a real locale save, theme persisting, sign-out redirect, and dark mode by eye (checkbox border, sidebar overlay, SidePanel scrim).
2. **#279 before any `deploy.yml` run** (ledger version fix), and **#291** (reference-schema exposure) — both hosted writes the user must run or explicitly authorise per action. The next deploy also ships #293's migration; afterwards `pnpm db:types` and drop the cast in `lib/defaults/ensure.ts`.
3. Phase 4/5 remainder per the board.

## Traps that have already cost a session

- **Committing a migration does not apply it.** `deploy.yml` is `workflow_dispatch`-only and also promotes `main` to production (ADR-0012) — confirm with the user first. Check `supabase_migrations.schema_migrations` on hosted before debugging a data-shaped bug.
- **A migration applied by hand or via the Supabase MCP gets that route's timestamp as version**, not the filename; fix the ledger row or `db push` refuses.
- **Never batch a migration across parallel agents** (raced 250 duplicate rows on #161).
- **Two CI `db` jobs can't run concurrently** (fixed ports: `failed to bind host port`). Wait, then `gh run rerun <id> --failed`.
- **Visual gate**: CI Linux job is blocking; `-linux.png` baselines are produced only by the `visual-update` workflow (`gh workflow run visual-update.yml --ref <branch>`, then run `ci-visual.yml` by hand: a GITHUB_TOKEN push triggers no CI). `-darwin.png` is git-ignored and drifts, so ignore local mismatches. `threshold` stays 0.
- **Parallel agents share Playwright port 4310** (`reuseExistingServer`): one agent silently screenshots another's server. Serialize visual runs (lock dir) when delegating.
- **The visual suite renders Button hover/active/focus (#282), a dark subset (#281) and `.tiptap` prose (#283)** — other components' states and dark variants are still unseen.
- **`middleware.ts` only refreshes tokens**; the auth redirect lives in `app/(app)/layout.tsx`. `getClaims()` verifies locally, so a revoked session lives until token expiry (deliberate, #168).
- **Verify a ticket's Figma nodes still exist**, and check which environment a recorded blocker was measured in, before planning around either.
- **iOS reads manifest/`appleWebApp` metadata only when an icon is added** — an old home-screen icon must be re-added.

## Constraints

- `public.recipe_unit` is the one unit enum — reuse, never redeclare.
- `lib/database.types.ts` is generated (CI gate) — never hand-edit. → `docs/guides/data-layer.md`
- NEVO: `NULL` = unknown, never `0`; licence line is mandatory (ADR-0013); partial volume↔mass coverage is by design (ADR-0014).

## Environment still to set up (outside this repo)

- **Anthropic API key** in Vercel env (`ANTHROPIC_API_KEY`) plus a monthly spend cap in the Console. Needed before #309's LLM step reaches production.
- **SMTP (Resend, free tier)** for magic links.
