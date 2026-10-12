# Avatar
Figma: avatar frame inside node `4231:16052` (`4231:16053`, 32×32) · Code: `components/atoms/Avatar.tsx`

## Anatomy
- A round photo (`<img>`) when `src` is set, otherwise a letter fallback (`<span>`). `src` is a plain URL; the component knows nothing about storage.
- Fallback: a circle with `border border-stroke-primary`, fill `bg-surface-secondary-hover`, and ONE letter (`initialFor`: first letter of the first word of the name, uppercase), `text-xs font-semibold text-text-secondary`. Exported from the atom.
- **`avatar_url` is null for every account** until an upload flow exists, so the letter fallback is the default rendering.
- One variant axis, `size`; both sizes are `rounded-full`:

| `size` | Where | Box |
|---|---|---|
| `md` (default) | Sidebar account row | 40×40 |
| `sm` | `AvatarGroup`, Figma `4231:16052` | 32×32 |

## Deliberate decisions
- **The border is a user addition on top of Figma**, which shows only photos. It also separates overlapping circles in `AvatarGroup` (the fill is opaque).
- **Round everywhere**, photo and fallback, both sizes.
- **Always decorative**, the Sidebar contract: image `alt=""`, fallback `aria-hidden`. The person's name is always rendered next to the avatar, so it is the accessible name.
- Image has `loading="lazy"` and explicit `width`/`height` matching the size.
- New component by exception (ADR-0034): no existing component renders a person.

## Token gaps and flags
- The fallback fill is an unbound Figma fill `#D6D3D1`, an exact match for `surface-secondary-hover`.
- The border uses the existing `stroke-primary`; no new token.

## Gotchas
- Plain `<img>`, not `next/image`, as in the Sidebar before the move.
- The letter is the first character of the name's first word; pass the full name or the first name.

## Open
None.
