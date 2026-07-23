# Card-container

- **Code:** `components/organisms/CardContainer.tsx`
- **Node ID:** `3650:1297`

Built #23. Kanban column: header row (Name/Hoeveelheid text props -> `name`/`count`) + SLOT 'Content' -> `children`, composing real `Card` instances exactly as Figma nests (Card-container > Card > Card-content/*), not re-implemented. `componentPropertyDefinitions` on the node lists only Name/Hoeveelheid, so the header's Croissant icon and the two Edit-row buttons are fixed chrome, not props — no variant axis exists for them in the fetched node. Edit row reuses `Atom/Button` exactly as fetched (variant=filled, icon-only Plus/Pencil, default size), not re-implemented.

## Additional facts (moved from component doc comment, comment-shrink pass)

Fetched Figma structure (node 3650:1297), mirrored 1:1 — this was the first file in `components/organisms/` to import from `atoms/`:

```
root (column, bg stone-200, radius 24px, padding 0px 12px 12px)
├─ "Carousel details" (row, fill width, hug height, px-2, justify-between)
│  ├─ "Info" (row, gap-4, hug width, fixed h-12)
│  │  ├─ IMAGE-SVG "Icon/Croissant" — fixed, not a variant
│  │  ├─ TEXT — `Name` prop -> `name` (text-base/semibold, text)
│  │  └─ TEXT — `Hoeveelheid` prop -> `count` (text-base/semibold, text-muted)
│  └─ "Edit" (row, gap-2, hug width, fixed h-12, justify-end)
│     ├─ INSTANCE "Atom/Button" (Icon/Plus)  -> composed `Button`
│     └─ INSTANCE "Atom/Button" (Icon/Pencil) -> composed `Button`
└─ SLOT "Content" (column, fill/fill, gap-2, justify-center) -> `children`
```

The header row frame is Figma-named "Carousel details" — a naming leftover from when this component's own parent frame (now built as the `Carousel` organism, node 3670:1976) didn't exist yet. `Carousel.tsx`'s own note cross-references this.

No variant/state axis on this node (only the two text properties), so no CVA — `clsx` merges the caller's `className`, same treatment as `Card`/`Step`.

## FIXED for ticket #75 (2026-07-21)

the fetched instance is a square 40x40 (re-confirmed by re-fetching 3650:1297 — the two Edit instances resolve to standalone component Atom/Button/Icon/Default/No, 3623:4352, a fixed 40x40 box, content centred, same fill as variant=filled), but Button.tsx's icon-only default size previously rendered 36x40 (verified by rendering to static markup and reading the resolved utility classes, no headless browser in this repo: pl-2 8px + Icon 24px + pr-1 4px = 36; the icon wrapper's own pr-1 is conditional on children per #69 and never applies icon-only) — 4px short of Figma's width only, height already matched at h-10. Same bug class #69 already fixed for size=compact (emergent-from-padding footprint, not structural); size=default icon-only got the same treatment this ticket: it now resolves internally to a structural size-10 justify-center (not exposed on the public size prop), matching Figma's 40x40 exactly. Fixed at the atom, not here — this molecule needed no change. Both buttons are always rendered (not gated by a bool), so their aria-labels are required composer-supplied props (`addLabel`/`editLabel`, messages `components.cardContainer.*`), same division of responsibility CardContentIngredient's `deleteLabel` established — this leaf stays a Server Component with no next-intl import of its own. No token gaps: root fill stone-200->surface-raised, Name fill stone-950->text, count fill stone-500->text-muted. The Croissant icon carries no fill override on this instance; fetched the icon component itself (node 3628:406) rather than guessing and confirmed its own baked-in stroke is stone-500->text-muted. Root sizing is Figma `contextual`/`contextual` (no real parent yet — Carousel organism is unbuilt), rendered `w-full` per the same call Card.tsx's doc comment already made for its own contextual width; Content SLOT's fill/fill sizing -> `flex-1`, same translation CardContentRecipe's fill/fill frame used.
