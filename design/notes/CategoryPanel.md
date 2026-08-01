# CategoryPanel

- **Code:** `app/(app)/recepten/CategoryPanel.tsx`
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

## Icon picker: 8 curated icons, not the ticket's literal "all 74"

Both fetched nodes' `Icon list` (`3891:18524` mobile, `3957:11544` desktop)
are a row of exactly 8 `Button/Default` instances, wrap-gap 12px, all 8
rendering the identical `Icon/Sandwich` (`3632:177`) placeholder — Figma
specifies a *slot count*, not a *list*. The ticket's own Dev Mode annotation
("List all lucide food icons here") is quoted in the ticket body as an
instruction to the builder, not delivered content — the ticket itself frames
this as unresolved and asks for a curated, justified set instead of a literal
74-icon build.

**Decision: build the 8 slots Figma actually draws, filled with a curated
8-icon set, not 74 new `IconName` entries.** Reasons, in order:

1. **The layout doesn't hold 74.** A wrapping row of 8 buttons is what both
   fetched nodes show; nothing in either node models a scrollable/paginated/
   searchable list that could hold 74 without a new layout `CLAUDE.md`
   forbids inventing ("never build UI that doesn't exist in Figma yet").
2. **`Icon.tsx`'s `IconName` union is a verified, Figma-sourced vocabulary**
   (`docs/guides/ui-components.md`: "every entry verified against rendered
   SVG structure, not name alone... same-named exports can be false
   friends"). Every existing entry traces to a real Figma vector that was
   fetched and shape-compared. None of the 74 lucide food icons (bar the one
   already-present `Sandwich`) has a Figma vector behind it here — Figma only
   ever draws the placeholder — so a 74-icon addition would be 70 new union
   members added on a text instruction alone, the exact inverse of the "never
   build what isn't in Figma" rule this codebase otherwise enforces strictly.
3. **Precedent for a curated subset already exists in this same file's
   history** — `docs/open-questions.md#unit-dropdown-list-not-drawn` records
   the *reverse* situation for the unit dropdown (a Dev Mode annotation names
   4 examples + "etc.", and the codebase shipped a fuller 17-code list as a
   flagged, user-ratified decision) — here the situation is symmetric: the
   annotation asks for "all", the codebase ships a smaller, justified,
   flagged set instead, for the reasons above.

Curated set (`CATEGORY_ICONS` in `CategoryPanel.tsx`): `Sandwich`,
`Croissant`, `CakeSlice`, `Broccoli` (already valid `IconName` members — the
first three are also `seed_default_recipe_categories()`'s own seeded icons,
so editing any seeded category always finds its icon in this list) plus four
newly added (`design/notes/Icon.md`'s own #125 entry has the verification
reasoning): `Coffee`, `Soup`, `Pizza`, `Cookie` — chosen to span
breakfast/drink, lunch, dinner and dessert/snack rather than 8
near-duplicates. Flagged for a design/product answer:
`docs/open-questions.md#category-icon-picker-curated-set`.

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
`iconLabels.*` — one accessible name per curated icon, not one generic "pick
an icon" label, per the ticket's explicit instruction). Wording mirrors
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
