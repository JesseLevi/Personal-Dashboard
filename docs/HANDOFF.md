# Handoff — start here in a new Claude Code session

`CLAUDE.md` = build rules and guide routing. This file = **state only**, one screen. History lives in `git log`, `docs/incidents.md` and `design/notes/<Component>.md`.

**Truth sources**: tickets → the board (`gh project item-list 1 --owner JesseLevi`); colours → `docs/design-tokens.md`; component↔node-id → `design/figma-map.json`; design gaps → `docs/open-questions.md`; infra per phase → `docs/phase-log.md`; per-component record → `design/notes/`.

**Keeping this file**: replace stale bullets, never append dated sections or per-ticket narrative. Anything that has a ticket lives on the ticket, not here. A fact about one component belongs in its note. Budget: ≤ 6KB.

## State (2026-10-06)

- `main` is green after #277. Per-ticket status lives on the board.
- Phases 0–3 done. Phases 4 (Recepten) and 5 (Boodschappenlijst) mid-flight per the board.
- Phase 6 (Notities) is code-complete (#225–#235, #263). Left: a **design round** (rendered table, prose typography, row/column controls — `notes-table-ui-not-designed`, `notes-prose-typography-not-designed`; plus #265's two undesigned values in `design/notes/ButtonToggle.md`, `Sidebar.md`). Treat that shipped CSS as provisional.
- Phase 7+ (Agenda, AI) is backlog. #1–#5, #9–#11 need real accounts: don't start unprompted.
- Tooling, test-gap, refactor and owed-ADR work is on the board as `[OPT]` tickets (#279–#295).

## Next

1. **#185** — first signed-in run against hosted Supabase; nothing has ever run authenticated (incl. the perf round's auth rewrite). Beyond the ticket, cover: a drag (`move_*` RPCs), `/notities` (empty board expected — seed triggers never fired for existing accounts, #293; "Categorie" creates one, no backfill), a real locale save, theme persisting, sign-out redirect, and dark mode by eye (checkbox border, sidebar overlay, SidePanel scrim).
2. **#279 before any `deploy.yml` run** (ledger version fix; needs the user's explicit go).
3. The `[OPT]` tickets, then Phase 4/5 remainder per the board.

## Traps that have already cost a session

- **Committing a migration does not apply it.** `deploy.yml` is `workflow_dispatch`-only and also promotes `main` to production (ADR-0012) — confirm with the user first. Check `supabase_migrations.schema_migrations` on hosted before debugging a data-shaped bug.
- **A migration applied by hand or via the Supabase MCP gets that route's timestamp as version**, not the filename; fix the ledger row or `db push` refuses.
- **Never batch a migration across parallel agents** (raced 250 duplicate rows on #161).
- **Two CI `db` jobs can't run concurrently** (fixed ports: `failed to bind host port`). Wait, then `gh run rerun <id> --failed`.
- **Visual flake**: run the FULL suite twice before believing a failure; never bisect, never overlap runs. Lone failures up to ~22px have been noise. `threshold` stays 0.
- **A green visual suite says nothing about hover/active, dark mode or `.tiptap` content** — none is rendered (#281–#283).
- **`middleware.ts` only refreshes tokens**; the auth redirect lives in `app/(app)/layout.tsx`. `getClaims()` verifies locally, so a revoked session lives until token expiry (deliberate, #168).
- **Verify a ticket's Figma nodes still exist**, and check which environment a recorded blocker was measured in, before planning around either.
- **iOS reads manifest/`appleWebApp` metadata only when an icon is added** — an old home-screen icon must be re-added.

## Constraints

- `public.recipe_unit` is the one unit enum — reuse, never redeclare.
- `lib/database.types.ts` is generated (CI gate) — never hand-edit. → `docs/guides/data-layer.md`
- NEVO: `NULL` = unknown, never `0`; licence line is mandatory (ADR-0013); partial volume↔mass coverage is by design (ADR-0014).

## Environment still to set up (outside this repo)

- **Mac mini (#1–#5)**: Docker + two Supabase stacks on 127.0.0.1 (`scripts/check-localhost-binding.sh`); `cloudflared` + Access; Ollama (`OLLAMA_HOST=127.0.0.1`, `bge-m3` + a chat model); hardened self-hosted runner; restic backups incl. Vault root key.
- **Accounts (free tier)**: Cloudflare; SMTP (Resend); Healthchecks.io; S3-compatible bucket (e.g. B2).
