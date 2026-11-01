# ADR-0053: A project is a card with subtasks

**Status**: Accepted (user decision, 2026-11-01, epic #692). Amends ADR-0048 §3 (the palette's empty field).

## Context

- The user wants projects in Te doen: a to-do split into subtasks with checkboxes, as in Trello. Not every to-do is a project.
- Atlas has no project concept. ADR-0048 lets a board stand in for one in the ⌘K palette, but a board (four columns) is too heavy for "plan Lisa's birthday".
- Weighed:
  - **a.** a checklist inside the card;
  - **b.** a per-card switch "single item / project";
  - **c.** subtasks as full cards (`cards.parent_id`), with their own priority, deadline, column and planning;
  - **d.** a board per project.
- (b) adds a choice to every card and leaves open what happens to the subtasks when it is switched back. (c) fills the board, makes "done" mean two things (column and check), and drifts towards a task manager the Vision keeps out of scope. (d) is what exists.

## Decision

1. **Option a, no switch.** A card with at least one subtask is a project; removing the last one makes it a single item again. There is no `kind` column.
2. **A subtask is a title and a check**, nothing else: no deadline, priority, planning, labels or assignee. Table `card_subtasks` (`card_id`, `title` 1–200 characters, `done`, fractional `position`), owner-only like `cards`. Its insert and update policies also require the caller's own card. At most 50 per card. Changes touch the parent's `cards.updated_at`, like labels (ADR-0043).
3. **Escape hatch**: "Make it a card" turns a subtask into a card in the parent's column through one `security invoker` RPC, `promote_card_subtask` (ADR-0015).
4. **Progress is deterministic**: done subtasks / all subtasks. It is independent of the column. When the last open subtask is checked and the board has a done column (ADR-0050), the panel offers to move the card there; it never moves on its own, and moving a card into a done column checks nothing.
5. **Surfaces**:
   - The card panel holds the subtasks. Their writes are immediate, not tied to the panel's Save.
   - A board card shows a neutral `Tag` "3/7"; checking happens only in the panel.
   - Search indexes subtask titles as part of the card (`cardText`, keyword match), and a hit opens the card.
6. **Palette (amends ADR-0048 §3)**: the empty field shows `Projecten` (cards with subtasks outside a done column, most recently updated first, at most 3, with a progress ring), then `Borden` (at most 3, most recent activity first: the latest `updated_at` of the board and its cards), then `Snelle acties`. Typing also matches project titles.

## Consequences

- No new component or token: `Checkbox`, `Tag`, `InputField`, `ProgressRing` (ADR-0048) cover it.
- Projects are owner-only, like boards; board sharing would extend `card_subtasks` policies through role functions (ADR-0035).
- Subtasks cannot be planned in the Agenda. Promoting one to a card is the way to do that.
- `position` exists without a reorder UI in v1, so ordering by hand can come later without a migration.
