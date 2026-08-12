# Atom/Tag

- **Code:** `components/atoms/Tag.tsx`
- **Node ID:** `3626:4515`

Figma 'Color' axis → semantic CVA variant: Grey→neutral, Red→urgent,
Blue→medium, Green→low, Yellow→highlight (no priority meaning) (matches
card priority enum).

## #97 — priority scale collapses to Low/Medium/Urgent, Medium turns blue

The card `priority` enum drops `mid` down to three values (Low/Medium/
Urgent), per the Dev Mode annotation on the Priority field (node
`3779:4856`: "On click open dropdown component with all Priority options:
Low, Medium, Urgent") plus the user's 2026-07-23 decision that `medium`
takes over the blue colour `mid` used to have. Mapping change:

| Figma Color | old `variant` | new `variant` |
|---|---|---|
| Grey | `neutral` | `neutral` (unchanged) |
| Red | `urgent` | `urgent` (unchanged) |
| Yellow | `medium` | `highlight` (no priority meaning) |
| Blue | `mid` | `medium` |
| Green | `low` | `low` (unchanged) |

Re-fetched the node (`3626:4515`) before touching anything, per the ticket's
own instruction. The component set still has all five `Color` values —
Grey, Red, Yellow, Blue, Green — so the axis itself hasn't shrunk in Figma,
only the app's priority semantics layered on top of two of its members.
(The per-instance sample text — Yellow's says "Medium", Blue's says "Mid",
Grey's says "300 gr" — is leftover placeholder content from whichever card
each instance was last dragged onto in the Figma canvas, not a live binding
to the Color axis; Grey's unrelated "300 gr" is the tell. Not used as a
naming signal.)

**Yellow decision: kept, renamed `highlight`, not removed.** Grepped every
consumer (`components/`, `app/`) for `variant="mid"` and for any yellow/
attention-styled Tag before deciding — none exist; nothing on a card
currently renders yellow. Kept it anyway rather than dropping it, to stay
consistent with how every other atom in this codebase mirrors Figma's full
variant axis regardless of current consumer count (`Atom/Button` keeps all
five `Style` values the same way). Named it `highlight` rather than a
priority-shaped word (`warning`, `attention`) deliberately: no product
decision has assigned Yellow a business meaning yet, and a priority-sounding
name would silently invent one. `highlight` only describes that it's a
non-priority, non-neutral accent tag. Token-wise this also means `variant`
is no longer a 1:1 alias for the priority enum — `neutral` and `highlight`
both sit outside it, `urgent`/`medium`/`low` inside it — same shape as
before #97 (`neutral` was already the odd one out).

**`mid` removed, not deprecated-in-place.** No call site outside
`Tag.stories.tsx` used `variant="mid"`, so there was nothing to migrate.
`design/tokens.json`'s `priority-mid`/`priority-mid-bg` tokens are deleted
(not left dead) — `priority-medium`/`priority-medium-bg` now resolve to the
blue primitives that `priority-mid` used to hold, and a new
`tag-highlight`/`tag-highlight-bg` pair (orange primitives, the same pixels
`priority-medium` used to hold) backs `highlight`. Full before/after in
`docs/incidents.md` ("Token changes — #97").

**Divergence from `Architecture.md` §4.2 and the card `priority` enum**:
§4.2 still documents `urgent|medium|mid|low` — a deliberate, user-confirmed
scope gap, not an oversight. Not fixed here (architecture is Fable's layer,
per `docs/guides/ticket-workflow.md`); the schema ticket updates the actual
`priority` enum and an ADR should follow. Flagged, not silently resolved.

Visual baselines regenerated scoped (`pnpm test:visual:update -g tag`):
`tag--all-variants`, `tag--medium`, `tag--low`, `tag--neutral`,
`tag--urgent`, new `tag--highlight`; `tag--mid`'s baseline PNG deleted (no
story renders it anymore). Out of scope for this ticket, flagged for
awareness: `Card`'s `all-content-types` story and `CardContentTicket`'s
stories also render `variant="medium"` Tags, so their existing baselines
now show a colour mismatch (blue vs. the old orange) next time
`pnpm test:visual` runs full — not regenerated here per the ticket's scoped
instruction, needs a follow-up pass.

## TICKET #205 (2026-08-12): radius/spacing tokens

Measured via `figma_execute`/`boundVariables` on each `Color=*` variant of
the component set (3626:4515), not inferred from pixels. `px-3` (12px) →
`px-component-md` (`paddingLeft`/`paddingRight` both bind
`spacing/component/padding-md`). `rounded-lg` (8px) → `rounded-control`
(`topLeftRadius` etc. bind `radius/control`).

**Flagged gap, left unconverted:** `gap-2` (8px, `itemSpacing`) binds
`spacing/mini` — a Figma variable with no counterpart anywhere in
`design/tokens.json`'s Semantics/Responsive collection. Its value happens to
equal both `inline-sm` and `component-sm`, which is exactly why it is NOT
aliased onto either (#205's own core rule: read the binding, never the
value) — `spacing/mini` is a distinct variable this pipeline doesn't mirror.
Stays a raw `gap-2` until a future token-sync pass adds the variable or a
designer rebinds it.

## TICKET #218 (2026-08-12): spacing gate

`scripts/check-raw-spacing.sh` now enforces an explicit `spacing-flag:`
marker. Added to the existing comment above; no reasoning changed.
