# Handoff

State and next step only, one screen (≤ 6 KB, `check:doc-budget`). Replace stale bullets; never append history. Ticket status lives on the board, rules in `CLAUDE.md` and the guides, and the system in `Architecture.md`.

## State (2026-10-20)

- Atlas is in production use by real accounts. Phases 0–7 are built: account, Te doen, Recepten (incl. URL import, nutrition, USDA spices, sharing as a copy), Winkelmand (incl. shared baskets), Notities, Agenda.
- Delen fase 1 (#420) and Recept delen (#464) passed the user's two-account end-to-end test (2026-10-18).
- **Production** runs `7005994` (#488). `main` is ahead by #508, #510, #511, #516, #518, #519, #520, #523, #524, #526, the agenda redesign (#535–#540) and its feedback rounds (#545, #546, #549, #551, #553), #564, the dark alert palette for tags, Destructive buttons and error text, and #569 (panel transitions). The user promotes production.
- **Hosted DB**: every migration up to `20261018000001` (USDA spices) is applied. One migration is pending: `20261018000002_drop_profiles_avatar_url` (#513). It is destructive. The user agreed to apply it after the next production promotion. Nothing reads the column, so the order does not matter for correctness.
- **Panels (#569, 2026-10-20)**: every `SidePanel` slides in and out again (broken since #477). The quick-add sheet's handle drags to close through the shared `lib/dom/use-sheet-drag.ts`. Bottom sheets open with a 10px bounce. Checked in Ladle only; still to check on a real iPhone and in the signed-in app: Settings, + Nieuw drag and bounce, and that #477's login glitch stays gone.
- `pnpm audit` is clean, dev dependencies included (#512, #554, #572). Dev-chain pins live in `pnpm-workspace.yaml` `overrides`.
- The visual gate now runs for `app/**/*.tsx` and `app/globals.css`. Scrollbars are hidden app-wide in `app/globals.css` (no gutter).

## Next

1. The user promotes `main` to production. Then run `deploy.yml` with `target: migrate` for #513's migration. That needs the user's go, already given for this one.
2. Turn on Dependabot alerts in the repo settings (user).
3. **Agenda redesign, epic #527** (ADR-0040–0042, user decisions of 2026-10-18): #529–#534 via PRs #535–#540, merged in that order with the user's go (admin bypass, 2026-10-19). Four feedback rounds followed, all merged (#545, #546, #549, #551, and #553 on 2026-10-20). #553 covers the mobile header (two rows, + Nieuw in the bar, no floating button, week number hidden below `lg`), the quick-add sheet (no autofocus, stacked fields, slide in/out) and the `PageHeader` safe-area strip. Checked only in headless Chromium or Ladle so far; still to check on a real iPhone/browser: the sheet and tray animations, the safe-area strip, `showPicker()` on click. Migrations `20261018000003` (recurring events, changes `agenda_items()`) and `…0004` (categories) go to hosted only with the user's go, together with the code that reads them. Not yet run end to end against a database: recurring-event panel, categories, quick add. #530 resolves the pastel-in-dark and truncated-title debt. A planned card or deadline now opens an agenda card panel instead of the card (#560): **Uit agenda** or **Deadline wissen**, and the card is one click away. A planned recipe's moment starts on its recipe category (Ontbijt, Lunch, Avond; nl/en name words, else Diner) and stays editable (#562 via #564). The agenda skeleton is an empty grid; the real items fade in once on load. Backlog: CalDAV import (#491).
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
