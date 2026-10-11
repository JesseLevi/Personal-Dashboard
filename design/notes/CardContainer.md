# Card-container
Figma: `Card-container` · node `3650:1297` (empty state: `Te doen/Desktop/EmptyState` `3878:10175`) · Code: `components/organisms/CardContainer.tsx`

## Anatomy
Kanban column. Real `Card` instances are composed as Figma nests them (Card-container > Card > Card-content/*), not re-implemented.
```
root (column, bg-surface-secondary, rounded-container, px-component-md pb-component-md, no top padding)
├─ header row (items-center, justify-between, px-component-sm)  — Figma frame "Carousel details"
│  ├─ Info (h-12, gap-inline-lg): Icon · name · count
│  └─ Edit (h-12, gap-inline-sm, justify-end): Button filled icon-only Plus (+ optional addMenu) · Button filled icon-only Pencil
└─ Content SLOT (column, flex-1, gap-stack-sm, justify-center) -> emptyState ?? children
```
Name / Hoeveelheid text props -> `name` / `count`. No variant/state axis, so no CVA (`cn` merges className). Root width is Figma `contextual`, rendered `w-full`; the column width itself is owned by `Carousel` (`columnWidthClassName`). Content SLOT fill/fill -> `flex-1`. Colours: name `text-primary`, icon and count `text-secondary`.

## Deliberate decisions
- `icon` is a real prop (`IconName`, default `"Croissant"`, the icon baked into the fetched instance). The node has no icon variant axis, but every page instance overrides it per column (Te-Doen: Ideeen `Lightbulb`, Klaar `AlarmClockCheck`, Bezig `Loader`, Afgerond circle-check); which icon a real column gets is `board_columns` data, not this component's decision. (#87)
- Both header buttons are always rendered, so `addLabel` / `editLabel` are required composer-supplied props (messages `components.cardContainer.*`). The leaf stays a Server Component with no next-intl import. (#75)
- `emptyState?: ReactNode` is an explicit prop, not inferred from empty `children` (`children` is optional; render is `emptyState ?? children`). The composer builds the whole node including its i18n (typically `<Button variant="white" icon="Plus">` with "Voeg item toe"); the component assumes nothing about what "empty" or "add" mean. (#87)
- `items-center` on the Content wrapper is applied only when `emptyState` is set: Figma's empty Content SLOT is `alignItems: center` versus the filled state's `stretch`. Keeps the filled layout unchanged. (#87)
- `addMenu` is rendered inside a `relative` wrapper around the Plus button (Figma dropdown `4164:23627`, "Via link / Handmatig"); the composer owns open state and positioning, inert without it. (#318)

## Token gaps and flags
- Root: `rounded-container`, `px-component-md`, `pb-component-md` (`paddingTop` is unbound, hence no `pt-`). Header "Info" `gap-inline-lg`, "Edit" `gap-inline-sm`, Content `gap-stack-sm`. (#205)
- The header row's own `px-component-sm` (bound to `spacing/component/padding-sm`, same token as Button `size=default`) was missed in #205 and fixed. (#218)

## Gotchas
- Icon-only `Button size=default` is a structural 40x40 (`size-10`), fixed in `Button.tsx` (was 36x40 from padding). Do not add a local size override here. (#75)
- The empty-state Figma instances measure 312x160, a third width next to the filled 296 (mobile) / 320 (desktop). The width is `Carousel`'s call, not this component's; unresolved.
