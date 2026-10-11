# ADR-0025: `cards.size` — optional s/m/l/xl size on Kanban cards

**Status**: Accepted (retroactive record; the underlying choice was approved by the user 2026-07-23, issue #91; ratified 2026-10-11, #412)


## Context

`Architecture.md` §4.2 lists `cards` as (column_id, title, description, priority, due_at, position, source) — no size. The Figma design for Te doen draws a grey size tag next to the priority tag on ticket cards, the sort menu has a "Grootte" option, and the card detail panel has a "Grootte" field (a button slot containing a grey `Tag`; desktop `3779:4939`, mobile `3779:4847`). The #91 ticket recorded this as one of three user-approved deviations from §4.2 and said it belongs in an ADR, which was never written.

## Decision

`public.cards.size text` — nullable, `check (size is null or size in ('s', 'm', 'l', 'xl'))`. Nullable because a card need not have a size. The UI shows the value as data (`card.size.toUpperCase()`), not as a translated label, and omits the tag when `size` is null (`design/notes/TeDoenBoard.md`).

## Consequences

- Sorting by size (`?sort=size`) and the detail-panel field read this column directly.
- Adding a value (e.g. `xs`) requires a migration replacing the check constraint; renaming or removing one requires migrating existing rows.
- It sits beside `priority` (`low|medium|urgent`, also a text+check; §4.2's `mid` was dropped in the same ticket) and `source`, so the table's small closed sets are modelled uniformly.
- **Not recoverable from the repo**: why text+check was chosen over a Postgres enum. The #91 ticket body says "`size` enum" while the migration implements text+check, and no comment explains the switch. Consistency with `priority`/`source` is an observation, not a recorded reason. (The later `recipe_unit` enum, ADR-0028, went the other way, also without a written comparison.)
- `Architecture.md` §4 reflects this since #412.

## Migration

- [`supabase/migrations/20260723000001_kanban_schema.sql`](../../supabase/migrations/20260723000001_kanban_schema.sql) (#91, commit `36b74b6`).
