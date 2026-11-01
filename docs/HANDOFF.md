# Handoff

State and next step only, one screen (≤ 6 KB, `check:doc-budget`). Replace stale bullets; never append history. Ticket status lives on the board, rules in `CLAUDE.md` and the guides, and the system in `Architecture.md`.

## State (2026-11-01)

- Atlas is in production use by real accounts. Built: account, Vandaag (landing page), Te doen, Recepten, Winkelmand (incl. shared baskets), Notities, Agenda, ⌘K palette, Assistent rhythms (phase 9), iPhone widget.
- **Production**: the "Deploy (migrate + production)" workflow ran on `5474b0e` (2026-11-01, user's go). Everything merged after that is not in production.
- **Merged 2026-11-01, not in production**: ⌘K palette replacing `SearchPanel` (ADR-0048, #691/#699/#705); card subtasks schema and actions, Projecten in ⌘K (ADR-0053, #702, #707); and the improvement brief with the user's choices: note save conflicts (ADR-0056, #676), autosave without page re-render (#678), server error log (ADR-0049, #680), done columns (ADR-0050, #682; palette progress reads `is_done`), signals in Winkelmand and the plan drawer, nav item "Assistent" removed (ADR-0051, #684), card labels (ADR-0052, #690), Vandaag as landing page and `start_url` (ADR-0057, #698), read-only offline basket via `public/sw.js` (ADR-0054, #701), mobile tab bar (ADR-0055, #704).
- `pnpm audit` is clean. Visual gate covers `app/**/*.tsx` and `app/globals.css`. Ladle groups per module (`vandaag` after `basis`), `Overview` first.

## Next

1. **Hosted migrations, user's go per step, in this order** (`20261030000001_widget_tokens` first if it is not applied yet):
   - `20261102000001_card_subtasks`;
   - `20261102000002_note_content_version` (additive; old code keeps working);
   - `20261102000003_app_errors`, then Vault `app_error_report_secret` + Vercel `APP_ERROR_REPORT_SECRET` (`docs/operations.md`); without both, logging is a no-op;
   - `20261102000004_board_columns_is_done` **before promoting**: the code selects `is_done`, a board fails to load without it;
   - `20261102000005_card_labels_same_board` (tightens `card_labels` policies).
2. **Promotion** (`deploy.yml`). Then check logged in, on the iPhone where it says so:
   - login (password, code, link) lands on `/vandaag`; re-add the home-screen icon (iOS keeps the old start URL);
   - ⌘K/Escape/focus, each `?nieuw=1`, board rows with progress, and the `board_columns.latest` embed on real PostgREST;
   - tab bar and safe area; offline basket (open a basket, airplane mode, reopen; logout wipes it);
   - two tabs on one note give "Elders gewijzigd"; a done column hides its cards from Agenda and widget;
   - labels add, chip, filter, and disappear when unused; rhythm suggestions settle when acted on.
3. **iPhone widget** (epic #653, ADR-0047): the "Open Atlas" iCloud link from #659 into `WIDGET_SHORTCUT_URL` (`lib/widget/install.ts`), then a device test of every family. `/agenda?date=` sets the date only on first mount.
4. **Subtasks UI** (epic #692, ADR-0053): the palette's Projecten group is merged (#707); the card panel follows. Finishing a project offers the done column (ADR-0050).
5. **Phase 8 rollout #574** (ADR-0043): `CLOUDFLARE_*` in Vercel, user's go per step. LLM pattern signals stay inert until then and `ANTHROPIC_API_KEY` is set; they show on Vandaag.

## Small open items

- Visual baseline `agenda--agenda-event-panel--overview` is flaky (~20 px); a rerun passes.
- Hosted login hardening (`docs/operations.md`): minimum password length 12, leaked-password protection. Needs the user's go.
- Confirm `CRON_SECRET` is set in Vercel production; without it the cron backstops answer 401.
- `/login?error=magic-link-invalid` shows no message.
- Vandaag has no per-item links (planned cards carry no board id in `agenda_items()`).
- Drop the 5-argument `save_note_content` once no production code calls it (ADR-0056 §4).
- The Winkelmand clear-all confirm row wraps below ~370 px.
- After promotion, check a note with a code block (TipTap 3.32 node views, #520).

## Open product questions

- A basket member sees the owner's unnamed default basket as "Mijn mand", next to their own.
- Label colours (new column + token decision); archiving done cards (ADR-0050 option b); checking off offline (ADR-0054 option b).
- The rest live in `docs/open-questions.md`, by slug.
