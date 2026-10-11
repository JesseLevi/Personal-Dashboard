# Handoff

State and next step only, one screen (≤ 6 KB, `check:doc-budget`). Replace stale bullets; never append history. Ticket status lives on the board, rules in `CLAUDE.md` and the guides, and the system in `Architecture.md`.

## State (2026-10-11)

- Atlas is in production use by real accounts. Phases 0–6 are done: account, Te doen, Recepten (incl. URL import and nutrition), Winkelmand, Notities (full editor round, images, note links).
- **#411 (login greeting, ADR-0031) is merged.** It needs, on production:
  - its migration (`20261011000003`);
  - Turnstile keys and `LOGIN_GREETING_SALT` in Vercel (`docs/operations.md`).

  Until then the greeting fails closed and shows the generic text.
- **Docs reform #412** is merged:
  - ADR index;
  - ADR-0032 (deploy), ADR-0033 (server-only data), ADR-0034 (Claude designs UI);
  - Architecture rewritten to the current state;
  - design notes condensed to contracts;
  - `phase-log.md` replaced by `docs/operations.md`.

## Next: Phase 7, Agenda (#33)

1. **ADR: runtime for scheduled work.** Calendar sync is the first feature that needs it (`Architecture.md` §6, open decision 1).
   - Weigh a lazy "sync when stale" on Agenda load via `after()` (ADR-0017/0019 style, no infrastructure) against Vercel Cron and Supabase Cron.
   - Cost and the Vercel plan's cron limits decide it.
2. **Split #33 into tickets**, in this order:
   - (a) schema + RLS: `calendar_events`, `calendar_accounts`, with a sharing-ready owning container (ADR-0001);
   - (b) manual events and an Agenda page with day/week/month views on Schedule-X, Claude-designed (ADR-0034), plus a nav entry. The Sidebar has no Agenda item yet;
   - (c) a deadline overlay from `cards.due_at`;
   - (d) ICS import via `safe-fetch`, with the secret URL stored in Vault;
   - (e) CalDAV, then (f) Google.
3. Phases 8 and 9 (#31, #32) stay in the backlog. Their bodies follow ADR-0018 (hosted models, no worker host). Each needs its own ADR first: the embedding model and the privacy of notes.

## Small open items

- `lib/defaults/ensure.ts`: the regenerated types now contain `ensure_user_defaults`, so the typed cast can go.
- #10 SMTP for magic links on hosted.
- Check on hosted that migrations `20261011000001` (drop thumbnail bucket, #384) and `20261011000002` (`last_name`, #404) are applied. A dispatch needs the user's go.
- Confirm `ANTHROPIC_API_KEY` and the Console spend cap are set in production. Recipe import runs degraded without them.
- `components/molecules/CardContentIngredient.stories.tsx` has a stale comment about the removed Active pill. `next.config.ts` points to a lucide fix in `design/notes/Icon.md` that the note never had.
