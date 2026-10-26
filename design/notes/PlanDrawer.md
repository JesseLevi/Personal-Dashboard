# PlanDrawer
Claude-designed (#487, #488), ADR-0037 §8, no Figma node · Code: `components/organisms/PlanDrawer.tsx` · Tab content: `app/(app)/agenda/PlanRecipeList.tsx`, `PlanCardList.tsx` (page-level, not components) · Pure helpers: `lib/agenda/plan-recipes.ts`, `plan-cards.ts`, `meals.ts`

## Why a new component
Nothing existing holds a tabbed, scrolling tray of draggable things: `SidePanel` is a modal overlay (it covers the calendar the items are dragged onto), `Carousel` and `CardContainer` are board columns. The drawer is one frame (`Card` surface tokens) with a `ButtonToggle` as tab switch and a scroll area; everything inside is existing components.

## Anatomy
- Shell: `rounded-card border border-stroke-primary bg-surface-highlight-white p-component-sm`, a `ButtonToggle` (`CookingPot` Recepten, `Columns3` Kaarten) and a scroll area (scrollbar hidden, like `Carousel`). The caller gives it a height (`className="h-full"` inside `AgendaBody`'s drawer slot).
- Placement: closed by default ("Plannen" in the Agenda header toggles it, cookie `agenda-tray`). Open, `AgendaBody` puts it beside the calendar from `lg` when the page container is at least 44rem (`w-80`, same height as the calendar) and under it otherwise (`h-[32rem]`, the page scrolls). Closed, it stays mounted, inert and (after the close transition) `visibility: hidden`, so its tab and search survive and it is not focusable. Open and close animate, see `AgendaPage.md` (Plan tray animation).
- Props: `recipes: ReactNode` and an optional `cards?: ReactNode` (without it the tab shows `components.planDrawer.cardsEmpty`). The tab state is internal (`defaultTab`). The root carries `AGENDA_TRAY_ATTRIBUTE` (`data-agenda-tray`): an item dragged from the grid and dropped on it is reported as `onItemDropOut` by `AgendaCalendar`.
- Kaarten tab (`PlanCardList`): a search `InputField`, a drag hint, then the open cards of every board under a board heading (favourite board first, `groupOpenCards`). Open means not in the board's rightmost column, the same rule as the done styling on the board. A row has the same shape as a recipe row: title, a second line with the column (and "gepland op za 17 okt" once planned) and the row itself is the button that opens `PlanChoices showSlot={false}` (see Recipes tab). The row is draggable with `useAgendaDraggable(ref, { type: "card", id, title })`; a drop sets `cards.planned_for` to `drop.start.slice(0, 10)` through `planCard`.
- Recipes tab: search `InputField` (leading `Search`, clear `X`), category select `InputField` and a drag hint stay fixed; only the rows scroll. An optional footer (`weekToBasket`) holds a one-line explanation and a full-width `AnimatedAddToBasketButton` "Week naar mand" (same `onSend` and baskets as the menu item in the header). Rows: a row is `CardContentRecipe compact` in a `rounded-card` box with `p-component-sm`; thumbnail `rounded-card-inner` (12 - 8 = 4, so the radii nest) and 16px between rows. There is no trailing button: the row is `role="button"` (`tabIndex 0`, `aria-haspopup`, `aria-expanded`, `aria-label` "<naam> plannen") and a click, Enter or Space opens `PlanChoices` in a portalled `Dropdown` (`usePopoverPosition` `strategy: "fixed"`, because the tray scrolls; `usePlanMenu` in `PlanRecipeList.tsx`, shared with the cards). A press that moved more than 5px was a drag and never opens it; Escape closes it and returns focus to the row. The whole row is also the drag handle (`useAgendaDraggable`, long press on touch).

## Deliberate decisions
- Dragging is never the only route: the row's own menu works with keyboard and touch where a drag from a tray under the calendar is awkward. Drag and button both create the meal through `createMealPlan`, or set the day of a card through `planCard`.
- Dragging a planned card from the grid back onto the drawer clears its day, from either tab. Clearing is also possible in the card panel.
- Planning a card does not move or change it; the card stays in its column and its day only shows as a yellow planned item in the all-day row.
- Recipes with `import_status` other than `done` are not offered. The server page presigns card thumbnails and passes `thumbnailPath` so the row can fall back to the thumbnail route (as `ReceptenBoard`).
- The tab control is a `ButtonToggle` (radio semantics), not a tablist: the project has no tabs component and a toggle is the existing segmented control. Panels are not `role="tabpanel"`.
- Search ignores case and accents (`filterPlanRecipes`); the category filter is a native select like the other forms.

## Token gaps and flags
- `lg:@min-[44rem]:w-80` and `h-[32rem]` are layout sizes, not scale values.
- A card row has no thumbnail and no tag: title and column only, so a tray of many cards stays scannable.
- Recipe thumbnails in `compact` are 48px (`h-12 w-12`), a size outside the spacing scale; see `CardContentRecipe.md`.

## Gotchas
- Switching tabs unmounts the inactive list, so its draggables are destroyed and re-created (the hook handles both).
- The popover and the Ladle story `agenda--plan-drawer--plan-menu-open` click the plan row on mount; the popover renders in `body`, outside the story root, and is still inside the screenshot region.
