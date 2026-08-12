# Card-container

- **Code:** `components/organisms/CardContainer.tsx`
- **Node ID:** `3650:1297`

Built #23. Kanban column: header row (Name/Hoeveelheid text props -> `name`/`count`) + SLOT 'Content' -> `children`, composing real `Card` instances exactly as Figma nests (Card-container > Card > Card-content/*), not re-implemented. `componentPropertyDefinitions` on the node lists only Name/Hoeveelheid, so the header's icon and the two Edit-row buttons are fixed chrome on this node, not Figma props — no variant axis exists for them in the fetched node (the icon became a real code-level `icon` prop in #87, see below; page instances already override it). Edit row reuses `Atom/Button` exactly as fetched (variant=filled, icon-only Plus/Pencil, default size), not re-implemented.

## Additional facts (moved from component doc comment, comment-shrink pass)

Fetched Figma structure (node 3650:1297), mirrored 1:1 — this was the first file in `components/organisms/` to import from `atoms/`:

```
root (column, bg stone-200, radius 24px, padding 0px 12px 12px)
├─ "Carousel details" (row, fill width, hug height, px-2, justify-between)
│  ├─ "Info" (row, gap-4, hug width, fixed h-12)
│  │  ├─ IMAGE-SVG "Icon/Croissant" — fixed on this node, `icon` prop since #87
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

## ADDED for ticket #87 (2026-07-23) — `icon` prop + `emptyState` slot

Re-fetched 3650:1297 (unchanged since #75 — still only Name/Hoeveelheid `componentPropertyDefinitions`, icon still fixed chrome on this node) and, for the empty state, `3878:10175` ("Te doen/Desktop/EmptyState"). Both wins over the ticket's own prose where they'd have differed; they didn't.

**Icon inconsistency (confirmed, not this component's problem to solve):** the fetched 3650:1297 node itself has no icon variant axis, but every page instance overrides the icon per column — the EmptyState node alone shows all four Te-Doen columns with distinct icons: Ideeën `Lightbulb`, Klaar `AlarmClockCheck`, Bezig `Loader`, Afgerond `Icon/Circle-check`. `icon` is now a real prop (`IconName`, default `"Croissant"` — the value baked into the originally fetched standalone instance), so callers can pass any of these. **Gap, not fixed here:** `Icon.tsx`'s `IconName` union has no `CircleCheck` entry (checked `components/atoms/Icon.tsx`) — the Afgerond column can't be built with a real icon until that atom gains it. Flagged for whichever ticket wires up the real Te-Doen columns; out of scope for this ticket (`Icon.tsx` is a separate atom, and which icon a real column gets is `board_columns` data per the ticket, not this component's decision either way).

**Empty state:** node 3878:10175's Content SLOT (`I...;3686:1896`) differs from the filled state's Content SLOT (3686:1896 on 3650:1297 directly) only in `alignItems` — `center` vs. the filled state's `stretch` — everything else (fill/fill sizing, gap 8px) is identical. Its single child is a `Button/Default` instance, variant "Style=White, State=Default", `With icon: true`/`With text: true`, `Text: "Voeg item toe"` — i.e. exactly `<Button variant="white" icon="Plus">` from this codebase's existing `Atom/Button`, composed, not reimplemented. Modelled as an `emptyState?: ReactNode` prop (not an inferred-from-`children`-being-empty branch): `children` widened to optional so a composer can pass only `emptyState`; render is `emptyState ?? children`. `items-center` is applied to the Content wrapper only when `emptyState` is set (`className={clsx(..., emptyState && "items-center")}`) so the filled-state layout (Card instances stretching full width) is byte-for-byte unchanged — confirmed via the scoped baseline regeneration below, which only touched the two new stories' PNGs. The "Voeg item toe" text itself is **not** an internal string of this component — same division of responsibility as `addLabel`/`editLabel`: the composer builds the whole `emptyState` node (including its own i18n), this component stays presentational and makes no assumption about what "empty" means or what the button does. The Ladle story sources its label from a new message key, `components.cardContainer.addItemLabel` (`messages/en.json`/`messages/nl.json`), for consistency with the existing `addLabel`/`editLabel` keys — not because this component reads it.

**Empty-state width, flagged not touched:** 3878:10175's `Card-container` instances measure a fixed 312×160 (`layout_b7437a7a` in the fetched payload) — a third width, next to the filled state's 296 (mobile)/320 (desktop). Per `design/notes/Carousel.md`, the 280px column width is owned by `Carousel.tsx`'s wrapper div (`w-70 shrink-0`), not by `CardContainer` itself, and this ticket doesn't touch that division. Reporting the 312px measurement here since it's a real discrepancy against `Carousel.tsx`'s current fixed 280px — unresolved, for a future ticket that wires the empty state into `Carousel`.

No new token gaps: the empty-state `Button` reuses the existing `variant="white"` styling verbatim (see `design/notes/Button.md`), no colour introduced by this ticket.

## TICKET #205 (2026-08-12): radius/spacing tokens

Measured via `figma_execute`/`boundVariables` on the fetched node
(3650:1297). Root: `rounded-3xl`→`rounded-container`
(`topLeftRadius`→`radius/container`), `px-3`→`px-component-md`
(`paddingLeft/Right`→`spacing/component/padding-md`), `pb-3`→
`pb-component-md` (`paddingBottom`, same token; `paddingTop` is unbound —
matches this component having no `pt-` class at all). Header row: `gap-4`
("Info" child)→`gap-inline-lg`; action-button row `gap-2` ("Edit"
child)→`gap-inline-sm`. Content slot `gap-2`→`gap-stack-sm`
(`itemSpacing`→`spacing/stack/stack-sm`, VERTICAL).
