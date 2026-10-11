# NutritionalDataRow
Figma: `NutritionalData` · node `3997:15948` (mobile, under `Recept/Mobile` `3997:14737`) / `3997:15543` (desktop, under `Recept/Desktop` `3997:15171`); fibre pill `4025:11826` · Code: `app/(app)/recepten/[recipeId]/NutritionalDataRow.tsx`

## Anatomy
A plain FRAME of `Button/Default` pills under the recipe title, not a fetched Figma component (page-level composition, no `figma-map.json` entry, like `RecipeDetailPage`'s Header/Knoppen rows). Six pills in Figma order: Timer (time), Flame (kcal), Wheat (carbs), BicepsFlexed (protein), Droplet (fat), LeafyGreen (fibre), then a seventh servings pill (`User`, disabled). Row: `flex flex-wrap`, wraps to `md:flex-nowrap`. Build history and the seven-pill shape: `design/notes/RecipeDetailPage.md` (#160, #166).

## Deliberate decisions
- Unknown values render "?" (Dev Mode annotation), never a fabricated 0. `null` means unresolvable (unlinked ingredient, unconvertible unit, per_100ml reference row, ADR-0013 §4). Macros go through `roundMacroForDisplay` (whole numbers) and keep `null` as `null`. (#166)
- Each of the first six pills opens a popover naming the full word of the abbreviation. Macro popovers carry the NEVO attribution (ADR-0013 §2); Time does not, since `recipes.time_minutes` is not NEVO data. (#160)
- The servings pill has no Dev Mode annotation, so no dropdown is invented; it renders disabled. (#160)
- Popovers use `lib/dom/use-popover-position.ts` (`anchor="center"`, `prefer="below"`), which centres and clamps into the viewport; no `-translate-x-1/2`. Widths (`w-64` NEVO, `w-40` otherwise) are real Tailwind classes measured live by the hook. (docs/incidents.md, 2026-08-18)

## Token gaps and flags
- Pill row `gap-3` -> `gap-inline-md` (`spacing/inline/gap-md`, `itemSpacing: 12`), same value at both breakpoints. (#219)
- `spacing-flag` x2: the popover is an undesigned state (the frame only shows collapsed pills), so `px-2 py-1` on the full-label heading and `px-2 pb-1` on the NEVO attribution stay raw. The flag must sit directly above the flagged line, because `scripts/check-raw-spacing.sh` stops scanning upward at the first non-comment line; the attribution flag therefore lives inside the `isNevoData &&` block above the `<p>`, not in the ADR-0013 comment above the wrapper. (#219)

## Gotchas
- The NEVO attribution is a legal string (ADR-0013 §2): the same unlocalised English value in both catalogs, never translated or reworded.
