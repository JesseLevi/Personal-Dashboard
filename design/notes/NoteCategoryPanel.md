# NoteCategoryPanel

- **Code:** `app/(app)/notities/NoteCategoryPanel.tsx` (+ `.stories.tsx`)
- **Node IDs:** none. `Pages/Notities/Breakpoints` (`3934:32790`) contains
  only the seven overview/editor frames — no category panel. Built #232 by
  reusing `app/(app)/recepten/CategoryPanel.tsx` (`design/notes/
  CategoryPanel.md`, node ids `3891:17997`/`3957:11537`) one-to-one rather
  than inventing a new panel shape, per the ticket's own instruction and
  `CLAUDE.md`'s "never build UI absent from Figma." Not added to `design/
  figma-map.json` — same precedent `CategoryPanel.md` already records
  (page-level composition of `SidePanel`/`InputField`/`Button`, no new atom).

## Generic `CategoryPanel` vs. a Notities-owned copy — decision already made, motivation recorded here

#232's own ticket asked for this call to be made and motivated. Reused,
not made generic:

- **This codebase has a written precedent for per-domain duplication of
  small, stable helpers and page-owned components.** `NotitiesBoard.tsx`
  duplicates `TeDoenHeader.tsx`'s `useCloseOnOutsidePointerDown` verbatim
  rather than sharing it, and `lib/notes/queries.ts`'s `escapeIlike`
  duplicates `lib/recipes/queries.ts`'s version of the same helper — both
  documented in-place as a deliberate choice, not an oversight. A
  page-scoped category panel is the same class of thing at a larger grain.
- **`/recepten`'s panel carries a recipe-specific 74-icon "Food & beverage"
  picker** (`CategoryPanel.md`'s own icon-picker section) with its own
  curated `iconLabels` catalog. Making `CategoryPanel` generic means either
  (a) parameterising the icon list and label namespace per caller — real
  API surface for a component with exactly two callers today — or (b)
  accepting Notities categories offered food icons, which is wrong. Neither
  is worth it for two call sites.
- **`/recepten` is mid-phase with its own locked-in visual baselines and
  design record.** Any generic-panel refactor edits `CategoryPanel.tsx`
  itself, which means re-running and re-reviewing `/recepten`'s Playwright
  baselines and touching a component this ticket has no reason to touch —
  risk with no product benefit, for a ticket scoped to Notities only.
- **A future generic `CategoryPanel` is a real, defensible ticket** if a
  third domain (e.g. a future Winkelmand category concept) needs the same
  interaction: it would need (1) an icon-list prop instead of a hardcoded
  module constant, (2) a translation-namespace prop instead of a hardcoded
  `useTranslations("components.categoryPanel")` call, (3) a decision on
  where the shared `iconLabels` catalog lives across `messages/{nl,en}.json`
  without duplicating every food-icon label a third time, and (4) migrating
  both existing call sites in the same PR so there is only ever one
  category-panel implementation, not three. Until a third caller exists,
  the two-copy state costs less than that refactor.

`app/(app)/recepten/**` is untouched by this ticket, on purpose.

## Icon set — general-purpose, not food-specific, no Figma source

Figma shows three seeded categories in use (`FolderClosed` "Overig",
`Lightbulb` "Werk", `FolderClosed` "Sport", `20260813000001_note_schema.sql`'s
`seed_default_note_categories()`) but draws no picker of its own — same
"undesigned, choose and motivate" instruction the ticket gives explicitly.
Every entry below already exists in `Icon.tsx`'s `IconName` union; **none was
added to `Icon.tsx` for this ticket** (unlike `/recepten`'s 74-icon set,
which did extend the union in #125).

`NOTE_CATEGORY_ICONS` (`NoteCategoryPanel.tsx`), 14 icons, chosen to cover
plausible personal note-organising categories without reusing an icon that
already carries a different, conflicting meaning elsewhere in this app
(`Pencil`/`Trash`/`Ellipsis`/chevrons/arrows/`X`/`Save`/`Search` are all
excluded for that reason — each is a UI-action glyph on this same page or
a sibling panel, and doubling it as a category icon would read as that
action):

| Icon | Meaning offered |
| --- | --- |
| `FolderClosed` | General/miscellaneous (Figma's own "Overig"/"Sport" choice) |
| `Notebook` | Notes/journal |
| `Lightbulb` | Ideas (Figma's own "Werk" choice) |
| `Scroll` | Documents |
| `Star` | Favourites/important |
| `Calendar` | Planning |
| `Timer` | Time-boxed tasks |
| `AlarmClockCheck` | Reminders/deadlines |
| `CircleCheck` | Done/checklists |
| `ShoppingBasket` | Shopping-related notes |
| `BicepsFlexed` | Sport/fitness |
| `User` | Personal |
| `Shirt` | Wardrobe/style |
| `Image` | Media |

`FolderClosed` is first in the array and is the fallback used both when a
category's stored `icon` isn't one of these 14 (same "sane default" pattern
`CategoryPanel.tsx`'s own `defaultIcon` uses) and as the pre-selected icon in
create mode.

No hex/size was hardcoded to render this list — the picker reuses
`Button variant="filled"` exactly as `CategoryPanel.tsx` does, with no new
styling.

Flagged as a design gap with no Figma source:
`docs/open-questions.md#notes-category-panel-not-designed`.

## Delete flow — cascade, reused confirm, no dialog designed

`notes.category_id` is `not null … on delete cascade`
(`supabase/migrations/20260813000001_note_schema.sql`, verified by reading
the migration directly) — deleting a category deletes every note inside it,
mirroring `recipes.category_id → recipe_categories` exactly (same file's own
comment cites the recipes precedent as the reason it chose cascade). No
Postgres-level guard stops a delete that would remove notes.

No delete confirmation dialog is designed anywhere in this codebase's Figma
file — same gap `CategoryPanel.md`'s "Delete confirm and name validation"
section already documents for `/recepten`. Rather than inventing a new
confirmation shape or a blocking-style warning (which would misrepresent a
cascade as a restrict), this panel reuses `CategoryPanel.tsx`'s own two-step
confirm verbatim: clicking "Verwijderen" swaps the footer to a
`deleteConfirmLabel` sentence ("Weet je het zeker?") + Cancel/"Ja,
verwijderen" row. The confirm text is generic, not cascade-specific
("de notities in deze categorie verdwijnen mee") — the same generic wording
`/recepten`'s panel already ships, reused rather than diverging in the one
place this ticket has no design source to justify a different sentence.
Flagged alongside the icon gap:
`docs/open-questions.md#notes-category-panel-not-designed`.

## Server actions — names differ slightly from `/recepten`'s, not the shape

`app/(app)/notities/actions.ts` (#228) exports `createCategory`/
`renameCategory`/`deleteCategory` — note `renameCategory`, not `/recepten`'s
`updateCategory`. `NoteCategoryPanel`'s props follow the actions'  own
names (`onCreateCategory`/`onRenameCategory`/`onDeleteCategory`) rather than
copying `CategoryPanel.tsx`'s prop names literally, so the composer
(`NotitiesBoard.tsx`) can pass the real action references directly with no
local rename. Payload shapes match `lib/notes/schemas.ts` exactly:
`createCategorySchema` (`name`, `icon`), `renameCategorySchema` (`categoryId`,
`name`, `icon`), `deleteCategorySchema` (`categoryId`) — same
`min(1).max(200)` name bound the client-side `disabled={... name.trim() ===
""}` check mirrors, same convention as `CategoryPanel.tsx`.

## NotitiesBoard wiring

`NotitiesBoard.tsx` gained one `categoryPanel` state
(`{ open, target: NoteCategoryPanelTarget }`), the same independent
open/target convention `ReceptenBoard.tsx`'s own `panel` state already uses
— closing only flips `open`, leaving `target` in place so the close
transition has real content to animate away from. The header's "Categorie"
button (previously a documented no-op, `NotitiesBoard.md`'s own "A
deliberate no-op" section — now stale, see that file's own update) now opens
`{ mode: "create" }`; `BoardView`'s `onEditColumn` (previously left
`undefined`) now opens `{ mode: "edit", category }` for the clicked column.
Both share the one panel instance, same reasoning `ReceptenBoard.md` records
for why its own header trigger and column pencils share one `CategoryPanel`.

## Verification — what was and wasn't run

Reasoned/typechecked, not run against a live route: this dev machine has no
Docker/local Supabase (`CLAUDE.md`), and per `NotitiesBoard.md`'s own
"Verification" section, Notities' schema (#225/#228) has never been applied
to the hosted database either — so there is currently no environment,
including production, where `/notities` could be opened against real
category rows. `pnpm lint`/`typecheck`/`test`/`check:server-only`/
`check:raw-spacing`/`check:comment-budget`/`build` and the scoped +
full `pnpm test:visual` results are reported in the PR, not restated here.
