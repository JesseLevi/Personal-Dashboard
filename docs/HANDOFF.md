# Handoff

State and next step only, one screen (≤ 6 KB, `check:doc-budget`). Replace stale bullets; never append history. Ticket status lives on the board, rules in `CLAUDE.md` and the guides, and the system in `Architecture.md`.

## State (2026-10-18)

- Atlas is in production use by real accounts. Phases 0–7 are built: account, Te doen, Recepten (incl. URL import, nutrition, USDA spices, sharing as a copy), Winkelmand (incl. shared baskets), Notities, Agenda.
- Delen fase 1 (#420) and Recept delen (#464) passed the user's two-account end-to-end test (2026-10-18).
- **Production** runs `7005994` (#488). `main` is ahead by #508, #510, #511, #516, #518, #519, #520, #523, #524 and #526. The user promotes production.
- **Hosted DB**: every migration up to `20261018000001` (USDA spices) is applied. One migration is pending: `20261018000002_drop_profiles_avatar_url` (#513). It is destructive. The user agreed to apply it after the next production promotion. Nothing reads the column, so the order does not matter for correctness.
- `pnpm audit --prod` is clean (#512). Dev-only findings are in #525.
- The visual gate now runs for `app/**/*.tsx` and `app/globals.css`. The Ladle story frame resets `scrollbar-gutter`, so the app's gutter (#508) does not shift baselines.

## Next

1. The user promotes `main` to production. Then run `deploy.yml` with `target: migrate` for #513's migration. That needs the user's go, already given for this one.
2. Turn on Dependabot alerts in the repo settings (user).
3. **Agenda redesign, epic #527** (ADR-0040–0042, user decisions of 2026-10-18): #529–#534 via PRs #535–#540, merged in that order with the user's go (admin bypass, 2026-10-19). Migrations `20261018000003` (recurring events, changes `agenda_items()`) and `…0004` (categories) go to hosted only with the user's go, together with the code that reads them. Not yet run end to end against a database: recurring-event panel, categories, quick add. #530 resolves the pastel-in-dark and truncated-title debt. Backlog: CalDAV import (#491).
4. Phases 8 and 9 (#31, #32) stay in the backlog. Each needs its own ADR first: the embedding model and the privacy of notes (ADR-0018: hosted models, no worker host).

## Small open items

- Confirm `CRON_SECRET` is set in Vercel production. Without it the daily calendar-sync backstop answers 401; lazy sync still works (`docs/operations.md`).
- `design/notes/LoginForm.md` should be condensed to the contract shape (#411 is merged).
- The Winkelmand clear-all confirm row wraps to two lines below ~370 px (`DeleteConfirm` idiom); it fits at 390 px.
- After promotion, check a note with a code block: TipTap 3.32 changed how node views render without `EditorContent` (#520).

## Open product questions

- A basket member sees the owner's unnamed default basket as "Mijn mand", next to their own.
- HEIC upload fails cleanly when `sharp` lacks a HEVC decoder.
- The rest live in `docs/open-questions.md`, by slug.
