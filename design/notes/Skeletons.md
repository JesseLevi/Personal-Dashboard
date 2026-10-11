# Loading skeletons
Figma: file `zg0NCxCB0oZ0IUkaalUTmx` · Recepten board Skeleton/Mobile `4164:25190`, Skeleton/Desktop `4164:25197` · Recipe detail Recept/Mobile `4164:26042`, Recept/Desktop `4164:26088` · Code: `app/(app)/_components/skeletons/{BoardSkeleton,RecipeDetailSkeleton,NoteEditorSkeleton,skeleton-parts}.tsx`

## Anatomy
Not a new component: the real page compositions with data hidden. Used as route `loading.tsx` fallbacks (recepten, recepten/[recipeId], te-doen, notities) and `<Suspense>` fallbacks.
- Figma's opacity 0 maps to Tailwind `invisible` on the real molecule, fed filler from `common.loading`, so each element keeps its natural height and no pixel height is hand-picked. Hidden: column header row, every `Card-content/*`, recipe title, stepper label, step numbers.
- Visible and real: `PageHeader`, `Carousel` of `CardContainer`s, `Card`s with the Type slot on `surface/primary/default` (board) or `surface/secondary/default` (recipe detail).
- Te-doen and Notities have no frame: same board skeleton, route-specific header (todo: board name hidden, chevron/star/sort visible; notes: title, sort, category, search) and that route's own card-content molecule hidden.
- Recipe detail: header row mirrors `RecipeDetailPage`; 2:1 `surface-secondary` hero; one hidden `text-4xl` title line; stepper row as drawn (Minus left, Plus right, per `PortionStepper.md`); Wet 4 / Dry 7 ingredient rows, two steps (second with 3 tags); cards `Title=No` as drawn.
- Note editor: only the back-button row.

## Deliberate decisions
- The visual skeleton is `aria-hidden` + `inert`; one `sr-only role="status"` (`LoadingStatus`) carries `common.loading`. Buttons are the real `Button`, never wired.
- `Card` has `contentClassName` (cn-merged onto the Type slot) so the skeleton can bind `bg-surface-primary` / `bg-surface-secondary`.
- `BOARD_COLUMN_WIDTH` lives in `Carousel.tsx` (a const in a client module would be a reference in a server component) and is shared with `BoardView`. The frames draw 314px columns; the real board is 296/320 and the skeleton uses that so the board does not jump.
- Column header rows are hidden at both breakpoints, although the desktop frame draws them visible: names, counts and icons are data.
- Real counts in two stages. `loading.tsx` and the outer `<Suspense>` render the header only (`BoardSkeleton` without `counts`, no guessed columns). A server component then awaits a count-only query (embedded `cards(count)` / `recipes(count)` / `notes(count)`, own-user filter, position order; `loadTeDoenColumnCounts` resolves the board like `loadTeDoenPageData`) and wraps the full body in `<Suspense fallback={<BoardSkeleton counts>}>`: one column per real column, one card per real card, an empty column keeps its hidden add button. Notities search (`?q=`) stays header-only (flat list). Stories use 4/3/2 as drawn.
- Breathing: `--animate-breathe` (1.6s, opacity 1 -> 0.4 -> 1, ease-in-out, infinite) in `app/globals.css`, `motion-reduce:animate-none`, via `SKELETON_BREATHE`. Tuned from 2.4s/0.55 because short loads made that cycle invisible on the stone-100 page bg. Only skeleton cards, hero, ingredient and step cards breathe; column containers and chrome stay still. No gradient, no translate.

## Token gaps and flags
- `gap-4` header row (Header `itemSpacing` 16, `SPACE_BETWEEN`), `rounded-xl` hero ("image 63", nodes `4164:26050` / `4164:26097`, cornerRadius 12), `gap-6` title block (`4164:26051` / `4164:26098`), stepper row ("Frame 1", `4164:26053` / `4164:26100`) and ingredient row wrapper: unbound in Figma, spacing-flagged in place in `RecipeDetailSkeleton.tsx`.

## Gotchas
- Ladle measurements the skeleton is built to match (402 and 1440px): recipe card 114px equals the real `BoardView` card; recipes columns 540/418/296 equal real-board columns for 4/3/2 cards; todo cards 122, notes cards 82. Recipe detail runs a few px taller than the frames (Wet 277 vs 272, Dry 472 vs 464, steps 62/118 vs 60/116) because the real `CardContentIngredient` row is taller. Mobile frame step text wraps; the filler is one line.

## Open
- `docs/open-questions.md#skeleton-breathe-timing-unsourced`
- `docs/open-questions.md#skeleton-column-header-desktop-visible`
- `docs/open-questions.md#skeleton-predates-recipe-page-v2`
- `docs/open-questions.md#note-editor-skeleton-undesigned`
