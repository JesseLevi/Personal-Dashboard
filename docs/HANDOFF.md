# Handoff

State and next step only, one screen (≤ 6 KB, `check:doc-budget`). Replace stale bullets; never append history. Ticket status lives on the board, rules in `CLAUDE.md` and the guides, and the system in `Architecture.md`.

## State (2026-11-02)

- Atlas is in production use by real accounts. Built: account, Agenda as landing page with day cards, Te doen, Recepten, Winkelmand (incl. shared baskets), Notities, Agenda, ⌘K palette, Assistent rhythms (phase 9), iPhone widget.
- **Production**: the "Deploy (migrate + production)" workflow ran on `5474b0e` (2026-11-01, user's go). Everything merged after that is not in production.
- **Merged 2026-11-01/02, not in production**: ⌘K palette replacing `SearchPanel` (ADR-0048, #691/#699/#705); card subtasks: schema, Projecten in ⌘K, card panel and "3/7" chip (ADR-0053, #702, #707, #708), then drag handles, the add field's check button and a compact menu (#737); and the improvement brief with the user's choices: note save conflicts (ADR-0056, #676), autosave without page re-render (#678), server error log (ADR-0049, #680), done columns (ADR-0050, #682; palette progress reads `is_done`), signals in Winkelmand, nav item "Assistent" removed (ADR-0051, #684), card labels (ADR-0052, #690), Vandaag as landing page and `start_url` (ADR-0057, #698), read-only offline basket via `public/sw.js` (ADR-0054, #701), mobile tab bar (ADR-0055, #704).
- **Merged 2026-11-02, not in production** (the [Opt] tickets): Agenda without plan tray, `cook_rhythm` on Vandaag only (ADR-0058, #718); swipe follows the finger (#713), with a 16px gap between the days and never opening quick add (#734); quick-add sheet animates its height (#717); quick-add cards grouped per board (#719); card panel (#714), subtasks as checklist (#715), label picker (#716).
- **Merged 2026-11-02, not in production**: Agenda is the landing page with day cards, `/vandaag` gone (ADR-0059, #727); desktop: cards always in the left column, a narrow week shows 3 days or 1 (#738); mobile: date-opener header and a pull-up sheet, sheet follows the cards, title menu (#742, #748); quick add behind Details, links on create (#747).
- `pnpm audit` is clean. Visual gate covers `app/**/*.tsx` and `app/globals.css`. Ladle groups per module, `Overview` first. `shell.visual.spec.ts` shoots the Agenda in shell dimensions.

## Next

1. **Hosted migrations, user's go per step.** Applied 2026-11-01 17:49 (`migrate`, user's go): up to `20261102000003_app_errors`; then set Vault `app_error_report_secret` + Vercel `APP_ERROR_REPORT_SECRET` (`docs/operations.md`), without both logging is a no-op. Still to apply:
   - `20261102000004_board_columns_is_done` **before promoting**: the code selects `is_done`, a board fails to load without it;
   - `20261102000005_card_labels_same_board` (tightens `card_labels` policies).
2. **Promotion** (`deploy.yml`). Then check logged in, on the iPhone where it says so:
   - login (password, code, link) lands on `/agenda`; re-add the home-screen icon (iOS keeps the old start URL);
   - ⌘K/Escape/focus, each `?nieuw=1`, board rows with progress, and the `board_columns.latest` embed on real PostgREST;
   - tab bar and safe area; offline basket (open a basket, airplane mode, reopen; logout wipes it);
   - two tabs on one note give "Elders gewijzigd"; a done column hides its cards from Agenda and widget;
   - labels: pick, "+ Nieuw label", chip remove, filter, gone when unused; the picker list stays above the keyboard; rhythm suggestions settle when acted on (`cook_rhythm` via quick add Maaltijd);
   - Agenda sheet: grabber tap/drag peek↔full, a sideways swipe over the cards steps the day, the iOS date wheel jumps on Gereed, a sideways strip swipe never moves the sheet, the grid scrolls in full without dragging it, panels open above it, nothing under the tab bar, header stays put;
   - Agenda on the iPhone: swipe a day (slow, flick, return, vertical scroll, event long-press; no swipe opens quick add, a tap does), the quick-add sheet animating between kinds (keyboard open and closed), and the card picker's board headers;
   - subtasks: add (also a multi-line paste), check, rename, "Maak er een kaart van", drag to reorder (touch long-press on the handle), the "Alles af" offer, the "3/7" chip, and the card under Projecten in ⌘K.
3. **iPhone widget** (epic #653, ADR-0047): the "Open Atlas" iCloud link from #659 into `WIDGET_SHORTCUT_URL` (`lib/widget/install.ts`), then a device test of every family. `/agenda?date=` sets the date only on first mount.
4. **Phase 8 rollout #574** (ADR-0043): `CLOUDFLARE_*` in Vercel, user's go per step. LLM pattern signals stay inert until then and `ANTHROPIC_API_KEY` is set; they show on the Agenda day cards.

## Small open items

- Visual baseline `agenda--agenda-event-panel--overview` is flaky (~20 px); a rerun passes.
- Hosted login hardening (`docs/operations.md`): minimum password length 12, leaked-password protection. Needs the user's go.
- Confirm `CRON_SECRET` is set in Vercel production; without it the cron backstops answer 401.
- `/login?error=magic-link-invalid` shows no message.
- Attaching a meal to an event has no UI since ADR-0058 (the drop route went with the tray); needs a ticket.
- Day cards have no per-item links to Te doen (planned cards carry no board id in `agenda_items()`).
- Mobile Agenda title: the server HTML shows the period until hydration (`useIsNarrow`), then the weekday.
- Te doen's `EnterFromLogin` wrapper keeps its sticky `PageHeader` from sticking (the Agenda passes `className` sticky since #742).
- Drop the 5-argument `save_note_content` once no production code calls it (ADR-0056 §4).
- The Winkelmand clear-all confirm row wraps below ~370 px.
- After promotion, check a note with a code block (TipTap 3.32 node views, #520).

## Open product questions

- A basket member sees the owner's unnamed default basket as "Mijn mand", next to their own.
- Label colours (new column + token decision); archiving done cards (ADR-0050 option b); checking off offline (ADR-0054 option b).
- The rest live in `docs/open-questions.md`, by slug.
