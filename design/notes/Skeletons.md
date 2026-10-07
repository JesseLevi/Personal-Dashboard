# Loading skeletons

- **Code:** `app/(app)/_components/skeletons/{BoardSkeleton,RecipeDetailSkeleton,NoteEditorSkeleton,skeleton-parts}.tsx` (replace the old `PageSkeleton.tsx`)
- **Node IDs:** Skeleton/Mobile `4164:25190`, Skeleton/Desktop `4164:25197` (Recepten board); Recept/Mobile `4164:26042`, Recept/Desktop `4164:26088` (recipe detail). File `zg0NCxCB0oZ0IUkaalUTmx`.
- Used as route `loading.tsx` fallbacks (6) and `<Suspense>` fallbacks (4 pages).

## What the frames are

Not a new component: the real page compositions with data hidden. Fetched via the figma-console bridge (`boundVariables` read). Visible and real: `PageHeader` (title + filled "Categorie" Button), `Carousel` (`spacing/inline/gap-lg`) of `Card-container`s (`radius/container`, `surface/secondary`, `padding-md`), `Card` instances whose Type slot is `surface/primary/default` + `Stroke/primary/default` (board) or overridden to `surface/secondary/default` (recipe detail). Hidden at **opacity 0** (kept in layout): the column header row (48px), every `Card-content/*`, the recipe title text, the stepper label, the step numbers. Code maps opacity 0 to Tailwind `invisible` on the real molecule, fed filler text from `common.loading`, so each element keeps its natural height; no pixel heights are hand-picked.

## Decisions

- **Interactivity:** the visual skeleton is `aria-hidden` + `inert`; one `sr-only role="status"` carries `common.loading`. Buttons are the real `Button`, never wired.
- **Card surface:** `Card` gained `contentClassName` (cn-merged onto the Type slot) so the skeleton can bind `bg-surface-primary` / `bg-surface-secondary`. Story `SurfaceOverride`.
- **Column width:** `BOARD_COLUMN_WIDTH` moved from `BoardView` to `Carousel.tsx` (a client module's const would be a reference in a server component) and is shared. Frames draw 314px columns; the real board is 296/320, which the skeleton uses so the board does not jump.
- **Column headers** hidden on both breakpoints (`skeleton-column-header-desktop-visible`). Card counts per column 4/3/2 as drawn.
- **Te-doen / Notities** have no frame: same board skeleton, route-specific header (todo: board name hidden, chevron/star/sort visible; notes: title, sort, category, search visible) and that route's own card-content molecule hidden.
- **Recipe detail:** header row mirrors `RecipeDetailPage` (basket label, desktop edit/delete, mobile ellipsis); hero is 2:1 `surface-secondary` radius 12 (unbound in Figma, spacing-flagged); title one hidden `text-4xl` line; stepper row as drawn (Minus left, Plus right, as `PortionStepper.md` decides); Wet 4 / Dry 7 ingredient rows, two steps (second with 3 tags). `Title=No` cards as drawn (see `skeleton-predates-recipe-page-v2`).
- **Note editor:** only the back-button row (`note-editor-skeleton-undesigned`).
- **Breathing:** `--animate-breathe` (2.4s, opacity 1 -> 0.55 -> 1, ease-in-out, infinite) via `@theme` in `app/globals.css`, `motion-reduce:animate-none`. Applied to column containers, hero, ingredient/step cards only; chrome stays still. No gradient, no translate. Unsourced: `skeleton-breathe-timing-unsourced`.

## Measurements (Ladle, 402 and 1440px)

Recipe card 114px (Figma 112 + 2px border) equals the real `BoardView` card; recipes columns 540/418/296 equal real-board columns for 4/3/2 cards (418 and 296 identical to the `recipe-generic` story). Todo cards 122, notes cards 82, same as their real molecules. Recipe detail: Wet card 277 (Figma 272), Dry 472 (464) because the real `CardContentIngredient` row is a few px taller than the frame's; step cards 62 / 118 (Figma 60 / 116 desktop). Mobile frame step text wraps (80 / 252); the filler is one line.

## Spacing flags

`gap-4` header row, `rounded-xl` hero, `gap-6` title block / stepper row / ingredient row wrapper: unbound in the fetched nodes, flagged in place.
