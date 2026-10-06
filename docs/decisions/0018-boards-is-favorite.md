# ADR-0018: `boards.is_favorite` — at most one favourite board per user

**Status**: Proposed (retroactive; the underlying choice was approved by the user 2026-07-23, issue #91)

**Authored by**: Claude Code (Opus 5.5), at the instruction of ticket #292, as a retroactive write-up. Same provenance caveat as ADR-0011/0013/0014: this is not the architecture layer's own output. The choice below is already shipped and was approved by the user at the time; what is **proposed** here is the written record, for the architecture layer to accept, amend or reject.

## Context

`Architecture.md` §4.2 lists `boards` with no favourite concept. Figma's `FavoriteExplenation` Dev Mode annotations (nodes `3878:9008` / `3878:9016`, fetched via the REST API) define it: the favourite is the board that loads first when the app opens; the star icon is active on the favourite board, any other board shows a star-plus that makes it the favourite on click. So there is one per user — turning it on for board B turns it off for board A. Each user is auto-seeded a default board "Te doen" (`seed_default_board()` trigger), which is created as the favourite.

## Decision

- `public.boards.is_favorite boolean not null default false`.
- "At most one per user" is a **real constraint**, not app convention: partial unique index `boards_one_favorite_per_user on public.boards (user_id) where (is_favorite)`. The #91 ticket explicitly asked for this over loose booleans that could drift.
- "At least one" is **not** enforced by the database: the seed trigger creates the default board as favourite and the app layer moves the flag. The migration comment says re-assigning a favourite when the favourite board is deleted is left to the board-delete ticket.
- The read path tolerates zero favourites: `boards.find(b => b.is_favorite) ?? boards[0]` (`app/(app)/te-doen/board-data.ts`).

## Consequences

- The index is not deferrable, so a toggle must clear the old favourite **before** setting the new one. `toggleBoardFavorite` originally did this as two sequential statements from the server action; a failure between them could leave zero favourites (never two — the index guarantees that half). Note the migration's own comment says the app flips the old favourite off "in the same transaction", which the code never did (flagged in the PR for #292). Issue #286 (PR #297, `20260817000001_toggle_board_favorite_rpc.sql`, open when this ADR was written) replaces it with one `toggle_board_favorite` RPC following the ADR-0015 pattern (`security invoker`, `search_path = ''`, ownership guard, `MV404`), making the toggle atomic. Origin of the pattern: ADR-0022.
- The UI never exposes an *un*-favourite affordance (the star on the favourite board is disabled, `design/notes/TeDoenBoard.md`), yet the action toggles symmetrically and could set zero favourites if called directly. Harmless because of the `?? boards[0]` fallback; recorded here, not fixed.
- Deleting the favourite board is not handled by the schema. Board delete was deliberately not built in #95 (`design/notes/TeDoenBoard.md`), so the case cannot occur today; whoever builds it must decide who becomes favourite.
- `Architecture.md` §4.2 is stale on this point.

## Migration

- [`supabase/migrations/20260723000001_kanban_schema.sql`](../../supabase/migrations/20260723000001_kanban_schema.sql) (#91, commit `36b74b6`) — column, partial unique index, seed trigger.
- Toggle atomicity: `supabase/migrations/20260817000001_toggle_board_favorite_rpc.sql` (#286 / PR #297; not on `main` when this ADR was written, so not linked).
