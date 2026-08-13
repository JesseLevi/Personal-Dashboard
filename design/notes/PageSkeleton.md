# PageSkeleton

No Figma node — this file has no design record entry. `app/(app)/_components/PageSkeleton.tsx` renders `BoardSkeleton`/`RecipeDetailSkeleton`, used both as route `loading.tsx` fallbacks and as `<Suspense>` fallbacks; see the file's own header comment for the full "why no design" reasoning (#170, `docs/open-questions.md#loading-skeleton-undesigned`).

## #219

Raw radius/spacing utilities in this file (`gap-6`, `gap-2`, `py-1`) all stay raw — flagged in place, not converted. There is no Figma skeleton node to measure a `boundVariables` entry against, so any token pick here would be matching a value (e.g. `gap-2` = 8px could be `spacing/inline/gap-sm`, `spacing/stack/stack-sm` or `spacing/component/padding-sm`) rather than a measurement — exactly what this ticket forbids.

Two of the four flagged lines mirror structure the real, Figma-backed `BoardView.tsx`/`Card` components already use (a `gap-2` card-list wrapper, a `gap-2 py-1` content stand-in) — those real components' own bindings belong to their own real nodes, not to this invented skeleton chrome, so they are not reused here even though the numbers match.

- `PageSkeleton.tsx:44` (`BoardSkeleton` outer wrapper, `gap-6`)
- `PageSkeleton.tsx:98` (card-list wrapper, `gap-2`)
- `PageSkeleton.tsx:101` (placeholder content wrapper, `gap-2 py-1`)
- `PageSkeleton.tsx:96` (`RecipeDetailSkeleton` outer wrapper, `gap-6`)

No Figma frame node-id applies to any of the above.
