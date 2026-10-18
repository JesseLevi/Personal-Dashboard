# Handoff

State and next step only, one screen (≤ 6 KB, `check:doc-budget`). Replace stale bullets; never append history. Ticket status lives on the board, rules in `CLAUDE.md` and the guides, and the system in `Architecture.md`.

## State (2026-10-18)

- Atlas is in production use by real accounts. Phases 0–6 are done: account, Te doen, Recepten (incl. URL import and nutrition), Winkelmand, Notities (full editor round, images, note links).
- Open PR **#411** (#407, login greeting, ADR-0031). Before it works on production it needs:
  - its migration (`20261011000003`);
  - Turnstile keys and `LOGIN_GREETING_SALT` in Vercel (`docs/operations.md`).
  
  It also carries ADR-0031. Two edits to that ADR are not on the PR yet: cite ADR-0033 instead of ADR-0003, and replace the line "display_name not editable" with "set via Settings (#398/#404)". `design/notes/LoginForm.md` should be condensed to the contract shape once #411 is merged.
- **Docs reform #412**:
  - ADR index;
  - ADR-0032 (deploy), ADR-0033 (server-only data), ADR-0034 (Claude designs UI);
  - Architecture rewritten to the current state;
  - design notes condensed to contracts;
  - `phase-log.md` replaced by `docs/operations.md`.

## Delen, fase 1 (epic #420, ADR-0035): built, not live

All tickets (#421–#429, #434) are merged on `main`; the user reviews and closes them. Their three migrations (`20261012000001`–`…0003`) are applied on hosted (2026-10-12, `deploy.yml` migrate run 38285635989). Before a `main` build with this code is promoted:
1. Production keeps working meanwhile: the migrations are additive.
2. Test end to end with two accounts (steps in PRs #440, #441, #442): invite, accept, both see items, tick-off visible within ~15 s, leave, revoke, delete. Also create/rename/delete a basket and the recipe → basket popover.

Follow-ups:
- A later migration drops `profiles.avatar_url` once #434's code is live (destructive: the user runs it).
- Open product question: a member sees the owner's unnamed default basket as "Mijn mand", next to their own.
- HEIC upload fails cleanly when `sharp` lacks a HEVC decoder.

## Recept delen als kopie (epic #464, ADR-0036): live

#465–#467 are merged and in production. The user reviews and closes them. Migration `20261013000002` is applied on hosted (2026-10-13, `deploy.yml` migrate run 38383067710). Still to do: an end-to-end test with two accounts (share, the offer at the top of the first column, accept makes a copy with its photo, decline).

Open: the recipe header wraps to two rows at ~400 px (three buttons). Making them icon-only on mobile needs a design decision.

## Next: Phase 7, Agenda (#33)

1. **On `main`, not on hosted**: ADR-0039 (#482, lazy sync plus one daily Vercel Cron on Hobby), the schema (#483, migration `20261014000001`), `agenda_items` + `lib/agenda` (#484, `…0002`) and `AgendaCalendar` (#485). Both migrations go to hosted only with the user's go, before #486 can be tested there.
2. **Next: #486** (Agenda page). Its issue starts with a "Herzien" section holding the contracts from #483–#485. Then #487–#489; #490 (ICS, builds ADR-0039, needs `CRON_SECRET` in Vercel) after #486.
3. **Agenda redesign, epic #527** (ADR-0040–0042 in PR #528, user decisions of 2026-10-18). Wave 1 in progress: #529 header and tray, #530 palette tokens and item style, #531 recurring events (migration `20261018000003`, changes `agenda_items()`). Wave 2 after those merge: #532 categories (migration `…0004`), #533 now and navigation. Wave 3: #534 quick add. Merging needs the user's review (ruleset). Neither migration goes to hosted without the user's go. #530 resolves the open pastel-in-dark and truncated-title items.
4. Phases 8 and 9 (#31, #32) stay in the backlog. Their bodies follow ADR-0018 (hosted models, no worker host). Each needs its own ADR first: the embedding model and the privacy of notes.

## Small open items

- `lib/defaults/ensure.ts`: the regenerated types now contain `ensure_user_defaults`, so the typed cast can go.
- Check on hosted that migrations `20261011000001` (drop thumbnail bucket, #384) and `20261011000002` (`last_name`, #404) are applied. A dispatch needs the user's go.
- Confirm `ANTHROPIC_API_KEY` and the Console spend cap are set in production. Recipe import runs degraded without them.
- `components/molecules/CardContentIngredient.stories.tsx` has a stale comment about the removed Active pill. `next.config.ts` points to a lucide fix in `design/notes/Icon.md` that the note never had.
