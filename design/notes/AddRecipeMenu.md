# AddRecipeMenu ("Via link / Handmatig")
Figma: `Add recipi dropdown/Desktop` node `4164:23627` (mobile `4164:23731`, Section `4164:20621`) · Code: `app/(app)/recepten/AddRecipeMenu.tsx` (page-level composition, not in `figma-map.json`)

## Anatomy
Labelless `Dropdown` (209px wide, its "Field" title hidden) holding two `Button` `variant="white"` rows: `Globe` "Via link" and `Pencil` "Handmatig". Rendered through `CardContainer`'s `addMenu` slot inside the Plus button's `relative` wrapper (`BoardView.renderAddMenu`). Mobile uses the same markup; the frames differ only in viewport.

## Deliberate decisions
- The menu is portalled to `<body>` with `usePopoverPosition` `strategy: "fixed"` (anchor right, prefer below). An empty column is shorter than the menu and the Carousel's `overflow-x-auto` (which also clips `overflow-y`) cut it in half. A hidden anchor `<span>` stays in the wrapper to find the trigger (#309).
- `Globe` was added to the Icon atom from Figma `Icon/Globe` (matches lucide `Globe`) (#318).

## Gotchas
- The outside-pointer check must include the portalled popover as well as the trigger wrapper. Closes on outside pointer down, Escape, or either choice; the Plus button toggles it.
- Story `OpenInEmptyColumn` is the regression baseline for the clipping fix (#309).
- The `icon--all-icons` visual baseline moved when `Globe` was added and was not regenerated in #318; regenerate on the next full baseline run if it still drifts.
