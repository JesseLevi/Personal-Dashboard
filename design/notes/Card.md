# Card
Figma: `Card` component set · node `3997:25430` (V2; `3624:4448` is its "Title=No" variant, `3997:25431` is "Title=Yes") · Code: `components/molecules/Card.tsx`

## Anatomy
```
root (column, gap-stack-md, w-full)
├─ title row (only if title || settings): items-end justify-between gap-3
│  ├─ TEXT title (text-base font-semibold)  — or empty aria-hidden spacer
│  └─ settings slot
└─ "Stap + Card" (row, items-center, gap-stack-md)
   ├─ Step atom instance (optional `step`)
   └─ SLOT "Type" -> children (rounded-card, border-stroke-primary, bg-surface-highlight-white, p-component-sm)
```
Title bool + Text -> `title?: string`; Step bool -> `step?: ReactNode` (real `Step` atom); Settings bool -> `settings?: ReactNode`; SLOT "Type" -> required `children`. No variant/state axis, so no CVA (`cn` merges className). Root width is Figma `contextual`, rendered `w-full`. The "Stap + Card" frame's own 12px radius has no fill/stroke, so it is not modelled.

## Deliberate decisions
- `settings` slot hosts the ingredients Card's Pas-aan trigger: a plain icon-only `Button variant="filled" icon="Settings2"`, right-aligned in the title row. (#160)
- Every fetched instance pairs `Settings=true` with `Title=true`; no `Settings=true, Title=false` is drawn. The title row renders whenever `title || settings` is truthy, with an empty `aria-hidden` spacer replacing a missing title so `justify-between` still right-aligns `settings`. Reason: `RecipeDetailPage` can render an untitled Card (no `group_label`) that must still carry the trigger, plausibly the majority of recipes. A functional extension of a state Figma never drew. (#160)
- `contentClassName` is cn-merged onto the Type slot so a caller can swap its surface; the loading skeletons bind `surface-primary` (board) / `surface-secondary` (recipe detail). See `Skeletons.md`.
- The `AllContentTypes` story shows one Card per built `Card-content/*` molecule; add the next one in the same PR that builds it.

## Token gaps and flags
- Title row `gap-3` (12px, "Title + Button" `itemSpacing`) has no bound variable: stays raw, marked `spacing-flag:`. (#205, #218)
- Root and "Stap + Card" row `gap-3` -> `gap-stack-md`: the row is HORIZONTAL but its `itemSpacing` binds the `stack` family. Read the binding, not the axis. (#205)
- Type slot: `rounded-card`, `p-component-sm`. (#205)

## Gotchas
- `WithSettings` / `WithSettingsNoTitle` stories cover both shapes of the title row.
