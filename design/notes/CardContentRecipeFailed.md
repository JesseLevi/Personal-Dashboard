# Card-content/Recipe failed (Claude-designed on request, #318)

- **Code:** `components/molecules/CardContentRecipeFailed.tsx`
- **Node ID:** none. Not in Figma; the user asked for this state explicitly on #318 ("Claude-designed UI" rule).

Shown in the `Card` slot of a recipe with `import_status = 'failed'`, next to the skeleton in the column.

## Composition

`Card` (existing) > column of: title "Import mislukt" (`text-base font-semibold text-priority-urgent`), source host (`text-sm font-semibold text-text-secondary`, plain text), the short reason (`text-base font-semibold text-text-primary`, i18n from `recipes.import_error` via `recipes.import.errors.<code>`, unknown code falls back to `import_failed`), then two existing `Button`s: filled "Opnieuw proberen" and destructive "Verwijderen" (`Trash`). Spacing tokens only (`gap-stack-sm`, `gap-inline-sm`); buttons wrap on a narrow card. No new tokens, no new icon (the retry button has no icon on purpose: the Icon vocabulary has no refresh glyph and none was invented).

## Behaviour

- Retry = `retryRecipeImport`: new `importing` row with the same `source_url` and category at the top, then the failed row is deleted. Counts against the 20/hour limit (issue comment 2026-10-07).
- Delete = the normal `deleteRecipe`.
- A failed card is not navigable (no detail page to open) and shows no thumbnail.
- Visual baselines: `card-content-recipe-failed--timeout`, `--long-texts`, `--busy`.
