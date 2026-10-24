# Handoff

State and next step only, one screen (≤ 6 KB, `check:doc-budget`). Replace stale bullets; never append history. Ticket status lives on the board, rules in `CLAUDE.md` and the guides, and the system in `Architecture.md`.

## State (2026-10-24)

- Atlas is in production use by real accounts. Phases 0–7 are built: account, Te doen, Recepten (incl. URL import, nutrition, USDA spices, sharing as a copy), Winkelmand (incl. shared baskets), Notities, Agenda.
- Delen fase 1 (#420) and Recept delen (#464) passed the user's two-account end-to-end test (2026-10-18).
- **Production** runs `1aa6917` (`deploy.yml` `target: both`, user's go, 2026-10-23): everything up to #589, incl. the agenda redesign, #584 (security headers), #587 (login rate limit, ADR-0045) and phase 8 wave 1. The user promotes production. `main` is ahead by phase 8 wave 2 (#592, #594, #596) and the security wave of 2026-10-24: #591 (import counter in its own table), #593 (a pending invitee's profile reaches the inviter only after acceptance; limits on invites), #595 (magic link signs in only after a confirm click), #598, then #600 (Actions on commit SHAs, exact Vercel CLI, Dependabot for Actions), #601 (calendar-sync cron: failing feeds queue last; ICS budget of 150k iteration steps) and #602 (note-image `src` check, R2 key check, pixel limit on note images, anon off `reference`).
- **Hosted DB**: every migration on `main` is applied, up to `20261024000004_reference_revoke_anon` (`migrate`, user's go, 2026-10-24: `…0001` activity_events, `…0002` shares visibility, `…0003` import counter, `…0004` anon loses `reference`; checked: anon gets 42501). Production code runs against it until the promotion: a pending invitee shows as unnamed, and a hit invite limit shows a generic error.
- **Panels (#569, 2026-10-20)**: every `SidePanel` slides in and out again (broken since #477). The quick-add sheet's handle drags to close through the shared `lib/dom/use-sheet-drag.ts`. Bottom sheets open with a 10px bounce. Checked in Ladle only; still to check on a real iPhone and in the signed-in app: Settings, + Nieuw drag and bounce, and that #477's login glitch stays gone.
- `pnpm audit` is clean, dev dependencies included (#512, #554, #572). Dev-chain pins live in `pnpm-workspace.yaml` `overrides`.
- The visual gate now runs for `app/**/*.tsx` and `app/globals.css`. Scrollbars are hidden app-wide in `app/globals.css` (no gutter).

## Next

1. The user promotes `main` to production (`deploy.yml` `target: deploy`). Then check: `curl -I` for #584's headers; log in with password, with a code and via the mailed link (confirm screen); a URL import; a basket invite between two accounts; agenda with recurring events and categories against the real database.
2. Hosted settings for the user (private-board drafts): Vercel Deployment Protection (high) and the hosted checklist (Supabase Auth, Vercel env, Turnstile, R2, spend cap). Claude has no Supabase access token or Vercel token locally, and the `.env` Cloudflare token has no Turnstile/R2 scope. Secret scanning, push protection and Dependabot are on (2026-10-24).
3. **Agenda redesign, epic #527** (ADR-0040–0042, user decisions of 2026-10-18): Built and merged (#529–#534, feedback rounds up to #553). Checked only in headless Chromium or Ladle so far; still to check on a real iPhone/browser: the sheet and tray animations, the safe-area strip, `showPicker()` on click. Not yet checked end to end in production: recurring-event panel, categories, quick add. A planned card or deadline now opens an agenda card panel instead of the card (#560): **Uit agenda** or **Deadline wissen**, and the card is one click away. A planned recipe's moment starts on its recipe category (Ontbijt, Lunch, Avond; nl/en name words, else Diner) and stays editable (#562 via #564). The agenda skeleton is an empty grid; the real items fade in once on load. Backlog: CalDAV import (#491).
4. **Phase 8, epic #31** (ADR-0043/0044, user decisions of 2026-10-23): `bge-m3` on Cloudflare Workers AI, opt-in per member, search across all modules (basket items included), and an activity history of basket adds/checks and cooked meals. Merged on 2026-10-23: #576 `embed()` in `lib/ai/cloudflare.ts` (#585), #577 schema (#586) and #578 pipeline (#588): lazy drain in `after()` from `(app)/layout.tsx` (RLS client, once per 10 min per member), cron `/api/cron/embeddings` at 05:00 (`service_role`), `worker/` removed. All inert without `CLOUDFLARE_*` env and opt-in. `profiles` now has column grants: a new profile column needs its own grant. Wave 2 merged on 2026-10-24 with the user's go: #582 history via #594 (migration `20261024000001_activity_events`, on hosted; settle runs lazily on Agenda/Recepten and in the calendar-sync cron), #579 opt-in in Settings via #596 (shows "Nog niet beschikbaar" until `CLOUDFLARE_*` is set in production, #574), #580 hybrid search via #592. #580's semantic rate limit is in memory per instance (a durable one needs a migration), and events link to `/agenda` with a `date` because the Agenda has no deep link. Next: #581 search panel; rollout #574 needs the user's go per step. Phase 9 (#32) builds on it.

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
