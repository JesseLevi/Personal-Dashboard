# PlanDrawer
Claude-designed (#487), ADR-0037 §8, no Figma node · Code: `components/organisms/PlanDrawer.tsx` · Recipes tab content: `app/(app)/agenda/PlanRecipeList.tsx` (page-level, not a component) · Pure helpers: `lib/agenda/plan-recipes.ts`, `lib/agenda/meals.ts`

## Why a new component
Nothing existing holds a tabbed, scrolling tray of draggable things: `SidePanel` is a modal overlay (it covers the calendar the items are dragged onto), `Carousel` and `CardContainer` are board columns. The drawer is one frame (`Card` surface tokens) with a `ButtonToggle` as tab switch and a scroll area; everything inside is existing components.

## Anatomy
- Shell: `rounded-card border border-stroke-primary bg-surface-highlight-white p-component-sm`, a `ButtonToggle` (`CookingPot` Recepten, `Columns3` Kaarten) and a scroll area (scrollbar hidden, like `Carousel`). The caller gives it a height (`className="h-full"` inside `AgendaBody`'s drawer slot).
- Placement: `AgendaBody` puts it beside the calendar from `md` (`md:w-80`, same height as the calendar) and under it below `md` (`h-[32rem]`, the page scrolls).
- **Contract for #488 (Kaarten)**: `PlanDrawer` takes `recipes: ReactNode` and an optional `cards?: ReactNode`. #488 passes its card list as `cards`; until then the tab shows `components.planDrawer.cardsEmpty`. The tab state is internal (`defaultTab`). Make each draggable card row with `useAgendaDraggable(ref, { type: "card", id, title, durationMinutes })`; `AgendaPage.handleExternalDrop` already ignores `type: "card"` and is where #488 adds the planned-card branch (`drop.start.slice(0, 10)` is the day). Reuse `PlanChoices` for a tap alternative to dragging, and the row shape of `PlanRecipeRow` (bordered `rounded-control-outer` row, compact content, icon-only plan button).
- Recipes tab: search `InputField` (leading `Search`, clear `X`), category select `InputField`, a drag hint, then rows. A row is `CardContentRecipe compact` plus an icon-only `Calendar` button that opens `PlanChoices` in a portalled `Dropdown` (`usePopoverPosition` `strategy: "fixed"`, because the tray scrolls). The whole row is the drag handle (`useAgendaDraggable`, long press on touch).

## Deliberate decisions
- Dragging is never the only route: the plan button works with keyboard and touch where a drag from a tray under the calendar is awkward. Drag and button both create the meal through `createMealPlan`.
- Recipes with `import_status` other than `done` are not offered. The server page presigns card thumbnails and passes `thumbnailPath` so the row can fall back to the thumbnail route (as `ReceptenBoard`).
- The tab control is a `ButtonToggle` (radio semantics), not a tablist: the project has no tabs component and a toggle is the existing segmented control. Panels are not `role="tabpanel"`.
- Search ignores case and accents (`filterPlanRecipes`); the category filter is a native select like the other forms.

## Token gaps and flags
- `md:w-80` and `h-[32rem]` are layout sizes, not scale values.
- Recipe thumbnails in `compact` are 48px (`h-12 w-12`), a size outside the spacing scale; see `CardContentRecipe.md`.

## Gotchas
- Switching tabs unmounts the inactive list, so its draggables are destroyed and re-created (the hook handles both).
- The popover and the Ladle story `plan-drawer--plan-menu-open` click the plan button on mount; the popover renders in `body`, outside the story root, and is still inside the screenshot region.
