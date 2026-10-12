# Avatar
Figma: avatar frame inside node `4231:16052` (`4231:16053`, 32×32) · Code: `components/atoms/Avatar.tsx`

## Anatomy
- A round image, or an initials fallback (`<span>`) when `avatarUrl` is null or undefined. `initialsFor` (first letters of the first two words) moved here from `Sidebar` and is exported.
- **`avatar_url` is null for every account** (there is no upload flow), so the initials fallback is the default rendering. The image branch exists for a future upload ticket.
- One variant axis, `size`, covering only the sizes in use:

| `size` | Where | Box | Shape |
|---|---|---|---|
| `md` (default) | Sidebar account row | 40×40 | `rounded-control-inner` |
| `sm` | `AvatarGroup`, Figma `4231:16052` | 32×32 | `rounded-full` (Figma radius 99) |

- Fallback fill `bg-surface-secondary-hover`, `text-xs font-semibold text-text-secondary` (carried over from the Sidebar).

## Deliberate decisions
- **Shape is part of `size`**, not its own axis: the two existing uses differ in both and no third combination exists.
- **Always decorative**, the Sidebar contract: image `alt=""`, fallback `aria-hidden`. The person's name is always rendered next to the avatar, so it is the accessible name.
- Image has `loading="lazy"` and explicit `width`/`height` matching the size.
- New component by exception (ADR-0034): no existing component renders a person.

## Token gaps and flags
- The initials fill is an unbound Figma fill `#D6D3D1`, an exact match for `surface-secondary-hover` (also in `design/notes/Sidebar.md`).
- Figma's 32px avatar has no stroke or ring (read from the node): none is drawn.

## Gotchas
- Plain `<img>`, not `next/image`, as in the Sidebar before the move.
- The initials are the first letters of the first two words of the full name, so pass the full name, not a first name.

## Open
None.
