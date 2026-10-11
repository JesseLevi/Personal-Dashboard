# Tag
Figma: `Tag` component set · node `3626:4515` · Code: `components/atoms/Tag.tsx`

## Anatomy
Inline-flex pill, fixed `h-10`, `px-component-md`, `rounded-control`, `text-base font-semibold`. Figma's `Color` axis maps to a semantic `variant` instead of colour names:

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
- Padding and radius were converted to tokens after reading `boundVariables` on every `Color` variant: `px-component-md` (`spacing/component/padding-md`), `rounded-control` (`radius/control`). (#205)
- Anti-squeeze `shrink-0` is consumer-owned, not an atom class: only CardContentIngredient shares a horizontal flex row with growing text (it passes `className="shrink-0"` and `min-w-0` on the sibling). CardContentTicket and CardContentStep stack Tags on their own `flex-wrap` row. Detail in `design/notes/CardContentIngredient.md`. (#222)

## Token gaps and flags
- `gap-2` (8 px) stays raw, marked `spacing-flag:` in the code: the node binds `itemSpacing` to Figma variable `spacing/mini`, which `design/tokens.json` does not mirror. Its value equals `inline-sm` and `component-sm`, but those are different variables and must not be aliased by value. (#205, #218)
- Figma per-instance sample text (e.g. Blue says "Mid", Grey "300 gr") is leftover canvas content, not a binding to the `Color` axis; never use it as a naming signal.

## Gotchas
- `Architecture.md` section 4.2 still documents `urgent|medium|mid|low`; a user-confirmed scope gap (architecture is not this layer). Flagged, not resolved here. (#97)
- Card `all-content-types` and `CardContentTicket` stories render `variant="medium"` Tags; their visual baselines show blue instead of the old orange until regenerated. (#97)
