# IngredientSearchPanel

- **Code:** `components/organisms/IngredientSearchPanel.tsx` (+ `.stories.tsx`)
- **Node IDs:** `3957:10309` ("Add recipi/ingredientList/Mobile", canonical in `figma-map.json`), panel `3957:10337`; desktop pair `3957:10595` (frame) / `3957:11006` (the actual desktop panel — `3957:10595`'s own fetch returns the *whole* canvas, which also contains an unrelated, bigger recipe-edit panel at `3957:10596`/`3957:10621`; `3957:11006` is the one structurally matching `3957:10337`, confirmed by its own children: Top/Zoeken/Card/Bottom, byte-for-byte the same content as mobile).

Built #131. Fetched live via `mcp__figma__get_figma_data` before writing any UI, confirming: `Top` (drag handle + close X, already `SidePanel`'s own chrome, not rebuilt here), `Input-field` "Zoeken" (`Title=false`, trailing `Icon/Search`), `Card` wrapping 11 `Card-content/Ingredient` rows (`Checkbox=Unchecked` on every row), `Bottom` footer with a single `Opslaan` `Button` (`variant=filled`, `icon=Save`).

## Naming

`Add recipi/ingredientList/Mobile` has no direct atomic-design translation (not `Organism/<Name>` like `SidePanel`/`Sidebar`). Named for its function, matching the ticket's own suggestion — no better fit was found among the existing organism names.

## Why a `figma-map.json` entry, unlike `CardDetailPanel`/`BoardPanel`

Those two files (`app/(app)/te-doen/`) render one specific, ticket-owned field shape and are explicitly *not* added to the map (see their own notes: "page-level composition... not a new atomic-design leaf"). This component is different: its own content (search field + selectable list + save) *is* the Figma component being built, not an assembly of unrelated fields for one page, and the ticket explicitly asks for the map entry/note file/header/story bundle. Placed in `components/organisms/` rather than `app/(app)/recepten/` for that reason, even though — like `CardDetailPanel` — it never imports `"use server"` code directly (see below).

## Two extensions to `CardContentIngredient` (component change, sourced from this fetch)

The fetched row instances (`componentId=3727:4309`, `Card-content/Ingredient`'s own variant node) carry two properties the existing atom didn't model:

- `componentProperties: {"Tag": false}` on every row — the mock draws **name only**, no quantity chip. `CardContentIngredient`'s `quantity` prop is now optional; the `Tag` only renders when it's supplied. Every existing call site still passes `quantity`, so no other pixel output changes.
- `strokes: #E7E5E4` (`strokeWeight: "0px 0px 1px"`, bottom-only) on every row template, including the last — a per-row divider inside the multi-row `Card`, not present on any single-row usage elsewhere. `#E7E5E4` matches `border-muted` (`design/tokens.json`'s `stone-200`) exactly, no gap. Added as a new optional `divider?: boolean` prop, applied unconditionally per-row (Figma draws it on the last row too — no last-child exception modelled, faithful to source even though it sits flush against `Card`'s own bottom border).

Both are genuine Figma-sourced findings from this ticket's own node, not invented — see `design/notes/CardContentIngredient.md`'s own `#131` entry for the token/measurement trail.

## Callback contract (the ticket's own scope boundary)

Three props, all server actions passed down rather than imported (same "props in, callback out" shape `CardDetailPanel.tsx` uses, and for the identical reason — Ladle's plain Vite runtime has no Next.js request context):

- `onSearch(input: unknown): Promise<IngredientSearchResult[]>` — wired to the new `searchIngredients` action (`app/(app)/recepten/actions.ts`), a thin `"use server"` wrapper around the already-merged `searchIngredientLibrary` (`lib/recipes/queries.ts`, #122). `queries.ts`'s `import "server-only"` guard is import-time only, not an RPC boundary, so a Client Component cannot call it directly — the wrapper is required plumbing, not a stub; its output is 100% real search data.
- `onCreateOwnIngredient(input: unknown): Promise<ActionResult<IngredientRow>>` — the already-merged `createOwnIngredient` (#122), used unmodified.
- `onSave(ingredients: IngredientRow[]): void` — fired once, after every selected row has been resolved to a real `public.ingredients` row (own rows pass through as-is; reference/new selections call `onCreateOwnIngredient` sequentially, stopping at the first failure). Never fired on a plain close/cancel.

Materialisation is deferred to `Opslaan`, not done per-checkbox-click: unchecking a reference/new pick before saving costs nothing, and only actually-saved selections ever write to `public.ingredients` (ADR-0011 §2/§5 — never a `reference` row from the UI). Sequential `await` in the save loop, not `Promise.all`, mirrors this codebase's other "simple over batched" write trade-offs (e.g. `replaceRecipeIngredients`) and gives a clear first-failure error message; selection counts here are small (a hand-curated library), so the latency cost is negligible.

## Selection model

Internal-only `Map<string, SelectedEntry>` keyed by `ingredientSearchResultKey` (`"<own|reference>:<id>"`, exported for callers) or `"new:<lowercased trimmed name>"` for self-added picks. Keying by id (not by current search results) is what makes **multi-search accumulation** work: checking a row while searching "kip", then searching "melk" and checking another row, keeps both checked — nothing is scoped to the currently-visible result list. Reset (query, results, selections, errors) happens on every close (`Opslaan` or cancel), not on open, since there is no `target`-switching prop like `CardDetailPanel`'s to react to.

## Deliberate deviation from Figma: "add as new ingredient" (user decision 2026-07-30)

The fetched node draws **no** affordance for a zero-result search — confirmed by the ticket's own raw REST annotation grep (zero Dev Mode annotations on this node), not assumed from the MCP payload's silence. Built anyway, per explicit user instruction: a row rendered from bare atoms (`Icon="Plus"` + text + `Checkbox`), not through `CardContentIngredient` (which represents a real fetched component, not this invented one). The `Checkbox` is the row's only interactive element — deliberately not wrapped in an outer `<button>`, the same nested-interactive-control problem `docs/open-questions.md#dropdown-row-not-fully-clickable` already flags for a different component. Checking it stages a `{kind: "new"}` selection exactly like a real search result; nothing writes to the database until `Opslaan`.

## Story-determinism props (`initialQuery` / `initialSelectedIds`)

Both are real props with a real future use (a caller reopening the panel with a query/selection already in hand — e.g. #126's name field), not Ladle-only hooks — same precedent as `Dropdown`'s `defaultOpen` and `CardDetailPanel`'s `target`. They are also what makes the "filled results" and "checked rows" Ladle baselines deterministic: this harness (`tests/visual/ladle.visual.spec.ts`) screenshots each story with no scripted interaction, so a debounced, click-driven checked state has no other way to reach a stable baseline frame. `initialSelectedIds` is applied exactly once, against whichever result set first satisfies it, guarded by a ref so it never fights a later manual toggle.

## Debounce (300ms) — codebase default, no design/product source

Same class of unsourced value as `SidePanel`'s drag thresholds (`design/notes/SidePanel.md`'s #103 entry) — a reasonable common default, not read off Figma or confirmed by product. Not escalated to `docs/open-questions.md` for the same proportionality reason the drag thresholds weren't: low product risk, easy to retune later.

**Caller caveat**: `onSearch`/`onCreateOwnIngredient` sit in the debounce effect's dependency array. A caller passing a fresh inline closure on every render would re-trigger the debounce on unrelated re-renders, not just real query changes — pass a stable reference (the imported server action itself, or a `useCallback`), the same way every `CardDetailPanel` mutation prop is already a stable top-level function.

## Consumed dependencies (both already merged, contra the ticket's own contingency note)

`Icon/Search` (#123) and `searchIngredientLibrary`/`createOwnIngredient` (#122) were all already on `main` when this ticket started — built against the real signatures throughout, nothing stubbed. The one genuinely new piece of plumbing is `searchIngredients` (the thin action wrapper described above), added in this PR and flagged, not silently introduced.

## `ilike`, not `pg_trgm` (flagged, not this ticket's to fix)

The ticket text asks for `pg_trgm`-backed search. `searchIngredientLibrary`'s own header comment already documents the gap in full: no migration enables `pg_trgm` or indexes the ingredient name columns, so search runs on escaped `ilike` substring matching instead — functionally correct for the small hand-curated seed, not similarity-ranked. Not re-litigated here; flagged again in the PR body per `CLAUDE.md`'s "flag, don't silently redesign."

## Open questions raised (`docs/open-questions.md`, added by this ticket)

- `ingredient-search-panel-empty-and-zero-result-states-unsourced`

Four more were raised and later closed as self-resolved / no action needed
(mock's duplicate "Citroen" row, the "Halumi" typo, no checked-row example in
the mock, zero Dev Mode annotations on the node) — removed from
`docs/open-questions.md` during its 2026-08-02 cleanup; the underlying facts
are recorded above in this file.

## Ladle stories

`Empty` (no search yet), `FilledResults` (mixed own+reference via `initialQuery="e"`), `ZeroResultsWithAddNew` (`initialQuery="Kaneel"`), `SomeRowsChecked` (same "e" results, Appel+Kipfilet pre-checked via `initialSelectedIds`). Mock `onSearch`/`onCreateOwnIngredient` never import the real action module, matching `CardDetailPanel.stories.tsx`'s precedent.

## TICKET #205 (2026-08-12): radius/spacing tokens

Footer `gap-2`→`gap-inline-sm` (same "Bottom" pattern as
`StepIngredientPanel.tsx`/`RecipePanel.tsx`, `spacing/inline/gap-sm`). The
zero-results "add new ingredient" row (no fetched node, per this file's own
header comment — a deliberate Figma deviation) — `gap-5 rounded-3xl pl-3
pr-3 py-3`→`gap-inline-xl rounded-container pl-component-md
pr-component-md py-component-md`, borrowed from `CardContentIngredient`'s
own measured default-row tokens (design/notes/CardContentIngredient.md's
#205 entry) since this row deliberately matches those pixel-for-pixel to
sit visually consistent among its sibling rows in the same `Card` list —
not an independent Figma measurement, there is no node to measure.

**Left unconverted (no analog):** the inner icon+label `gap-2` and the
no-results message's `px-3 pb-2` — both belong to this same synthetic row
and don't map cleanly onto any single measured node's binding; converting
them would mean guessing from value alone, which this ticket's core rule
forbids.
