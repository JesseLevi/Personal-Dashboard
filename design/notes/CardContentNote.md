# Card-content/Note
Figma: `Card-content/Note` · node `4067:18495` (Card-contents section `3674:1417`, Development page) · Code: `components/molecules/CardContentNote.tsx`

## Anatomy
Vertical stack (`gap-stack-xs`, `p-component-sm`): a row with `title` (FILL) and `timestamp` (HUG), `justify-between`, above a `snippet` line. All three props are caller-supplied, already-formatted strings. The molecule draws no chrome (no fill, radius or border); the composing `Card` owns that, as with `CardContentTicket`.

Figma's three TEXT layers are all named `Recepi name`: copy-paste residue from Card-content/Recipe with no semantic meaning, left uncorrected in Figma. Do not read meaning into them.

Token binding (read via `boundVariables`): root gap 4px = `spacing/stack/stack-xs`; root padding 8px = `spacing/component/padding-sm`; title `text-base font-semibold text-text-primary`; timestamp `text-xs font-semibold text-text-secondary`; snippet `text-sm font-medium text-text-secondary`. The inner row's `itemSpacing` is 0 because Figma does not apply it with space-between; `justify-between` alone reproduces it.

## Deliberate decisions
- Title is `min-w-0 flex-1`, not `w-full`: it is FILL next to a HUG timestamp, and `flex-1` grows into the remaining width where `w-full` would ignore the sibling. `min-w-0` lets a long title wrap instead of overflowing. The timestamp is `shrink-0`. `Card` and `CardContentIngredient` carry no `flex-1` on their titles; this node's binding is unambiguous so it is not copied from them. (#229)
- Snippet is clamped to 2 lines with an ellipsis (`line-clamp-2`), a product decision that deviates from Figma, where `textTruncation` is `DISABLED` and the card grows. The title still wraps unclamped, as in Figma. The snippet string itself is capped at 200 chars in `lib/notes/queries.ts` (`snippetFrom`), newlines preserved. (#307)
- No date logic in the molecule (ADR-0007). The timestamp tiers (today = `12:24`, yesterday = the translated word `Gisteren`, older = `dd-mm-yyyy`) are classified by `lib/notes/timestamp.ts` and rendered by the caller. (#229)

## Token gaps and flags
None. Every fill, radius and non-zero spacing value in the node has a bound variable that maps to an existing semantic token, so there is no `spacing-flag` in this component.

## Gotchas
- Timestamp width varies per form (`12:24` 32px, `Gisteren` 50px, `12-03-2026` 71px); the title's width shrinks in lockstep. The `flex-1` / `shrink-0` pair already handles this.
- The `TimestampForms` and `LongTitleAndSnippet` stories cover the four timestamp forms and the clamp. The Figma sample column (node `4067:19048`) varies only the timestamp, never the text length, so it does not exercise a title wrap.
