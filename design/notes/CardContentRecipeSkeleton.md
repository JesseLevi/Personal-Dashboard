# Card-content/Recipe skeleton

- **Code:** `components/molecules/CardContentRecipeSkeleton.tsx`
- **Node ID:** `4164:23681` (Card in `4164:23673` desktop, `4164:23787` mobile; Section `4164:20621`)

Built #318. Placeholder card shown from `recipes.import_status = 'importing'` (so it survives a reload) at the top of its column.

## Fetched structure (figma-console, `boundVariables` read)

`Card` > `Type` (radius/card, surface/highlight/white, Stroke/primary, padding-sm) > `Card-content/Recipe` instance whose `Thumbnail` binds `surface/primary/default` + `radius/card-inner`, plus two ABSOLUTE rectangles over the text column: 152x26 at (116,28) and 96x26 at (116,58). The Card's `Step` is hidden. Code: same 96px thumbnail slot as `CardContentRecipe`, name/time column `justify-center` (96 - 56 = 20px above the first bar, matching y=28 inside the 8px padding) with two bars.

## Gaps (flagged, not hardcoded)

- The two bar rectangles have **no bound fill and no bound radius** (`color` 0.96/0.96/0.957 = the value `surface/primary/default` resolves to; radius 4). Code uses `bg-surface-primary` and `rounded-card-inner` (also 4px) for the same pixels. A resolved value is not a binding: confirm in Figma.
- Bar height 26 and gap 4 are unbound (`h-6.5`, `gap-stack-xs` chosen for the pixels).
- Animation is not drawn; the shared `animate-breathe` of the loading skeletons (`design/notes/Skeletons.md`) is reused so a pending import reads like the other skeletons. `motion-reduce:animate-none`.
- Accessibility: one `role="status"` announcement (`components.recipeImport.skeleton.loadingLabel`), visual parts `aria-hidden`.
