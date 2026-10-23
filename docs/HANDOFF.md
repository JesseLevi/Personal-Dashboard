# Handoff

State and next step only, one screen (≤ 6 KB, `check:doc-budget`). Replace stale bullets; never append history. Ticket status lives on the board, rules in `CLAUDE.md` and the guides, and the system in `Architecture.md`.

## State (2026-10-23)

- Atlas is in production use by real accounts. Phases 0–7 are built: account, Te doen, Recepten (incl. URL import, nutrition, USDA spices, sharing as a copy), Winkelmand (incl. shared baskets), Notities, Agenda.
- Delen fase 1 (#420) and Recept delen (#464) passed the user's two-account end-to-end test (2026-10-18).
- **Production** runs `1aa6917` (`deploy.yml` `target: both`, user's go, 2026-10-23): everything up to #589, incl. the agenda redesign, #584 (security headers), #587 (login rate limit, ADR-0045) and phase 8 wave 1. The user promotes production.
- **Hosted DB**: every migration on `main` is applied, up to `20261023000005_login_rate_limit`. That run applied `20261023000001`–`…0005` (phase 8 schema and the login limiter); `20261018000002`–`…0004` were already on hosted.
- **Panels (#569, 2026-10-20)**: every `SidePanel` slides in and out again (broken since #477). The quick-add sheet's handle drags to close through the shared `lib/dom/use-sheet-drag.ts`. Bottom sheets open with a 10px bounce. Checked in Ladle only; still to check on a real iPhone and in the signed-in app: Settings, + Nieuw drag and bounce, and that #477's login glitch stays gone.
- `pnpm audit` is clean, dev dependencies included (#512, #554, #572). Dev-chain pins live in `pnpm-workspace.yaml` `overrides`.
- The visual gate now runs for `app/**/*.tsx` and `app/globals.css`. Scrollbars are hidden app-wide in `app/globals.css` (no gutter).

## Next

1. Check production after the 2026-10-23 deploy: `curl -I` for #584's headers on the production domain; log in with password and with a code (Turnstile, limiter); agenda with recurring events and categories against the real database.
2. Turn on Dependabot alerts in the repo settings (user).
3. **Agenda redesign, epic #527** (ADR-0040–0042, user decisions of 2026-10-18): #529–#534 via PRs #535–#540, merged in that order with the user's go (admin bypass, 2026-10-19). Four feedback rounds followed, all merged (#545, #546, #549, #551, and #553 on 2026-10-20). #553 covers the mobile header (two rows, + Nieuw in the bar, no floating button, week number hidden below `lg`), the quick-add sheet (no autofocus, stacked fields, slide in/out) and the `PageHeader` safe-area strip. Checked only in headless Chromium or Ladle so far; still to check on a real iPhone/browser: the sheet and tray animations, the safe-area strip, `showPicker()` on click. Not yet checked end to end in production: recurring-event panel, categories, quick add. #530 resolves the pastel-in-dark and truncated-title debt. A planned card or deadline now opens an agenda card panel instead of the card (#560): **Uit agenda** or **Deadline wissen**, and the card is one click away. A planned recipe's moment starts on its recipe category (Ontbijt, Lunch, Avond; nl/en name words, else Diner) and stays editable (#562 via #564). The agenda skeleton is an empty grid; the real items fade in once on load. Backlog: CalDAV import (#491).
4. **Phase 8, epic #31** (ADR-0043/0044, user decisions of 2026-10-23): `bge-m3` on Cloudflare Workers AI, opt-in per member, search across all modules (basket items included), and an activity history of basket adds/checks and cooked meals. Merged on 2026-10-23: #576 `embed()` in `lib/ai/cloudflare.ts` (#585), #577 schema (#586) and #578 pipeline (#588): lazy drain in `after()` from `(app)/layout.tsx` (RLS client, once per 10 min per member), cron `/api/cron/embeddings` at 05:00 (`service_role`), `worker/` removed. All inert without `CLOUDFLARE_*` env and opt-in. `profiles` now has column grants: a new profile column needs its own grant. Next: #582 history (its own migration, so not in parallel with another migration ticket), #579 opt-in in Settings, #580 hybrid search, #581 search panel; rollout #574 needs the user's go per step. Phase 9 (#32) builds on it.

## Small open items

- Hosted login hardening (`docs/operations.md`): minimum password length 12, leaked-password protection. Needs the user's go.
- Confirm `CRON_SECRET` is set in Vercel production. Without it the daily calendar-sync backstop answers 401; lazy sync still works (`docs/operations.md`).
- `design/notes/LoginForm.md` should be condensed to the contract shape (#411 is merged).
- The Winkelmand clear-all confirm row wraps to two lines below ~370 px (`DeleteConfirm` idiom); it fits at 390 px.
- After promotion, check a note with a code block: TipTap 3.32 changed how node views render without `EditorContent` (#520).

## Open product questions

- A basket member sees the owner's unnamed default basket as "Mijn mand", next to their own.
- HEIC upload fails cleanly when `sharp` lacks a HEVC decoder.
- The rest live in `docs/open-questions.md`, by slug.
