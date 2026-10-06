# CategoryPanel

- **Code:** `app/(app)/_components/CategoryPanel.tsx` (shared since #287; `app/(app)/recepten/category-icons.ts` + `app/(app)/notities/category-icons.ts` hold the icon sets; stories: `app/(app)/recepten/CategoryPanel.stories.tsx`, `app/(app)/notities/NoteCategoryPanel.stories.tsx`)
- **Node IDs:** `3891:17997` ("Add column/Mobile"), `3957:11537` ("Pull-up
  panel", desktop). Both fetched fresh for #125 (first tool call, per the
  ticket's own constraint). Not added to `design/figma-map.json` — this is a
  page-level composition of `SidePanel`/`InputField`/`Button` (no new atom),
  same precedent as `BoardPanel.tsx`/`CardDetailPanel.tsx`.

Built #125. Reuses the `SidePanel` chrome exactly as `design/notes/
SidePanel.md` already records (overlay, radii, footer) — no re-measurement.
One component for create+edit (`target.mode`), the same shape
`BoardPanel.tsx`/`CardDetailPanel.tsx` use.

## Reset-on-open, not `BoardPanel.tsx`'s key-remount

Uses `CardDetailPanel.tsx`'s #105 reset-on-render technique (comparing
against state snapshotted from the previous render, not a `useEffect`),
**not** the simpler `key`-per-target remount `BoardPanel.tsx` still carries.
That remount pattern is the one #103/#105 proved buggy: remounting SidePanel
on a target change destroys its already-mounted (closed) dialog node, so the
next open has no previously-painted closed frame to animate from and jumps
straight to open with zero interpolation. `BoardPanel.tsx` was never migrated
off it (its own header comment — "same reasoning as CardDetailPanel's own
`key`" — is now stale, since CardDetailPanel moved away from `key` entirely).
Flagged here, not fixed there: `BoardPanel.tsx` is out of scope for this
ticket, and its own trigger (header only) never hits a target-changing open
the way this panel's two triggers (header "create" + any column's pencil
"edit") do — this panel needed the correct pattern from the start, so it was
built with it rather than inherited the older one.

## Icon picker: all 74 of lucide's "Food & beverage" icons (superseded curation)

Both fetched nodes' `Icon list` (`3891:18524` mobile, `3957:11544` desktop)
are a row of exactly 8 `Button/Default` instances, wrap-gap 12px, all 8
rendering the identical `Icon/Sandwich` (`3632:177`) placeholder — Figma
specifies a *slot count*, not a *list*. The ticket's own Dev Mode annotation
("List all lucide food icons here") is quoted in the ticket body as an
instruction to the builder, not delivered content.

**First pass (this ticket's original merge) shipped a curated 8-icon set**,
reasoning that a 74-icon union expansion on a text instruction alone inverted
`CLAUDE.md`'s "never build what isn't in Figma" rule, and that the 8-slot
layout couldn't hold 74 without inventing a scroll/search UI Figma doesn't
draw. That reasoning still explains why the first version looked the way it
did; it did not survive contact with the actual product decision.

**Superseded 2026-08-01 by direct, explicit user instruction: show all 74.**
This is the user exercising their own authority over their product, not a
ticket ambiguity Claude Code gets to resolve by judgment call — per
`docs/guides/ticket-workflow.md` ("you are not the architecture layer"), a
direct user decision *is* the architecture layer speaking, and is followed
without re-litigating it. What stayed true from the original reasoning, and
is still enforced:

1. **Every icon is verified against the same authoritative source**, not
   assumed from lucide.dev's page text (which doesn't render its icon grid
   server-side — confirmed by fetching it directly and getting no icon
   names back). The list was built from `lucide-icons/lucide`'s own
   per-icon `categories` metadata (GitHub API, one JSON file per icon, e.g.
   `icons/coffee.json` → `"categories": ["food-beverage"]`), which returned
   exactly 74 names — matching the count lucide.dev's own page shows. Every
   PascalCase name was then confirmed as a real `lucide-react` export before
   being added to `Icon.tsx` (`design/notes/Icon.md`).
2. **The layout still needed no new decision.** `SidePanel`'s content area
   already scrolls (`overflow-y-auto`, footer pinned outside it,
   `SidePanel.tsx`) — 74 wrapped icon buttons grow inside existing behaviour,
   not a new one.
3. The open question this raised (`category-icon-picker-curated-set`) was
   resolved by this instruction and has been removed from
   `docs/open-questions.md` — this section is the historical record now.

Full list (`CATEGORY_ICONS` in `CategoryPanel.tsx`, `Icon.tsx`): the original
8 (`Sandwich`, `Croissant`, `CakeSlice`, `Broccoli`, `Coffee`, `Soup`,
`Pizza`, `Cookie`) plus 66 more, alphabetical, covering lucide's full
`food-beverage` category including several non-obvious members their own tags
justify (`Cuboid` = butter/tofu/cheese block, `Torus` = a plain ring/donut
shape distinct from `Donut`, `Tractor` = farming/harvest, `DnaOff` =
GMO-free, `Shell`/`Snail` = shellfish/escargot). Every icon has a distinct,
accurate a11y label in both catalogs (`iconLabels.*`) sourced from the same
per-icon tag metadata, not guessed from the PascalCase name alone — e.g.
`FishOff`/`MilkOff`/`WheatOff` read as "Fish-free"/"Lactose-free"/
"Gluten-free" (their tags say `soy free`/`lactose free`/`gluten free`
explicitly) rather than a literal "no X".

## No Selected state drawn — reused Button's own `aria-pressed` semantics

Every one of the 8 button instances in both fetched nodes is the same
`Style=Filled, State=Default` — Figma draws no visual difference for "this is
the chosen icon." Rather than inventing new styling, the picker sets
`aria-pressed={icon === iconName}` on each `Button variant="filled"`, reusing
the Selected behaviour `docs/design-tokens.md` already documents for Filled
(`aria-pressed:text-text`, text darkens, no fill change) — the same
convention `CardDetailPanel.tsx`'s Status dropdown and `TeDoenHeader.tsx`'s
sort options already use for "this one is currently chosen." Flagged:
`docs/open-questions.md#category-icon-no-selected-state`.

## Delete confirm and name validation — least-inventing precedent reused

Neither is designed (footer only shows the two buttons; the name field's
`Input-field` node carries no error/validation state). Both reuse
`CardDetailPanel.tsx`'s own #94 answers verbatim rather than inventing new
ones, per the ticket's own "kies de minst-uitvindende weg (zelfde precedent
als #94)" instruction:

- **Delete**: two-step confirm (`deleteConfirming` state) — clicking
  "Verwijderen" swaps the footer to a confirm text + Annuleren/Ja,
  verwijderen row, exactly `CardDetailPanel.tsx`'s shape.
- **Name**: `Save` disabled while `name.trim() === ""`, mirroring
  `createCategorySchema`/`renameCategorySchema`'s own `min(1).max(200)`
  (`lib/recipes/schemas.ts`) client-side — no length counter, no duplicate-
  name check (the schema/database don't enforce uniqueness either, so a
  client check would police a rule that doesn't actually exist server-side).

Both flagged: `docs/open-questions.md#category-delete-no-confirm-designed`,
`#category-name-no-validation-designed`.

## Desktop frame's stray duplicate panel — confirmed, not built

`3891:18024` (the ticket's cited desktop frame) also contains `3957:11962`,
a second, unrelated "Add recipe" panel instance sitting on the same canvas —
confirmed by fetching `3957:11537` (the actual category panel node inside
that frame) directly rather than the whole frame, so this file's own node
reads never touched the stray sibling. Not scope; noted here per the
ticket's own instruction so it isn't later mistaken for a second screen this
ticket should have built.

## Server/client split and where PageHeader now lives

`CategoryPanel.tsx` itself never imports `"use server"` code — the composer
(`ReceptenBoard.tsx`) imports `createCategory`/`renameCategory`/
`deleteCategory` from `./actions` directly and passes them down as props,
same convention as `CardDetailPanel.tsx`/`TeDoenBoard.tsx`. `PageHeader`
moved from `page.tsx` into `ReceptenBoard.tsx` in the same ticket — see
`design/notes/ReceptenBoard.md`'s own #125 entry for why (the header trigger
and the column pencil buttons target the same entity and need one shared
client state owner, unlike Te-Doen's Header/Board split).

## Baselines needed the `min-h-screen` harness wrapper — first pass shipped silent

`CategoryPanel.stories.tsx`'s original `CreateCategory`/`EditCategory` (first
committed as part of this ticket) returned `<CategoryPanel .../>` with no
wrapper, following `CardDetailPanel.stories.tsx`'s literal shape — which
turned out to be inheriting a real bug (also open as #106 on
`card-detail-panel`'s own baselines), not a safe precedent. `SidePanel`'s
overlay/panel are `position: fixed`, so they contribute nothing to their
ancestor's normal-flow height. Ladle's own `Provider`
(`.ladle/components.tsx`) already wraps every story in a `min-h-screen` div
for the interactive workbench, but `tests/visual/screenshot-override.css`
deliberately forces that specific wrapper's `min-height` back to `0` for
screenshots (`#ladle-root > div { min-height: 0 !important; }`), so the
baseline crops to real content height, not the full viewport — a story with
no *own* in-flow content taller than a few header pixels collapses to
near-zero. Without a story-level `min-h-screen` div sitting one level below
that overridden wrapper, both baselines shipped at **1280×64** — a strip
containing none of the panel (not the name field, not the 8 icon buttons,
not the footer), byte-identical no matter what changed inside
`CategoryPanel`. Caught in review, not by the gate itself (`pnpm test:visual`
reported "68/68 passed" the whole time — a passing suite that meant nothing
for these two stories).

**Fix:** wrapped `CreateCategory`/`EditCategory` (not `Interactive`, which
legitimately starts closed and is correctly ~viewport-height already) in the
same `<div className="min-h-screen">` `SidePanel.stories.tsx` itself uses —
this inner div sits below the screenshot-override'd outer wrapper, so its own
`min-height: 100vh` is unaffected by that override and gives the flow-height
crop something real to measure against. Regenerated both baselines at
**1280×784**, matching `side-panel--add-item`'s own 784px class exactly.

**Verified the fix is real, not just bigger.** Temporarily removed `"Cookie"`
from `CATEGORY_ICONS` (one of the 8 icon buttons) and re-ran the two scoped
tests without `--update-snapshots`: both **failed** —
`1356 pixels (ratio 0.01 of all image pixels) are different` on each,
`2 failed` in the summary. Reverted the removal and re-ran: both passed
again against the unchanged 784px baselines. This is the actual proof the
64px baselines never could have given — they'd have passed byte-identical
through that same edit, silently.

**Environment note, not a code issue:** regenerating/verifying these locally
required manually killing a leftover `ladle preview` process on port 4310
between runs — `playwright.config.ts`'s `webServer.reuseExistingServer:
!process.env.CI` will happily reuse an already-listening server instead of
rebuilding, so a stale server left over from an earlier run can silently
serve an outdated build to a later `--update-snapshots`/verification pass
(this is what produced a spurious 1280×200 intermediate reading mid-fix,
before the port was found and cleared). Not something this ticket's code
changed or can fix; noted here so a future agent hitting the same "why is my
freshly-edited story still showing the old content" confusion has the actual
cause on record.

## Pixel-parity check — geometry-only, no screenshot compare run

`SidePanel`'s own chrome is already pixel-verified (`SidePanel.md`); this
ticket's only new geometry is the label + wrapping icon row, and both fetched
nodes report their exact layout values directly in the MCP payload (`Icons`
frame: `gap: 8px` between label and row; `Icon list`: `gap: 12px`, `wrap:
true`) — modelled as `gap-2`/`gap-3` respectively, a direct token-scale
match, not an estimate. `download_figma_images` was not additionally run for
a manual screenshot compare on top of that — the Playwright visual-baseline
suite (`pnpm test:visual`) is the actual verification gate for this PR, run
in full per `docs/guides/ui-components.md`.

## i18n

New keys, both catalogs, identical key sets: `components.categoryPanel.*`
(`addTitle`, `editTitle`, `fields.nameLabel`, `fields.iconLabel`,
`saveLabel`/`savingLabel`, `deleteLabel`/`deletingLabel`,
`deleteConfirmLabel`/`deleteConfirmButtonLabel`, `cancelLabel`,
`iconLabels.*` — one accessible name per icon (all 74, see the icon-picker
section above), not one generic "pick an icon" label, per the ticket's
explicit instruction). Wording mirrors
`cardDetailPanel`'s existing save/delete strings exactly (same verbs, same
"..." pending-state convention) for a consistent voice across every
SidePanel-based form. Figma's `"Frodo"` placeholder content and the ticket's
own `"Categorie "` trailing-space source string are correctly **not**
reflected in any shipped string — `components.pageHeader.recipes.
addCategoryLabel` already reads `"Categorie"` (no trailing space, existing
key, reused unchanged) — consistent with `SidePanel.md`'s own "Oplsaan"/
trailing-space precedent from #94/#95.

## Verification — what was and wasn't run

`pnpm lint`/`typecheck`/`test`/`check:server-only`/`check:comment-budget` all
run clean on the final tree (see the PR for exact output). The two
`category-panel` baselines were scoped-verified directly (regenerated at
784px, deliberately broken to confirm a real failure, reverted to confirm a
real pass again — see the entry above). **A clean *full* `pnpm test:visual`
run was not obtained from this worktree**: another agent was running the
same Playwright suite in a parallel worktree on the same machine at the same
time, and the two overlapping runs produced unrelated tiny-pixel-diff
noise/contention rather than real regressions. The full-suite confirmation
was left to the coordinator to run serially once both branches settled,
rather than reported here as green on the strength of a contended run. **Not
run:** a real authenticated `/recepten` route in a browser, and `pnpm
db:reset`/`test:rls`/`check:rls-coverage` — same standing Docker/Supabase gap
every Phase 3/4 ticket hits on this dev machine (`CLAUDE.md`), unchanged by
this ticket (no new table, no migration).

## #219

Raw radius/spacing utilities in this file converted onto `Semantics /
Responsive` tokens, each verified by reading a real Figma node's
`boundVariables` (never inferred from a matching px value — the rule this
ticket exists to enforce, per its own briefing). Both nodes fetched fresh:
`3891:17997` ("Add column/Mobile") and `3957:11537` ("Pull-up panel",
desktop) — same pair `Node IDs` already names at the top of this file.

**Footer button rows (lines 235, 256), `gap-2` → `gap-inline-sm`:**
`SidePanel.tsx`'s "Bottom" footer template (`3779:4858` mobile /
`3779:4950` desktop, `layoutMode: HORIZONTAL`, `itemSpacing: 8`,
`boundVariables.itemSpacing` → `spacing/inline/gap-sm`) is the same shared
structural node `CardDetailPanel.md` (line 165), `BoardPanel.md`,
`IngredientSearchPanel.md` and `StepIngredientPanel.md` all already cite for
their own footer button rows — Figma models one canonical footer per
`SidePanel`, not a per-composer duplicate, and every composer's footer row
reuses that same 8px/`inline-sm` binding regardless of button count. Applies
identically to both of this file's footer rows: the delete-confirming state
(line 235, `Cancel`/`Ja, verwijderen`) and the default state (line 256,
`Verwijderen`/`Opslaan`) — same node, same axis (horizontal row → `inline`),
same value on both breakpoints, no `md:` split needed.

**Label+row wrapper (line 299), `gap-2` → `gap-stack-sm`:** re-measured via
the `figma-console` bridge rather than relying on the existing "Pixel-parity
check" section's prose value alone (that section names the 8px value but no
node-id). The wrapper is Figma's own "Icons" frame — mobile `3957:11251`,
desktop `3957:11542` — `layoutMode: VERTICAL`, `itemSpacing: 8`,
`boundVariables.itemSpacing` → `spacing/stack/stack-sm`. Column axis in both
Figma and code (`flex-col`), so `stack/*` per the axis rule, not `inline/*`
— confirms the existing "Icons frame: gap 8px" note was pixel-correct, now
backed by an actual `boundVariables` read.

**Icon list (line 307), `gap-3` → `gap-x-inline-md gap-y-stack-md`:** the
axis split the previous agent already made and commented in-line (node
`3891:18524` mobile / `3957:11544` desktop). Re-confirmed via the same
bridge call: `layoutMode: HORIZONTAL`, `itemSpacing: 12` →
`spacing/inline/gap-md` (row axis), `counterAxisSpacing: 12` →
`spacing/stack/stack-md` (wrap/column axis). Both resolve to 12px today —
a flat `gap-3` was pixel-identical — but Figma genuinely binds two distinct
variables to the two axes, so the axis rule calls for `gap-x-*`/`gap-y-*`
rather than one token, exactly as the in-line comment already explains.

No new flags in this file for #219 — the two previously-unflagged raw
utilities (lines 235/256's `gap-2`, plus the axis-split `gap-3`) all had a
Figma binding to measure. The delete-step/name-validation gap and the
Selected-state gap this file already flags predate #219 and are unrelated
(no spacing/radius involved).

## #287 — one shared component, Notities history merged in

#287 merged the Notities-owned copy (#232, `NoteCategoryPanel.tsx`, 243 lines)
into this component and moved it to `app/(app)/_components/CategoryPanel.tsx`
(first placed in `components/organisms/`, moved after merging #288 because it
uses `app/(app)/_components/DeleteConfirm.tsx` and organisms may not import
from `app/`). Pure refactor: zero baseline
movement, no key changes in `messages/{nl,en}.json`. What became props:

- `icons` — `CATEGORY_ICONS` (`app/(app)/recepten/category-icons.ts`, the 74
  food icons) vs `NOTE_CATEGORY_ICONS` (`app/(app)/notities/category-icons.ts`,
  14 icons). First entry = create default and fallback.
- `translationNamespace` — `components.categoryPanel` vs
  `components.noteCategoryPanel` (also the `.iconLabels` child);
  `errorsNamespace` — `recipes.errors` vs `notes.errors`.
- Actions — `onCreateCategory`/`onUpdateCategory`/`onDeleteCategory`; Notities
  passes `renameCategory` as `onUpdateCategory` (the prop was
  `onRenameCategory` while the copy existed).
- Types — `CategoryPanelCategory` (`id`/`name`/`icon`) and
  `CategoryPanelActionResult` are structural subsets of the recipe and note
  rows/`ActionResult`s, so the shared file imports nothing from `lib/*`.
- Element id `note-category-panel-name` became `category-panel-name` (no
  other consumer; one panel is mounted per page).
- Stories stay beside their callers (they import each domain's icon set) and
  keep their story ids, so the `category-panel--*` and `note-category-panel--*`
  baselines are unchanged. `NoteCategoryPanel.stories.tsx` renders the shared
  panel with the Notities props.

The #232 decision below ("reuse, not generic") was reversed by this ticket,
as its own last bullet anticipated; the rest of it stays valid history.

## Notities usage (merged from the former NoteCategoryPanel note, #232)

No Figma node of its own: `Pages/Notities/Breakpoints` (`3934:32790`)
contains only the seven overview/editor frames — no category panel. Built by
reusing this panel one-to-one rather than inventing a new shape. Open
question: `docs/open-questions.md#notes-category-panel-not-designed`.

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

Superseded by #287 (see the section below): `/recepten` and `/notities` now share one component.

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

## Server actions — Notities names differ slightly from /recepten's (superseded by #287: now `onUpdateCategory`)

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

## Verification — Notities panel (#232)

Reasoned/typechecked, not run against a live route: this dev machine has no
Docker/local Supabase (`CLAUDE.md`), so create/rename/delete were verified
by reading `app/(app)/notities/actions.ts` + `lib/notes/schemas.ts` and by
typechecking against them, not by clicking through a running app. The
schema itself **is** live: `20260813000001_note_schema` and
`20260813000002_move_note_rpc` are both on hosted (verified against
`supabase_migrations.schema_migrations` during this ticket) — an earlier
draft of this file said otherwise, copying a claim in `NotitiesBoard.md`
that was true when #230 was written and had gone stale by the time
`deploy.yml` ran. Both files are corrected. Production is therefore a real
environment where this panel can be exercised, and it is the first thing
worth doing: the two pre-existing accounts have **zero** `note_categories`
rows (`seed_default_note_categories()` is an `after insert on auth.users`
trigger and never fired for them), so this panel is currently the only way
`/notities` gets a column at all. `pnpm lint`/`typecheck`/`test`/`check:server-only`/
`check:raw-spacing`/`check:comment-budget`/`build` and the scoped +
full `pnpm test:visual` results are reported in the PR, not restated here.
