# Card-content/Step

- **Code:** `components/molecules/CardContentStep.tsx`
- **Node ID:** `3695:3941`

Built #22. Single COMPONENT, no variant/state axis (one boolean + text + a slot) — no CVA, clsx merges className, same as Card/Step. TEXT 'Mash the banana...' -> `text` (required, caller-supplied step copy, no i18n key needed — same reasoning as CardContentRecipe's name/duration). Boolean 'Ingrediënten tags' (Figma default true) -> optional `withIngredientTags` prop, default true, purely gates the SLOT 'Slot' region's visibility. SLOT 'Slot' -> `children` per CLAUDE.md's SLOT->children rule.

## FLAGGED GAP

the fetched SLOT has no nested instance at all (confirmed both in the raw node data and by downloading the node's own PNG — it renders with the tag row empty even though the boolean's default is true), unlike Card-content/Ingredient's node which nests a real Tag instance. So this molecule does not import/render Atom/Tag itself; the Ladle story fills the slot with `Tag variant="neutral"` as a reasonable composer choice (reusing Card-content/Ingredient's own precedent), not something read off this node. No token gap: TEXT fill stone-950 -> text-text, text-sm/semibold textStyle -> text-sm font-semibold, both existing tokens/pairs. The Step atom is NOT composed inside this file — a numbered step pairs Card's own `step` prop (which already composes Step, see the Card entry above) with a Card-content/Step child side by side, per Card's own node structure; the ticket's 'uses the Step molecule + Tag atom' phrasing describes that Card-level pairing, not this leaf node's contents.

## TICKET #205 (2026-08-12): radius/spacing tokens

Measured via `figma_execute`/`boundVariables` on the fetched node
(3695:3941). Root `gap-4` (16px) → `gap-stack-lg`
(`itemSpacing`→`spacing/stack/stack-lg`); `p-3` (12px, all sides) →
`p-component-md`. "Slot" row `gap-2` (8px) → `gap-inline-sm`
(`itemSpacing`→`spacing/inline/gap-sm` — bound here, unlike
`CardContentTicket`'s own unbound Slot gap).
