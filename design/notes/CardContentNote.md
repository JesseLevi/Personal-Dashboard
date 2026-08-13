# Card-content/Note

- **Code:** `components/molecules/CardContentNote.tsx`
- **Node ID:** `4067:18495` (Card-contents section `3674:1417`, Development page)

Built #229. Fetched via `figma-console`/`boundVariables`, not the hosted
Figma MCP (rate-limited, no `boundVariables` anyway). All three TEXT layers
in the node are literally named `Recepi name` — copy-paste residue from
Card-content/Recipe, no semantic meaning, left uncorrected in Figma per the
ticket.

## Anatomy

```
Card-content/Note [4067:18495]      VERTICAL, itemSpacing 4, padding 8 all sides
  Frame [4067:18490]                HORIZONTAL, space-between, center, width FILL, height HUG
    "Recepi name" [4067:18491]      "Note title" -> title, width FILL
    "Recepi name" [4067:18492]      "12:24" -> timestamp, width HUG
  "Recepi name" [4067:18493]        "Text from note that could be this long." -> snippet, width FILL
```

## Tokens (measured via `figma_execute` + `getVariableByIdAsync`, never inferred from resolved values)

- Root `itemSpacing` (4px, VERTICAL) → bound to `spacing/stack/stack-xs` → `gap-stack-xs`.
- Root padding (8px, all four sides) → bound to `spacing/component/padding-sm` → `p-component-sm`.
- Inner `Frame`'s `itemSpacing` is 0 with `primaryAxisAlignItems: SPACE_BETWEEN` — Figma doesn't apply/bind itemSpacing when alignment is space-between, so there is nothing to convert; `justify-between` alone reproduces it. No `spacing-flag` needed anywhere in this component — everything with a real gap value is bound.
- Root `cornerRadius: 0`, no fill on any frame — this molecule draws no chrome of its own (radius/border/background belong to the composing `Card`), matching `CardContentTicket`.
- Title text: `fontSize 16 / weight Semi Bold / lineHeight 24px` → Tailwind's built-in `text-base font-semibold` pairing (24px is `text-base`'s default line-height, same convention already used by `Card`/`CardContentRecipe`/`CardContentIngredient` — no custom `leading-*` needed). Fill bound to `color/text/base/primary` → `text-text-primary`.
- Timestamp text: `fontSize 12 / weight Semi Bold / lineHeight 16px` → `text-xs font-semibold`. Fill bound to `color/text/base/secondary` → `text-text-secondary`.
- Snippet text: `fontSize 14 / weight Medium / lineHeight 20px` → `text-sm font-medium`. Fill bound to `color/text/base/secondary` → `text-text-secondary`.

No token gaps found — every fill, radius, and non-zero spacing value in the fetched node has a bound variable that maps onto an existing semantic token already used elsewhere in this codebase.

## Layout: `title` is `flex-1`, not `w-full`

Title's `layoutSizingHorizontal` is `FILL` inside a `HORIZONTAL` auto-layout row that also has a `HUG`-sized timestamp sibling — the CSS equivalent of "one FILL child next to a HUG child in a row" is `flex-1` (grow into the remaining space), not `w-full` (100% of the row, ignoring the sibling). `min-w-0` is paired with it so a long title actually wraps inside its shrunk width instead of a flex item's default `min-width: auto` forcing overflow. This is a small deliberate deviation from `Card.tsx`/`CardContentIngredient.tsx`'s row pattern (their title/name paragraphs carry no `flex-1`) — those two were not re-measured for this ticket, and this node's own binding is unambiguous (`FILL` next to `HUG`, not two `HUG` widths), so it gets the more precise translation rather than copying an unverified sibling shape.

## Long-text behaviour (checked on node `4067:19048`, the four-timestamp-form instance column)

`textTruncation` is `DISABLED` and `textAutoResize` is `HEIGHT` on both the title and snippet TEXT layers, in every one of the four sampled instances (timestamps `12:24`, `Gisteren`, `12-03-2026`, `10-03-2026`). There is no `line-clamp`/ellipsis anywhere in the fetched node. The design's actual overflow behaviour is: text wraps onto additional lines at its layout width, growing the row/card's height (root is `HUG` on the vertical axis) — never truncated, never clipped. `CardContentNote.stories.tsx`'s `LongTitleAndSnippet` story demonstrates this with a title and snippet well past the sample length; no `line-clamp-*` utility was added to the component, matching what Figma actually does.

All four sampled instances use the identical short title/snippet — the fetched column only varies the timestamp, not text length — so it does not itself exercise a genuine title-wrap case; the wrap behaviour above follows from the `textAutoResize`/`textTruncation` properties directly, not from an eyeballed screenshot.

Timestamp width varies per form as expected from a `HUG`-sized text next to a `FILL` sibling: `12:24` 32px, `Gisteren` 50px, `12-03-2026` 71px, `10-03-2026` 72px (title's own width shrinks in lockstep, e.g. 226px next to `12:24`). No token or component consequence — this is exactly what `flex-1`/`shrink-0` on the two row children already reproduces.

## Date-formatting helper: explicitly NOT built here — belongs in `lib/notes/`

The ticket requires `title`/`timestamp`/`snippet` as ready-made strings; this molecule does zero date logic (ADR-0007 — formatting is i18n-owned, not component-owned). The actual formatting decision (this ticket only records where it should live, per the issue's explicit ask):

**`lib/notes/`, not a generic `lib/dates/` or inline `useFormatter()` call at each call site.** Two real precedents pull in opposite directions and neither fits outright:

- `app/(app)/te-doen/TeDoenBoard.tsx` formats `cards.due_at` with next-intl's `useFormatter().dateTime(...)` called directly at the composing component (see `design/notes/TeDoenBoard.md`, and `CardContentTicket.stories.tsx`'s `WithDueDate` comment) — no shared helper at all, because a ticket's due date is a single absolute-format display with one caller.
- `lib/boards/dates.ts` (`parseDueAtText`) is a per-feature pure helper living beside its feature's other data-layer modules, not in a generic `lib/dates/`.

A note's timestamp needs neither of those shapes: it is a **three-tier fallback** (today → time-only `12:24`; yesterday → the literal word `Gisteren`; older → `dd-mm-yyyy`), which is more than `useFormatter().dateTime()` alone expresses in one call, and it has **two known callers already scoped** (#230 the kanban board, #231 search results) — not the due-date's one-off. That combination (shared logic, feature-specific business rule, not a cross-app primitive) is exactly what `lib/notes/` — already this feature's data-layer home from golf 1 (#228: `queries.ts`, `types.ts`, `schemas.ts`, `document.ts`) — exists for, the same way `lib/boards/dates.ts` sits beside the boards feature rather than a generic date-utility folder. Recommendation: a small `lib/notes/timestamp.ts` exporting one function that takes a note's `updated_at`/`created_at` plus the active locale/`now` and returns the already-formatted string this component's `timestamp` prop expects — built in #230 or #231, whichever lands first, not in this ticket.
