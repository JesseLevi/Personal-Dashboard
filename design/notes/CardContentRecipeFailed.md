# Card-content/Recipe failed
Claude-designed on request (#318) · Code: `components/molecules/CardContentRecipeFailed.tsx`

## Anatomy
Not in Figma. Shown in the `Card` slot of a recipe with `import_status = 'failed'`, next to the skeleton in the column. Column of: title "Import mislukt" (`text-base font-semibold text-priority-urgent`), source host (`text-sm font-semibold text-text-secondary`, plain text, never markup), the short reason (`text-base font-semibold text-text-primary`), then two existing `Button`s: filled "Opnieuw proberen" and destructive "Verwijderen" (`Trash`). Spacing tokens only (`gap-stack-sm`, `gap-inline-sm`); buttons wrap on a narrow card. No new tokens.

## Deliberate decisions
- The retry button has no icon on purpose: the Icon vocabulary has no refresh glyph and none was invented (#318).
- The reason is i18n from `recipes.import_error` via `recipes.import.errors.<code>`; an unknown code falls back to `import_failed` (#318).
- A failed card is not navigable (no detail page) and shows no thumbnail (#318).

## Gotchas
- Retry = `retryRecipeImport`: inserts a new `importing` row with the same `source_url` and category at the top, then deletes the failed row. It counts against the 20/hour import limit. Delete = the normal `deleteRecipe`.
- Visual baselines: `basis--kaarten--card-content-recipe-failed--timeout`, `--long-texts`, `--busy`.
