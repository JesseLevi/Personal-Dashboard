# AddRecipeMenu ("Via link / Handmatig")

- **Code:** `app/(app)/recepten/AddRecipeMenu.tsx` (page-level composition, not in `figma-map.json`)
- **Node IDs:** `4164:23627` desktop, `4164:23731` mobile (Section `4164:20621` "Pages/Recepten/Add recipi")

Built #318. Fetched: labelless `Dropdown` (209x92, `radius/control-outer`, `surface/highlight/white`, `Stroke/primary`, `padding-xs`, `gap-xs`; its "Field" title hidden) holding two `Button` Style=White rows: `Icon/Globe` "Via link" and `Icon/Pencil` "Handmatig". It sits ABSOLUTE in `Main`, top-left over the column's first card, right edge about 6px past the Plus button.

Code: rendered through `CardContainer`'s new `addMenu` slot inside the Plus button's `relative` wrapper (`BoardView.renderAddMenu`), positioned with `usePopoverPosition` (anchor right, prefer below, like the recipe detail overflow menu). Closes on outside pointer down, Escape, or either choice. The Plus button toggles it.

- `Globe` was added to the Icon atom (Figma `Icon/Globe`: 20x20 circle at 2,2, 8x20 meridian at 8,2, 20x0 equator at 2,12, matching lucide `Globe`). This moves the `icon--all-icons` baseline; it was NOT regenerated here (see #318 report): regenerate it on the next full baseline run.
- Mobile uses the same markup (the frame differs only in viewport).
