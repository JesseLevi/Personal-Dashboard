# ADR-0052: Card labels are plain names per board

**Status**: Accepted (2026-11-01, user decision on the improvement brief, package 7: option a, build out). Uses the `labels` / `card_labels` tables from ADR-0001's schema.

## Context

- The Vision lists labels for Te doen. The schema had `labels` (per board, `name`, no colour) and `card_labels`, and `getBoard` read them, but nothing wrote them and no component showed them. Search (ADR-0043) already embeds them.
- Weighed: build them out, or remove them from the query and the Vision.

## Decision

1. **A label is a name on one board**, 1 to 40 characters, no colour (a colour would need a new column and a token decision).
2. **The card panel holds the full set**, chosen from the board's labels or created in a picker (#716). On save the server reuses a board label with the same name (case ignored), creates the missing ones, replaces the card's links, and deletes board labels no card carries any more. There is no separate label manager. At most 10 labels per card.
3. **Cards show their labels** as neutral `Tag` chips with the `Tag` icon.
4. **The board header filters** on one label (`?label=<id>`, next to `?sort=`), like sorting a view-only choice; dragging is off while a filter is set.
5. **The write policies decide what may be linked.** `card_labels` insert and update require the caller's own card and own label on the same board (`private.card_label_link_ok`), not only the caller's `user_id`.

## Consequences

- A label typo creates a second label; removing it from its only card deletes it.
- Labels stay owner-only; board sharing would extend these policies through role functions (ADR-0035).
