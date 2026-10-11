# Card-content/Recipe skeleton
Figma: Card node `4164:23681` (in `4164:23673` desktop, `4164:23787` mobile; Section `4164:20621`) · Code: `components/molecules/CardContentRecipeSkeleton.tsx`

## Anatomy
Placeholder card shown at the top of its column while `recipes.import_status = 'importing'` (so it survives a reload). Same 96px thumbnail slot as `CardContentRecipe`; the name/time column is `justify-center` with two bars (152x26 and 96x26 in Figma). The thumbnail binds `surface/primary/default` + `radius/card-inner`.

## Token gaps and flags
- The two bar rectangles have no bound fill and no bound radius in Figma (colour 0.96/0.96/0.957, which is what `surface/primary/default` resolves to; radius 4). Code uses `bg-surface-primary` and `rounded-card-inner` (also 4px). A resolved value is not a binding: confirm in Figma.
- Bar height 26 and gap 4 are unbound (`h-6.5`, `gap-stack-xs` chosen for the pixels).

## Gotchas
- Figma draws no animation. The shared `animate-breathe` of the loading skeletons (`design/notes/Skeletons.md`) is reused so a pending import reads like the other skeletons, with `motion-reduce:animate-none`.
- Accessibility: one `role="status"` announcement (`components.recipeImport.skeleton.loadingLabel`); all visual parts are `aria-hidden`.
