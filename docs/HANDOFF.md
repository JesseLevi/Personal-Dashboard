# Handoff

State and next step only, one screen (≤ 6 KB, `check:doc-budget`). Replace stale bullets; never append history. Ticket status lives on the board, rules in `CLAUDE.md` and the guides, and the system in `Architecture.md`.

## State (2026-11-01)

- Atlas is in production use by real accounts. Phases 0–7 are built: account, Te doen, Recepten (incl. URL import, nutrition, USDA spices, sharing as a copy), Winkelmand (incl. shared baskets), Notities, Agenda.
- Delen fase 1 (#420) and Recept delen (#464) passed the user's two-account end-to-end test (2026-10-18).
- **Production** runs `1aa6917` (`deploy.yml` `target: both`, user's go, 2026-10-23): everything up to #589, incl. the agenda redesign, #584 (security headers), #587 (login rate limit, ADR-0045) and phase 8 wave 1. The user promotes production. `main` is ahead by phase 8 wave 2 (#592–#596), the 2026-10-24 security wave (#591–#602: import counter table, invitee profile after acceptance, magic-link confirm click, Actions on SHAs, ICS budget, note-image checks) and everything since.
- **Hosted DB**: every migration on `main` is applied, up to `20261026000002_assistant_patterns` (`migrate`, user's go, 2026-10-26: `…0001` agent_signals + rhythm detectors, `…0002` pattern signals). Production code does not call them until the promotion.
- **Panels (#569)**: every `SidePanel` slides again; quick-add sheet drags to close (`lib/dom/use-sheet-drag.ts`). Checked in Ladle only; check on a real iPhone: Settings, + Nieuw drag and bounce, #477's login glitch.
- `pnpm audit` is clean, dev dependencies included (#512, #554, #572). Dev-chain pins live in `pnpm-workspace.yaml` `overrides`.
- The visual gate now runs for `app/**/*.tsx` and `app/globals.css`. Scrollbars are hidden app-wide in `app/globals.css` (no gutter).
- Ladle (#613–#615): groups per module, `Overview` first (rules: `docs/guides/ui-components.md`, "Ladle").

## Next

0. **iPhone widget, epic #653** (ADR-0047, all merged 2026-10-30: #660–#664). Needs, in order: the user's go to `migrate` `20261030000001_widget_tokens` (until then `/api/widget/today` answers 503; watch that hosted accepts role `atlas_widget`), promotion, the "Open Atlas" iCloud link from #659 into `WIDGET_SHORTCUT_URL` (`lib/widget/install.ts`), then a device test of every family. Scriptable API names in `public/widget/atlas-widget.js` are checked against the docs, not yet on a device. Follow-up: `/agenda?date=` sets the date only on first mount, so a soft navigation while on `/agenda` does not jump.
0b. **⌘K command palette** (ADR-0048, merged 2026-11-01: #691, #699, #705) replaces `SearchPanel`: boards with progress (last column until #681's `is_done`), quick actions via `?nieuw=1`. Untested logged in (no local login): ⌘K/Escape/focus, Sidebar + drawer, each `?nieuw=1` (Notities creates an empty note), board rows, Settings, and the `board_columns.latest` embed in `lib/command/boards.ts` on real PostgREST. Projecten group: #695 (ADR-0053).
1. The user promotes `main` to production (`deploy.yml` `target: deploy`). Then check: `curl -I` for #584's headers; log in with password, with a code and via the mailed link (confirm screen); a URL import; a basket invite between two accounts; agenda with recurring events and categories against the real database.
2. Hosted checklist for the user (private-board draft; items in `docs/operations.md`). Claude has no Supabase or Vercel token locally. Deployment Protection is on (old build URLs: 302/410, 2026-10-25).
3. **Agenda redesign, epic #527** (ADR-0040–0042): merged (#529–#564). Checked only headless/Ladle; still to check on a real iPhone: sheet and tray animations, safe-area strip, `showPicker()`; in production: recurring-event panel, categories, quick add, agenda card panel (#560). Backlog: CalDAV import (#491).
4. **Phase 8, epic #31** (ADR-0043/0044): `bge-m3` on Cloudflare Workers AI, opt-in per member, hybrid search across all modules (⌘K palette), activity history of basket adds/checks and cooked meals. All merged (#585, #586, #588, #592, #594, #596, #603): lazy drain in `after()` from `(app)/layout.tsx` (RLS client, once per 10 min), cron `/api/cron/embeddings` 05:00 (`service_role`). Inert without `CLOUDFLARE_*` and opt-in. `profiles` has column grants: a new profile column needs its own grant. Next: rollout #574 (user's go per step).
5. **Phase 9, epic #32** (ADR-0046, decided 2026-10-26): rhythms for all, LLM patterns on opt-in, never a stuck-card reminder, no surface yet. Merged on 2026-10-26 with the user's go: #624 schema + rhythm detectors, #625 opt-in copy names Anthropic, #626 runtime (lazy `after()` + cron `/api/cron/assistant` 05:30 UTC), #627 read contract (`lib/assistant/signals.ts`, `actions.ts`), #628 pattern step (reserve-before-call budget, 3/day). Migrations on hosted. Next, #629: promotion makes rhythms run; patterns stay inert until #574 sets `CLOUDFLARE_*` and `ANTHROPIC_API_KEY` is set. Then the user decides where signals show up.

## Small open items

- Visual baseline `agenda--agenda-event-panel--overview` is flaky (~20 px); `account--settings-panel--overview` (light + dark) fails on `main` since 2026-11-01 and needs a regenerate.
- Hosted login hardening (`docs/operations.md`): minimum password length 12, leaked-password protection. Needs the user's go.
- Confirm `CRON_SECRET` is set in Vercel production; without it the cron backstops answer 401.
- `/login?error=magic-link-invalid` shows no message.
- Vandaag has no per-item links (planned cards carry no board id in `agenda_items()`).
- Drop the 5-argument `save_note_content` once no production code calls it (ADR-0056 §4).
- The Winkelmand clear-all confirm row wraps below ~370 px.

## Open product questions

- A basket member sees the owner's unnamed default basket as "Mijn mand", next to their own.
- Label colours (new column + token decision); archiving done cards (ADR-0050 option b); checking off offline (ADR-0054 option b).
- The rest live in `docs/open-questions.md`, by slug.
