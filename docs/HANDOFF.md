# Handoff — start here in a new Claude Code session

`CLAUDE.md` is auto-loaded (build rules, non-negotiables, which guide to read per task). **This file is state only**: where the project stands and what is still unverified. History belongs in `git log`, `docs/incidents.md` (defect write-ups) and `design/notes/<Component>.md` (per-component design record) — never restate it here.

**Sources of truth that are not this file:** ticket status → the board (`gh project item-list 1 --owner JesseLevi`); state colours → `docs/design-tokens.md`; component ↔ node-id → `design/figma-map.json`; open design gaps → `docs/open-questions.md`; what infrastructure exists per phase → `docs/phase-log.md`.

**Keeping this file:** it is read at every session start, so it stays around one screen. When a bullet becomes history rather than state, delete it — don't append a new dated section under it.

## Where the project stands (2026-07-25)

- `main` is green and current. **Phase 0** (foundation), **Phase 1** (login/logout), **Phase 2** (all atoms/molecules/organisms + the token pipeline) and **Phase 3** (Te-Doen kanban, #87–#98) are merged, as is design-review round 1 (#99–#105). `/te-doen` and `/te-doen/[boardId]` are real pages with a board switcher, favourite toggle, sort, card detail panel, and drag persistence with optimistic update + rollback.
- Gates verified on the current `main` by hand, not by agent report: `lint` (0 errors, 2 pre-existing warnings), `typecheck`, 83 unit tests, `pnpm build` (both `/te-doen` routes dynamic, 165 kB), `check:server-only`, `check:comment-budget`, no token drift, `nl.json`/`en.json` identical at 78 keys, `test:visual` 59/59.
- Awaiting the user's review: #89, #93–#96, #99–#105. Backlog holds the server-side tickets (#1–#5, #8–#11), Phase 4+ (#27–#33), #49 and #106.
- Missing by design: **`middleware.ts` does not exist.** Session refresh is #8; the auth guard lives in `app/(app)/layout.tsx` until then.

## Nothing below has run for real

There is no Docker on this dev machine, so **no Phase 3 database path has ever executed against a live Supabase**, and #96's acceptance was never exercised in a real browser. Close these before trusting the board in production.

- **Live Supabase, never run:** `createBoard`'s default-column seed; `/te-doen/[boardId]`'s RLS-filtered fetch; `toggleBoardFavorite`'s exactly-one-favourite behaviour; `getBoardWithColumns`'s nested PostgREST select and `moveCard`'s `board_columns!inner(board_id)` embed (both reasoned against the installed postgrest-js API only, never executed); the `service_role` GRANT migration `20260724210000_grant_service_role_kanban.sql`.
- **`lib/database.types.ts` is hand-written** — its own header says so. CI must regenerate it via `pnpm db:types` and diff the result.
- **Real browser, never run:** the entire #96 drag-persist acceptance — a drag surviving a hard refresh, keyboard-move persisting like mouse, rollback against a genuinely failed request, and two quick drags under real latency. Also `TeDoenHeader`'s sort and board-switcher dropdowns: they call `useRouter()`, which throws under Ladle's plain Vite runtime, and `/te-doen` needs a real Supabase session. The identical `Dropdown` code path *was* verified through the `Dropdown`/`CardDetailPanel` stories; the sort menu in situ was not.
- **`toggleBoardFavorite` is not transactional.** It clears the old favourite and sets the new one in two sequential statements — a failure between them transiently leaves zero favourites (never two; the partial unique index blocks that), self-healing on the next toggle.
- **The visual gate protects local runs only.** All 58 committed baselines are `-darwin.png` from this Mac and there are zero `-linux.png`, so CI's `visual` job is `continue-on-error: true` and cannot fail the build. Close it by generating Linux baselines inside the pinned `mcr.microsoft.com/playwright` container (a `workflow_dispatch` job whose output a human commits), then remove `continue-on-error`.
- **#106 (Backlog): the two `card-detail-panel` baselines are sliver crops that cover essentially nothing.** Proven, not suspected — #100 added a visible chevron and #103 made the footer full-width in exactly those stories, and both baselines still passed byte-identical. Until #106 lands, treat the zero-tolerance suite as a *silent* gate on the app's highest-traffic panel. #106 must prove the regenerated baselines actually fail on a deliberate small change, not merely that the crop got bigger.

## Next actions

1. **Close the verification gaps above** on CI / the Mac mini. This is the real remaining Phase 3 work — there is no missing UI.
2. **The ADR for `cards.size` and `boards.is_favorite` is still unwritten.** Both are user-approved deviations from `Architecture.md` §4.2. Writing it is the architecture layer's job, not Claude Code's — flag it, don't improvise one mid-ticket.
3. **Phase 4 (Recepten, #28)** is the natural next feature. It was deliberately built to reuse the Te-Doen board environment — both pages share the identical Sidebar → Main → Header → Carousel → CardContainer → Card envelope and differ only in the leaf `Card-content/*` molecule — so it needs zero new atoms. Rationale and dependency order: the breakdown comment on #27.
4. **#49** (Ladle chrome theming: `appendToHead` emits a dev-only `/@fs/` path that 404s in `pnpm ladle:build`) is the last open non-component Phase 2 item.
5. **#1–#5 and #8–#11** are server-side or need real user accounts — coordinate with the user, don't start them unprompted.

## Environment still to set up (outside this repo)

**Mac mini (#1–#5):** Docker + two Supabase stacks (bound to 127.0.0.1, verify with `scripts/check-localhost-binding.sh`), `cloudflared` + Cloudflare Access, Ollama (`OLLAMA_HOST=127.0.0.1`, `bge-m3` + a chat model sized to RAM), a hardened self-hosted runner, restic backups including a separately backed-up Vault root key.

**Accounts (all free tier):** Cloudflare, an SMTP provider (Resend — magic links need it), Healthchecks.io, an S3-compatible bucket (e.g. Backblaze B2).
