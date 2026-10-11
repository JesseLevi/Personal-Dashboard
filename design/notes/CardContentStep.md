# Card-content/Step
Figma: `Card-content/Step` · node `3695:3941` · Code: `components/molecules/CardContentStep.tsx`

## Anatomy
Single COMPONENT, no variant/state axis, so no CVA; `cn` merges `className`.
- TEXT -> `text` (required, caller-supplied step copy; no i18n key, same reasoning as CardContentRecipe's name/duration).
- Boolean "Ingrediënten tags" (Figma default true) -> `withIngredientTags`, default true. It only gates visibility of the slot region.
- SLOT "Slot" -> `children`.
- Root `flex-col gap-stack-lg p-component-md`; slot row `flex-wrap gap-inline-sm`; text `text-sm font-semibold text-text-primary`.

## Deliberate decisions
- This molecule does not render `Atom/Tag` itself. The fetched SLOT contains no nested instance (checked in the raw node data and the node PNG; it renders empty even with the boolean true), unlike Card-content/Ingredient. The Ladle story fills the slot with `Tag variant="neutral"` as a composer choice, not something read off the node. (#22)
- The `Step` badge is not composed here. A numbered step pairs `Card`'s own `step` prop with a Card-content/Step child side by side (see `design/notes/Card.md`). (#22)

## Token gaps and flags
- Root gap 16px -> `gap-stack-lg` (`itemSpacing` -> `spacing/stack/stack-lg`); padding 12px -> `p-component-md`; slot row gap 8px -> `gap-inline-sm` (`spacing/inline/gap-sm`, bound here, unlike CardContentTicket's unbound slot gap). (#205)
