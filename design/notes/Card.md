# Card

- **Code:** `components/molecules/Card.tsx`
- **Node ID:** `3624:4448` (original single component); `3997:25430` (V2 component set, #160 — `3624:4448` is now that set's "Title=No" variant, `3997:25431` is "Title=Yes")

Props Title (bool)+Text (text) -> `title?: string`; Step (bool) -> `step?: ReactNode` composed via the existing Step atom instance (Figma nests a real Step instance here); SLOT 'Type' -> required `children`. No variant/state axis on the node (booleans + text only) so no CVA — clsx merges className, same as Step. No token gaps: heading #0C0A09->text, slot fill #FFFFFF->surface, slot stroke #D6D3D1->border, all existing tokens. The 'Stap + Card' frame's own 12px corner radius has no fill/stroke so it's a no-op and is not modelled. AllContentTypes story added 2026-07-21 (after merging #66/#67): one Card per built Card-content/* molecule, each showing its own variant axis, so every kind of card content the design system has so far can be compared side by side. Completed 2026-07-21 after #21/#22 merged: all four Card-content/* molecules are represented. Add the next one in the same PR that builds it.

## `settings` slot — #160, the ingredients Card's Pas-aan trigger

V2's Recept pages (`3997:14737`/`3997:15171`) gained a `Settings` boolean on this same component set (fetched instances `3997:25493` mobile / `3998:10755` desktop, `Text="Dry"`/`Settings=true`), rendering a `Button/Default` icon-only trigger in the title row (`I3997:25493;3997:25434`, "Clicking launches #Recept/Mobile/PasAan/Dropdown" annotation) right-aligned against the title. Mapped to a new `settings?: ReactNode` prop — same slot-not-prop-bag idiom `step` already uses.

**Every fetched instance pairs `Settings=true` with `Title=true`** — there is no drawn `Settings=true, Title=false` variant. `RecipeDetailPage.tsx` needs one anyway: its ingredient list can render an *untitled* Card for a `group_label`-less group (`RecipeDetailPage.md`'s own "group_label-less ingredients" entry), and the Pas-aan trigger must still appear on whichever Card carries it (the first ingredient group) even when that Card has no title. Rather than gate the whole title row on `title` alone (which would silently drop the trigger for the common "no groups at all" case — plausibly the *majority* of recipes), the row now renders whenever `title || settings` is truthy; an absent `title` renders an empty `aria-hidden` spacer so `justify-between` still pushes `settings` to the right. A functionally-motivated extension of a state Figma never drew, flagged here rather than silently assumed.

Token/geometry unchanged from the base node: `items-end justify-between gap-3` on the title row (Figma `alignItems: flex-end`), settings button is a plain `Button variant="filled" icon="Settings2"` icon-only instance (bg `#E7E5E4`/text `#79716B` = `bg-surface-raised`/`text-text-muted`, already `filled`'s defaults — no new token needed).

`WithSettings`/`WithSettingsNoTitle` stories added to `Card.stories.tsx` for both shapes.

## Node structure (fetched)

```
root (column, gap-3, hug height, contextual width -> w-full)
├─ TEXT "Titel"          — Title bool (visible) + Text (text content)
└─ "Stap + Card" (row, items-center, gap-3, fill width, hug height)
   ├─ INSTANCE "Step"    — Step bool (visible); reuses Atom/Step as-is
   └─ SLOT "Type"        — always present; the card's content slot
```

Text style: `text-base/semibold` (Figma) -> `text-base font-semibold` per the typography map in design/tokens.json.

## TICKET #205 (2026-08-12): radius/spacing tokens

Measured via `figma_execute`/`boundVariables` on both `Title=No` (3624:4448)
and `Title=Yes` (3997:25431) variants — identical bindings. Root `gap-3`
(12px, VERTICAL) → `gap-stack-md` (`itemSpacing`→`spacing/stack/stack-md`).
"Stap + Card" row `gap-3` → `gap-stack-md` too — this frame is HORIZONTAL
but its `itemSpacing` binds the `stack` family regardless (read the
binding, not the axis: the axis rule is a heuristic, the actual binding is
ground truth). "Type" SLOT: `rounded-xl`→`rounded-card`
(`topLeftRadius`→`radius/card`), `p-2`→`p-component-sm`
(`padding*`→`spacing/component/padding-sm`).

**Left unconverted, flagged:** the title row's `gap-3` ("Title + Button"
frame, itemSpacing 12px) has no bound variable in the fetched node — a real
absence, not a missed lookup.

## TICKET #218 (2026-08-12): spacing gate

`scripts/check-raw-spacing.sh` now enforces an explicit `spacing-flag:`
marker. Added to the existing comment above; no reasoning changed.
