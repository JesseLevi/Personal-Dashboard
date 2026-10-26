# Handoff

State and next step only, one screen (≤ 6 KB, `check:doc-budget`). Replace stale bullets; never append history. Ticket status lives on the board, rules in `CLAUDE.md` and the guides, and the system in `Architecture.md`.

## State (2026-10-26)

- Atlas is in production use by real accounts. Phases 0–7 are built: account, Te doen, Recepten (incl. URL import, nutrition, USDA spices, sharing as a copy), Winkelmand (incl. shared baskets), Notities, Agenda.
- Delen fase 1 (#420) and Recept delen (#464) passed the user's two-account end-to-end test (2026-10-18).
- **Production** runs `1aa6917` (`deploy.yml` `target: both`, user's go, 2026-10-23): everything up to #589, incl. the agenda redesign, #584 (security headers), #587 (login rate limit, ADR-0045) and phase 8 wave 1. The user promotes production. `main` is ahead by phase 8 wave 2 (#592, #594, #596) and the security wave of 2026-10-24: #591 (import counter in its own table), #593 (a pending invitee's profile reaches the inviter only after acceptance; limits on invites), #595 (magic link signs in only after a confirm click), #598, then #600 (Actions on commit SHAs, exact Vercel CLI, Dependabot for Actions), #601 (calendar-sync cron: failing feeds queue last; ICS budget of 150k iteration steps) and #602 (note-image `src` check, R2 key check, pixel limit on note images, anon off `reference`).
- **Hosted DB**: every migration on `main` is applied, up to `20261026000002_assistant_patterns` (`migrate`, user's go, 2026-10-26: `…0001` agent_signals + rhythm detectors, `…0002` pattern signals). Production code does not call them until the promotion.
- **Panels (#569, 2026-10-20)**: every `SidePanel` slides in and out again (broken since #477). The quick-add sheet's handle drags to close through the shared `lib/dom/use-sheet-drag.ts`. Bottom sheets open with a 10px bounce. Checked in Ladle only; still to check on a real iPhone and in the signed-in app: Settings, + Nieuw drag and bounce, and that #477's login glitch stays gone.
- `pnpm audit` is clean, dev dependencies included (#512, #554, #572). Dev-chain pins live in `pnpm-workspace.yaml` `overrides`.
- The visual gate now runs for `app/**/*.tsx` and `app/globals.css`. Scrollbars are hidden app-wide in `app/globals.css` (no gutter).

## Next

1. The user promotes `main` to production (`deploy.yml` `target: deploy`). Then check: `curl -I` for #584's headers; log in with password, with a code and via the mailed link (confirm screen); a URL import; a basket invite between two accounts; agenda with recurring events and categories against the real database.
2. Hosted checklist for the user (private-board draft; items in `docs/operations.md`). Claude has no Supabase or Vercel token locally. Deployment Protection is on (old build URLs: 302/410, 2026-10-25).
3. **Agenda redesign, epic #527** (ADR-0040–0042, user decisions of 2026-10-18): Built and merged (#529–#534, feedback rounds up to #553). Checked only in headless Chromium or Ladle so far; still to check on a real iPhone/browser: the sheet and tray animations, the safe-area strip, `showPicker()` on click. Not yet checked end to end in production: recurring-event panel, categories, quick add. A planned card or deadline now opens an agenda card panel instead of the card (#560): **Uit agenda** or **Deadline wissen**, and the card is one click away. A planned recipe's moment starts on its recipe category (Ontbijt, Lunch, Avond; nl/en name words, else Diner) and stays editable (#562 via #564). The agenda skeleton is an empty grid; the real items fade in once on load. Backlog: CalDAV import (#491).
4. **Phase 8, epic #31** (ADR-0043/0044): `bge-m3` on Cloudflare Workers AI, opt-in per member, hybrid search across all modules (⌘K panel), activity history of basket adds/checks and cooked meals. All merged (#585, #586, #588, #592, #594, #596, #603): lazy drain in `after()` from `(app)/layout.tsx` (RLS client, once per 10 min), cron `/api/cron/embeddings` 05:00 (`service_role`). Inert without `CLOUDFLARE_*` and opt-in. `profiles` has column grants: a new profile column needs its own grant. #580's semantic rate limit is in memory per instance; events link to `/agenda` with a `date` (no deep link). Next: rollout #574 (user's go per step).
5. **Phase 9, epic #32** (ADR-0046, decided 2026-10-26): rhythms for all, LLM patterns on opt-in, never a stuck-card reminder, no surface yet. Merged on 2026-10-26 with the user's go: #624 schema + rhythm detectors, #625 opt-in copy names Anthropic, #626 runtime (lazy `after()` + cron `/api/cron/assistant` 05:30 UTC), #627 read contract (`lib/assistant/signals.ts`, `actions.ts`), #628 pattern step (reserve-before-call budget, 3/day). Migrations on hosted. Next, #629: promotion makes rhythms run; patterns stay inert until #574 sets `CLOUDFLARE_*` and `ANTHROPIC_API_KEY` is set. Then the user decides where signals show up.

## Small open items

- Hosted login hardening (`docs/operations.md`): minimum password length 12, leaked-password protection. Needs the user's go.
- Confirm `CRON_SECRET` is set in Vercel production. Without it the daily calendar-sync backstop answers 401; lazy sync still works (`docs/operations.md`).
- `/login?error=magic-link-invalid` shows no message: `/login` does not read `error`.
- `design/notes/LoginForm.md` should be condensed to the contract shape (#411 is merged).
- The Winkelmand clear-all confirm row wraps to two lines below ~370 px (`DeleteConfirm` idiom); it fits at 390 px.
- After promotion, check a note with a code block: TipTap 3.32 changed how node views render without `EditorContent` (#520).

## Open product questions

- A basket member sees the owner's unnamed default basket as "Mijn mand", next to their own.
- HEIC upload fails cleanly when `sharp` lacks a HEVC decoder.
- The rest live in `docs/open-questions.md`, by slug.
