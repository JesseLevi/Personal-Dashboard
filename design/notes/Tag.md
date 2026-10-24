# Tag
Figma: `Tag` component set · node `3626:4515` · Code: `components/atoms/Tag.tsx`

## Anatomy
Inline-flex pill, fixed `h-6` (24 px), `px-component-sm`, `gap-inline-xs`, `rounded-control`, `text-xs font-semibold` (12 px). Optional `icon` renders a leading `Icon` at 14 px; pass it as a prop rather than as a child, so the Tag owns the size. Figma's `Color` axis maps to a semantic `variant` instead of colour names:

| Figma Color | `variant` |
|---|---|
| Grey | `neutral` (default) |
| Red | `urgent` |
| Blue | `medium` |
| Green | `low` |
| Yellow | `highlight` |

`urgent` / `medium` / `low` mirror the card `priority` enum; `neutral` and `highlight` sit outside it.

## Deliberate decisions
- Priority scale is Low / Medium / Urgent (Dev Mode annotation on the Priority field, node `3779:4856`); `medium` took over the blue `mid` used to have, and `mid` was removed outright (tokens `priority-mid(-bg)` deleted, not left dead). (#97)
- Yellow is kept and named `highlight`, not removed and not given a priority-shaped name (`warning`, `attention`): no product decision has assigned Yellow a business meaning, and such a name would invent one. It is backed by `tag-highlight(-bg)` (orange primitives, the pixels `priority-medium` used to hold). (#97)
- **Size deviates from Figma on purpose** (user call, 2026-10-24, #604): Figma's node is 40 px high with `text-base` and `spacing/component/padding-md`. Code is compact: 24 px, 12 px text, `px-component-sm`, `gap-inline-xs`, all existing semantic tokens. `rounded-control` (`radius/control`) is still Figma's binding. Figma has not been updated yet; do not "restore" its values from the node.
- Tag is a label, not a tap target. A caller that makes a Tag clickable, or relied on its old 40 px for row height, gives the row its own height (`CardDetailPanel`'s 40 px Tag rows).
- Anti-squeeze `shrink-0` is consumer-owned, not an atom class: only CardContentIngredient shares a horizontal flex row with growing text (it passes `className="shrink-0"` and `min-w-0` on the sibling). CardContentTicket and CardContentStep stack Tags on their own `flex-wrap` row. Detail in `design/notes/CardContentIngredient.md`. (#222)

## Token gaps and flags
- Figma's `itemSpacing` binds `spacing/mini` (8 px), which `design/tokens.json` does not mirror. Code uses `gap-inline-xs` (4 px) as part of the compact size above, so no raw flag is needed.
- Figma per-instance sample text (e.g. Blue says "Mid", Grey "300 gr") is leftover canvas content, not a binding to the `Color` axis; never use it as a naming signal.

## Gotchas
- `Architecture.md` section 4.2 still documents `urgent|medium|mid|low`; a user-confirmed scope gap (architecture is not this layer). Flagged, not resolved here. (#97)
- Card `all-content-types` and `CardContentTicket` stories render `variant="medium"` Tags; their visual baselines show blue instead of the old orange until regenerated. (#97)
