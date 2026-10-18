# Handoff

State and next step only, one screen (≤ 6 KB, `check:doc-budget`). Replace stale bullets; never append history. Ticket status lives on the board, rules in `CLAUDE.md` and the guides, and the system in `Architecture.md`.

## State (2026-10-18)

- Atlas is in production use by real accounts. Phases 0–7 are built: account, Te doen, Recepten (incl. URL import, nutrition, sharing as a copy), Winkelmand (incl. shared baskets), Notities, Agenda.
- **Hosted DB**: every migration up to `20261014000003` is applied (`deploy.yml` migrate run, 2026-10-14).
- **Production** runs `7005994` (#488). `main` is ahead by #508 (scrollbar gutter) and #510 (#507, Te doen access via RLS). Neither has a migration. A production promotion needs the user's go.
- Delen fase 1 (#420) and Recept delen (#464) passed the user's two-account end-to-end test (2026-10-18).

## In flight

- **#509** Agenda UI polish: PR #511.
- **#512** security upgrade (`next` ≥ 15.5.27, TipTap/ProseMirror, `sharp`; `pnpm audit` had 2 critical and 14 high).
- **#513** clean-up: `ensure.ts` cast, ADR-0031 citations, stale comments, a migration that drops `profiles.avatar_url`. **Destructive: it goes to hosted only on the user's go.**
- **#514** recipe header icon-only at ≤ 400 px; "Voeg toe aan mand" hugs its content on mobile.
- **#515** resolves four open questions: clear-all confirm, step delete/reorder, a full-row `Dropdown` button, note delete confirm.

## Next

1. Merge the PRs above. Promote `main` to production with the user's go. Apply #513's migration after #513 is live.
2. Turn on Dependabot alerts in the repo settings (user).
3. Agenda backlog: CalDAV import (#491). Design debt: pastel items in dark mode (no dark `surface-highlight-*`/`text-highlight-*` tokens, ~3:1 contrast) and truncated titles in the 3-day mobile view.
4. Phases 8 and 9 (#31, #32) stay in the backlog. Each needs its own ADR first: the embedding model and the privacy of notes (ADR-0018: hosted models, no worker host).

## Small open items

- Confirm `CRON_SECRET` is set in Vercel production. Without it the daily calendar-sync backstop answers 401; lazy sync still works (`docs/operations.md`).
- `design/notes/LoginForm.md` should be condensed to the contract shape (#411 is merged).

## Open product questions

- A basket member sees the owner's unnamed default basket as "Mijn mand", next to their own.
- HEIC upload fails cleanly when `sharp` lacks a HEVC decoder.
- The rest live in `docs/open-questions.md`, by slug.
