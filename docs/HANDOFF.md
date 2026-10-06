# Handoff — start here in a new Claude Code session

`CLAUDE.md` = build rules and guide routing. This file = **state only**, one screen. History lives in `git log`, `docs/incidents.md` and `design/notes/<Component>.md`.

**Truth sources**: tickets → the board (`gh project item-list 1 --owner JesseLevi`); colours → `docs/design-tokens.md`; component↔node-id → `design/figma-map.json`; design gaps → `docs/open-questions.md`; infra per phase → `docs/phase-log.md`; per-component record → `design/notes/`.

**Keeping this file**: replace stale bullets, never append dated sections or per-ticket narrative. A fact about one component belongs in that component's note; a durable rule in a guide. Hard budget: ≤ 6KB.

## State (2026-08-18)

- `main` is green after #277. Per-ticket status lives on the board, never here.
- Phases 0–3 are done. Phases 4 (Recepten) and 5 (Boodschappenlijst) are mid-flight per the board.
- Phase 6 (Notities) is code-complete (#225–#235, #263). What remains is a design round (rendered table, prose typography, row/column controls: `notes-table-ui-not-designed`, `notes-prose-typography-not-designed`) and a signed-in visit to `/notities`.
- Phase 7+ (Agenda, AI pipeline/agent) is backlog. Server-side tickets #1–#5, #9–#11 need real accounts: don't start unprompted.
- Open `[OPT]` tickets (tooling, test gaps, refactors, owed ADRs) are on the board: search for `[OPT]`.

## Pending hosted actions

- Migration-ledger version fix for `profiles_avatar_url` (applied via the Supabase MCP, so the ledger row has the wrong version): see the `[OPT]` ticket. Must be done before the next `deploy.yml` run, and only with the user's explicit go.

## Next

1. **#185 signed-in run** (nothing has ever run authenticated against live Supabase). Cover: a drag/move (the `move_*` RPCs), `/notities` (an empty board is expected: seed triggers never fired for the 2 pre-existing accounts; the "Categorie" button creates one; no backfill), a real locale save (re-renders the whole tree), the theme toggle persisting, and dark mode by eye: checkbox border, sidebar overlay, SidePanel scrim.
2. The `[OPT]` tickets.
3. Phase 4/5 remainder, per the board.
4. Design round for Phase 6 (see State). Treat the shipped table/prose CSS as provisional until then.

## Unverified against reality

The hosted schema was audited 2026-08-13: RLS on every table, `move_*`/`replace_recipe_contents` are `security invoker` with `search_path=''`, ledger matches the repo. What is untested is **behaviour**.

- **#185** — no authenticated run against live Supabase; queries, actions and storage cleanup are reasoned-only. Includes the perf round (#168–#170, #173), which rewrote the auth path.
- **#186** — drag persistence (#96) and drop-hover (#114) never run in a real browser.
- **#187** — iOS Safari viewport fixes (#113), 750ms touch-hold (#118), hidden scrollbar (#110) never run on hardware.
- **#188** — visual gate is macOS-only (no `-linux.png`), so CI's `visual` job is `continue-on-error`.
- **#189** — Supabase advisors: 11 WARN; five `security definer` functions callable by `anon` and `authenticated` (`handle_new_user`, `rls_auto_enable`, `seed_default_*` ×3), plus leaked-password protection off. Every new seed function adds two more.
- **#191** — `BoardPanel.tsx` has no Ladle story.
- **Gate blind spots**: no baseline renders hover/active states, dark mode, or `.tiptap` content, so a green suite says nothing about them → `[OPT]` tickets.
- **Settings surface (#265)**: account dropdown and panel exercised once; locale save and the sign-out *redirect* are not. Two undesigned values flagged: `ButtonToggle`'s `ActiveBackground` (stand-in `surface-secondary`) and the account row's hover fill → `design/notes/ButtonToggle.md`, `Sidebar.md`.
- **Production promotion is manual** (ADR-0012): `workflow_dispatch` of `deploy.yml` or `vercel promote`. Migration rules → `docs/guides/data-layer.md`.

## Environment still to set up (outside this repo)

- **Mac mini (#1–#5)**: Docker plus two Supabase stacks on 127.0.0.1 (`scripts/check-localhost-binding.sh`); `cloudflared` + Cloudflare Access; Ollama (`OLLAMA_HOST=127.0.0.1`, `bge-m3` plus a chat model sized to RAM); a hardened self-hosted runner; restic backups incl. a separately-backed-up Vault root key.
- **Accounts (free tier)**: Cloudflare; SMTP (Resend, magic links); Healthchecks.io; an S3-compatible bucket (e.g. Backblaze B2).
- **Any new dev machine**: `gh` authenticated with `project` scope; the `figma-console` bridge (Figma Desktop + Desktop Bridge plugin); `.mcp.json` and `.env` (see `.env.example`).
