# Open questions awaiting a decision

Design-side gaps where the ticket, the property list, or the token scale promises something the dev-ready Figma node doesn't contain. **Each needs a design or product answer before a follow-up ticket can model it — nobody builds these from guesswork** (`CLAUDE.md`: never build what isn't in Figma).

This is the single canonical list. `docs/design-tokens.md` and `docs/HANDOFF.md` link here rather than restate it, and code comments reference the **slug**, never a number — questions get resolved and removed, and numbering silently reassigns itself to the wrong question when they do.

Reference one as `docs/open-questions.md#<slug>`.

---

## no-pointer-affordance

**No Hover state anywhere in the pointer-affordance family.** Originally three components with no mouse-over feedback; #107 (2026-07-26) resolved one of the three — `Atom/Button`'s Transparent style. The other two are still open.

- **Transparent**: **resolved by #107** — re-fetching `3623:4346` shows Figma now defines real Hover (`stone-100`)/Active (`stone-200`) fills, borrowed from the existing `surface-active`/`surface-raised` tokens (see `docs/design-tokens.md`). No longer an open question for `Atom/Button`.
- **`Button/Toggle`'s segments do NOT inherit it — still open.** They render as `Button variant="transparent"`, so the new fills reached them by composition and had to be suppressed: a segment's background paints *over* the white "Active" indicator (`ButtonToggle.tsx` gives each segment `relative` precisely to stack above it), so on the selected segment Hover greyed the white pill out and Active resolved to `surface-raised` — the track colour — erasing it entirely. Measured in a browser, not reasoned: pressed segment `oklch(0.923…)` vs track `oklch(0.923…)`. Figma backs the suppression rather than the inheritance — `Button/Toggle` (`3623:4345`) is a single component with **no** state axis, its segments pinned to `Atom/Button/Icon/Default/No` with `fills: []`, and the indicator is a real `#FFFFFF` node. So whether toggle segments should have *any* pointer feedback, and what it may look like without hiding the indicator, is still an unanswered design question.
- **`Card-content/Ingredient`** (node `3727:4021`) still defines no Hover state at all — only `Default | Active | Delete`. Fixed in #67: `Active` now maps to `:active` (not `:hover`/`:focus-within`, which #20 had wrongly used), consistent with the `Active` = "currently being pressed" reading that #56 (`Atom/Button`) and #58 (`Atom/Input-field`) already established for this exact state name. That still leaves an ingredient row where hovering does nothing and only pressing does — needs a design answer, not a code guess.

## button-vs-input-active-border

**Only Active still diverges between `Atom/Button`/Outline and `Atom/Input-field`.** Tickets #56 and #58 left three states open pending Figma reconciliation. #68 re-fetched both nodes (3623:4346, 3705:4402) and confirmed directly rather than assuming: Hover now matches (both stone-500) and Selected now matches (both stone-400, Outline's Selected having gained a border for the first time) — `border-input-hover` and `border-input-selected` are deleted, and `InputField.tsx` reads the shared `border-hover` / `border-selected` tokens.

**Active is the one state that still does not line up**: Input-field's Active is stone-600, Button/Outline's moved to stone-800 (from stone-700) — confirmed side by side in the same fetch, a real, deliberate pixel difference, not a stale or unbound node. `border-input-active` stays under its own name until a future re-fetch either aligns the two values or the user confirms input borders are a genuinely distinct role from button borders. Don't guess: re-fetch and compare exact hex, the way #58 and #68 both did.

Both components' Selected → `:focus-within` (Input-field) / `aria-pressed` (Button) mappings remain each atom's own interpretation of Figma's state *names*, not something Figma's data asserts — still flagged for design confirmation, unchanged from #58.

## token-names-are-hex-derived

**Figma MCP returns resolved hex only, never variable names.** Every semantic token name in `design/tokens.json` is derived by matching a pixel value back to a role, not read from Figma's own variables. The names may need aligning with the real Figma variable names — worth doing before more components are built on this vocabulary and it calcifies further.

## dark-mode-is-placeholder-only

**No Figma dark frames exist for any component**, so every `dark` value in `design/tokens.json` is this codebase's own pick. Known collision: `priority-urgent-bg-hover` and `-active` both resolve to red-950, so the destructive states are invisible in dark mode. Nothing in the Next.js app sets `data-theme` yet — only Ladle does. An app-level theme switch is an open architectural decision.

**New since #112**: `Atom/Button`'s White variant now reuses `surface-active` for Hover and `surface-raised` for Active (see `docs/design-tokens.md`'s state matrix). Their dark values (stone-700, stone-800 respectively) invert White's dark-mode press direction — Hover now reads lighter than Active, backwards from both the light-mode direction and White's own pre-#112 dark ordering. Not fixed: no Figma dark frame exists to resolve it against, and inventing a new token pair to fix an unsourced dark ordering would be worse than flagging it.

## checkbox-delete-state

**`Checkbox` "delete" state**: `design/notes/Checkbox.md` records it, the Figma node doesn't contain it. Built only what the node exposes, per `CLAUDE.md`.

## input-field-text-boolean

**Figma `Input-field`'s "Text" boolean** can hide the entire input row. Not modelled — an input without its input isn't a meaningful state. Confirm the boolean is a Figma-authoring artifact rather than an intended variant.

## toggle-group-shared-track

**Toggle-group / shared track**: the `Button/Toggle` node's demo shows 5 chips sharing one grey track. #69 rebuilt the track itself; whether a *grouped* composition needs its own molecule/organism ticket is still open.

## sidebar-motion-timing-unsourced

**Sidebar's collapse-slide duration/easing (#86) are this codebase's own default, not Figma-sourced.** The ticket's own reference frame (node `3859:6647`, "SidebarAnimation") was re-fetched and confirmed to carry no prototype `reactions`/`transitionNodeID`/`transitionDuration`/easing data at all — only the same static `Collapsed=No` instance already fetched for `Organism/Sidebar` itself. Figma's Smart Animate lives on prototype connections between frames, not on component-set variants, and none exist here, so there is no timing value to sync.

`design/tokens.json` now carries `semantic.duration.base` (200ms) / `semantic.easing.base` (standard ease-out cubic-bezier), synced to `app/theme.css` as `--duration-base`/`--ease-base` and consumed by `Sidebar.tsx`'s width transition. Both are a codebase-picked default — 200ms and ease-out are common conventions, not values read from any design source. `Dropdown.tsx`/`Button-toggle.tsx` already independently picked the identical `duration-200 ease-out` Tailwind literals for their own animations (their own doc comments flag the same gap), which is corroborating precedent for these being reasonable defaults, not a substitute for a real design/product answer.

Needs a design/product answer, same as any other un-sourced value in this project: confirm (or correct) the duration/easing, and decide whether `Dropdown`/`Button-toggle` should migrate onto these same named tokens now that they exist (out of scope for #86, which only touched Sidebar).

**Partially actioned since, still open**: #100 moved `Dropdown`'s chevron-rotate transition onto `--duration-base`/`--ease-base`; #112 rebuilt the chevron as Dropdown's own rendered `Icon` (rotation driven by `isOpen` directly, no more sibling-selector trick), still on the same two tokens. But `Dropdown.tsx`'s pre-existing grid-rows open/close transition and `ButtonToggle.tsx`'s track-slide transition still hardcode the literal `duration-200 ease-out` Tailwind classes — the migration is incomplete, not resolved. Same design/product answer still needed before finishing it.

## english-nav-labels-overflow

**English nav labels overflow the Sidebar's fixed 198px rail (#25).** Dutch is pixel-perfect — all six rows exactly 40px, matching Figma. English is not: "Shopping basket" wraps to two lines and spills outside its 40px button. Figma only ever shows the Dutch labels, so it offers no guidance. Needs a content or design call — shorter English label, truncation, wrapping with taller rows, or a wider rail. Deliberately not invented in code.

## dropdown-row-not-fully-clickable

**#108's feedback asked that the whole Status/Prioriteit/Grootte row (pill + chevron) open/close, not just the pill.** Built only the pill as the click target — the chevron is a decorative, non-interactive `Icon` Dropdown renders next to the trigger (`design/notes/Dropdown.md`'s #108 entry has the full reasoning). Figma's own node shows the chevron as a separate sibling of the pill, same relationship `InputField`'s trailing icon has to its content (never independently clickable anywhere else in this codebase), so nothing in the fetched design asks for a bigger click target either. Making the whole row clickable would need either an invalid `<button>`-in-`<button>` (Status already renders a real `Button`) or a second interactive element wrapping it (`role="button"` div around a real `<button>`) — a documented ARIA/focus-order anti-pattern. Flagged rather than built; needs a product/design call on whether the pill-only target is acceptable or whether a structural change (e.g. the pill itself becoming non-interactive, with Dropdown owning the one real button) is worth the trade-off.

## touch-hold-duration-deviates-from-figma

**Figma Dev Mode annotation on node `3680:1442`** ("Te doen/Desktop/Filled", drag frame `I3882:14505;…`) says *"On mobile when holding for 2s activate drag-handle."* #118 ships **750ms** instead, a user-made product decision made after real-device testing (#117's diagnostic route) showed 2000ms felt broken — the user let go twice before the hold completed. For reference, iOS and Android's own native long-press both land near 500ms, and dnd-kit's own default `Delay` is 250ms; 750ms was chosen as a middle ground, not either of those.

This is a deliberate deviation, not an oversight — `CLAUDE.md` still requires it be flagged rather than silently reconciled. Needs a design answer: either update the Figma annotation to 750ms (or whatever value design ratifies) or explicitly ratify the code's 750ms as correct and note why Figma's spec doesn't govern here. See `design/notes/BoardView.md` for the full before/after reasoning and `tests/board-view-sensors.test.ts` for the value under test.

## ios-safari-fixed-viewport-unverified

**#113's mobile fixes (stale scrim after close, mobile drawer not reaching true edges) are reasoned and testable in Chromium, but not confirmed against real iOS Safari** — this dev machine and CI have no way to reproduce Safari's dynamic-chrome viewport behaviour. `viewportFit: "cover"` (new `app/layout.tsx` viewport export), safe-area-inset padding on `Sidebar.tsx`/`SidePanel.tsx`, and a `visibility`/`transition-discrete` fix on both scrims are all shipped as the best-supported hypothesis (backed by measured Chromium CSS correctness + documented Safari viewport semantics), not a confirmed fix. Needs on-device testing before this question closes.

## unit-dropdown-list-not-drawn

**The expanded unit dropdown list is nowhere drawn in Figma.** The Dev Mode annotation on the unit field (`3777:3942`) names only Gram, Kilogram, Liter, Scoop and "etc." — that is the ceiling of what the design actually specifies. #120's canonical unit list (`lib/recipes/units.ts`) carries 17 codes (mass: gram, kilogram, ounce, pound; volume: milliliter, deciliter, liter, theelepel, eetlepel, cup, teaspoon, tablespoon, fluid_ounce; count: stuk, snufje, scoop, naar_smaak), sourced from a user decision (2026-07-29) rather than from Figma. Every unit beyond the four the annotation names — including the full imperial set and the theelepel/teaspoon, eetlepel/tablespoon split — is a build decision with no Figma source. Needs a design pass over the actual dropdown once #122/#128 build the UI that reads this list, so the visible options and their order are a real design artifact rather than an inferred one.

## recipe-card-no-photo-placeholder

**`Card-content/Recipi` (node `3628:67`) always draws a photo — it has no "no photo yet" state.** #124 needed one anyway: `recipes.thumbnail_path` is nullable and, in practice, still null for every existing recipe — #121 (merged) built the storage bucket and upload validation, but no form yet writes a real path into it (see `recipe-panel-photo-upload-not-built`). `CardContentRecipe.tsx`'s `imageUrl` prop became optional and falls back to a plain `bg-surface-muted` placeholder square in the Thumbnail's own place (`design/notes/CardContentRecipe.md`'s "#124" entry has the full reasoning) — a functionally-motivated deviation, not a guess, but Figma itself gives no visual spec for this case (unlike, say, `CardContentRecipe.md`'s earlier confirmation that the Thumbnail frame carries no skeleton fill for a *filled* state — this is the reverse question: what a *missing* photo should look like at all). Needs a design answer now that #121 has shipped and real thumbnails are reachable: is a muted square the intended empty-photo treatment, or should design draw one (e.g. a generic food/camera icon)?

## category-icon-no-selected-state

**#125's icon picker has no Selected state to build against.** All 8 button
instances in both fetched nodes are the same `Style=Filled, State=Default` —
Figma draws no visual difference for "this is the chosen icon." Built with
`aria-pressed` reusing `Atom/Button`'s own existing Selected semantics
(`docs/design-tokens.md`: Filled's Selected only darkens text) rather than
inventing new styling. Needs a design answer: ratify text-only Selected here,
or design a real selected-icon treatment (e.g. a border/fill ring).

## category-delete-no-confirm-designed

**#125's footer draws a destructive `Verwijderen` button with no
confirmation step modelled anywhere in Figma.** Built with `CardDetailPanel.
tsx`'s existing two-step confirm (#94 precedent, "kies de minst-uitvindende
weg" per the ticket) rather than inventing a new pattern. Needs a design
answer: ratify the reused two-step confirm, or design a category-specific
one (e.g. warning that deleting a category cascades to its recipes —
`recipe_categories`'s `on delete cascade`, see `actions.ts`'s
`deleteCategory` comment).

## category-name-no-validation-designed

**#125's name field carries no visible validation state in Figma** (empty,
too long, duplicate). Built with the schema's own `min(1).max(200)`
(`lib/recipes/schemas.ts`) mirrored client-side as a disabled-Save gate only
— no length counter, no duplicate-name check (neither is enforced server-side
either). Needs a design answer on whether any of these should be surfaced in
the UI before save is attempted, rather than only after a failed submit.

## portion-stepper-figma-draws-plus-twice

**Both portion-stepper nodes (`3953:9750` mobile, `3778:5596` desktop) draw the same `Icon/Plus` component (`3629:149`) on the left AND the right** — there is no minus/decrement glyph anywhere in either node. #123 treats this as a design error rather than a literal spec: a decrement control that visually adds is functionally nonsensical next to a text label reading "N personen"/"N people", so the built `PortionStepper` (`components/molecules/PortionStepper.tsx`) renders lucide's `Minus` on the left (decrement) button and leaves `Icon/Plus` unchanged on the right (increment) button — a deliberate, functionally-motivated deviation from the literal Figma source, not a guess (`CLAUDE.md` forbids silently "fixing" a Figma mismatch without flagging it, which this entry does). `Minus` itself has no Figma node to verify against; `design/notes/Icon.md`'s #123 entry confirms lucide's `Minus` export really is a single horizontal stroke, coordinate-identical to the horizontal bar of Figma's own already-verified `Icon/Plus`. Needs a design answer: either add a real `Icon/Minus` variant to both nodes, or explicitly ratify this code's substitution as correct.

**Recurs in #160's "Pas aan" panel.** The panel's "Personen" row (`I3998:10928;3997:25437;3998:11009` mobile / `I3999:11007;3997:25437;3999:11001` desktop) draws a *single* `Button/Default` instance with `Icon/Plus` in BOTH its leading and trailing icon slots (`Leading icon: true, Trekking icon: true`) — structurally different from, but the same root authoring pattern as, the issue above. `PasAanPanel.tsx` does not build a new "one button, two icons" control for this: it reuses the already-built, already-approved `PortionStepper` molecule (whose own Minus-substitution is already flagged above) rather than inventing a second, differently-shaped servings widget. See `design/notes/RecipeDetailPage.md`'s "Pas-aan panel" entry. Needs the same design answer as above, extended to this node.

## ingredient-search-panel-empty-and-zero-result-states-unsourced

**Figma only ever draws the populated-results state.** Neither the "not yet searched" prompt copy nor the zero-results layout (beyond the user-approved "add as new ingredient" affordance, which has its own deviation note in `design/notes/IngredientSearchPanel.md`) has a Figma source — both are this codebase's own copy/layout decisions. Low product risk (plain muted prompt text, a `Card` reusing existing atoms), but flagged rather than silently presented as design-sourced. Needs a design pass only if these states should look meaningfully different from the current build.

## ingredient-name-annotation-only-on-row-two

**Only `3717:2844` row 2's name field (`I3740:4302;3761:8982`) carries the "opens the ingredient search" Dev Mode annotation** — rows 1 and 3 have byte-identical structure (`Icon/Arrow-right-left`, same `Input-field` variant) but no annotation of their own. `RecipeIngredientRow` applies the same open-search behaviour to all three rows (the least-surprising reading — a picker icon that only sometimes opens a picker would be worse). Needs a design answer confirming rows 1/3 should behave identically, or explaining why they were left unannotated.

## ingredient-step-rows-no-delete-reorder-v1

**Neither ingredient rows nor step rows have any delete/reorder affordance in #126's build.** Figma draws exactly three static ingredient rows and one static step, with no per-row chrome — v1 shipped literally that (a "Voeg toe" button appends a row; nothing removes one). Needs a design answer: a real trailing-icon delete/reorder control, or confirmation that rows are meant to be immutable once added (awkward on `edit`, where a wrong row currently can't be removed without recreating the whole recipe).

## recipe-panel-verwijderen-hidden-on-create

**Whether "Verwijderen" should be hidden on a brand-new recipe (vs. always visible) has no Figma source** — both fetched footers (`3717:2939`/`3777:4008`) show it unconditionally, with no separate "create" frame to compare against. #126 defaults to hidden-on-create, visible-on-edit (nothing to delete yet), the same default every other create/edit `SidePanel` in this codebase already uses. Needs a design answer only if the intended behaviour differs.

## recipe-panel-unit-list-etc-unsourced

**The unit `Dropdown`'s full option list is not drawn anywhere** — the annotation on `3777:3942`/`3740:4275` names Gram/Kilogram/Liter/Scoop "etc." and stops there. #126 wires the *complete* `UNIT_CODES` list from #120 (17 units) into the picker, which is a superset of the four named examples, not a literal read of "etc." Needs a design answer only if the full list should visually differ from a flat list (grouped by magnitude, for instance).

## recipe-panel-personen-chevron-behaviour-unsourced

**The Personen field's trailing chevron (`3968:10298`) has `Trekking-icon: true` but no annotation describing what it opens.** #126 built it as a `Dropdown` listing 1-12 (an unsourced, reasonable default); #149 rebuilt the same field on `InputField`'s new `options` (select) variant instead, since that's what the fetched node actually models (`design/notes/RecipePanel.md`) — the range itself is unchanged. Needs a design answer on the real range/behaviour (a stepper instead of a list? A different upper bound?).

## recipe-panel-desktop-layout-gap

**No desktop Figma node exists for the add/edit-recipe field content** — only `3717:2844` (402px mobile) is drawn. #126 kept every field in the same single-column order at every breakpoint, per the ticket's own instruction to avoid inventing new layout decisions. Needs a design answer only if a real desktop layout (e.g. two-column fields) was intended.

## recipe-name-field-swap-icon-unusual

**The ingredient name field's `Icon/Arrow-right-left` (swap icon) is an unusual choice for "open a picker/list"** — a magnifying glass (search) or a chevron (like every other field in this form) would be the more conventional affordance. Built exactly as specified since the annotation and icon are both explicit and consistent with each other. Needs a design answer confirming this was intentional.

## recipe-panel-two-identical-voeg-toe-buttons

**Both "Voeg toe" buttons (ingredients' `3717:2938`, steps' `3717:2948`) carry the exact same text**, distinguished only by vertical position on the page. #126 kept them textually identical (a literal read of the source) rather than inventing differentiated copy ("Voeg ingrediënt toe"/"Voeg stap toe") the ticket only offered as an option. Needs a design answer on whether differentiated labels are preferred.

## recipe-ingredient-row-unit-label-always-shown

**`Dropdown`'s labelless mode has no collapse/trigger behaviour at all** — reading `components/atoms/Dropdown.tsx` directly shows its `return` renders `children` unconditionally when no `label` is supplied; only the labelled branch has the open/closed chrome (`aria-expanded`, chevron rotation, grid-collapse). #126's `RecipeIngredientRow` needs a real closeable picker for its Eenheid column on every row, so it always passes `label` — the "Eenheid" text now renders on rows 2/3 too, not just row 1, diverging from Figma's `Title: false` there. Needs either a design ratification of this (label always visible is arguably fine/better) or a `Dropdown` atom enhancement adding a real labelless-but-collapsible mode.

## recipe-image-field-personen-label

**The "Selecteer afbeelding" image-upload field's bound Title text reads "Personen" in both the mobile and desktop "Add recipi" frames** (`3968:11192` / `3953:9875`) — confirmed a duplication artifact, not a translation gap: the instance was copied from the adjacent servings field and only its `Content` was edited. #121 renders no visible label for this field rather than showing the wrong one (`design/notes/ImageUploadField.md` has the full record). Needs a real label from design (e.g. "Afbeelding"/"Foto") to replace the omission.

## recipe-image-field-no-filled-state

**The fetched "Selecteer afbeelding" node only samples the empty state** — no Figma variant shows the box after a photo is chosen. `ImageUploadField` shows the picked file's name in place of the placeholder as its own interpretation (`design/notes/ImageUploadField.md`). Needs a design pass only if a real "filled" visual (e.g. a thumbnail preview inside the box) is wanted instead of plain filename text.

## recipe-detail-mobile-overflow-menu-undesigned

**#127's mobile header draws an icon-only `Icon/Ellipsis` button (`3778:5434`) with no annotation and no panel behind it anywhere in the file** — unlike desktop, which draws "Bewerken"/"Verwijderen" as two real, separately-styled `Button` instances (`3778:5591`/`3778:5592`). Built as a `Button`-triggered popover reusing `Atom/Dropdown`'s bordered-panel styling exactly the way `TeDoenHeader.tsx`'s own board-switcher/sort menus already do (own `useState` open flag, `pointerdown`-outside-closes, `Dropdown` in its labelless "static panel of `Button` rows" mode) — not a new menu component, but also not read off any Figma node, since none exists. The two rows inside it (Bewerken via `variant="white"`, Verwijderen via `variant="destructive"`) are this codebase's own choice, not sourced. Needs a design answer: either draw the real mobile menu, or ratify this composition as correct.

## nutrition-fiber-has-no-figma-button

**#161's NEVO import (ADR-0013) fills `reference.ingredients.fiber_g_per_100g` and threads it end-to-end through `lib/recipes/nutrition.ts`'s `resolveIngredientNutrition`/`computeRecipeNutritionPerPerson` (`fiberG`), the same as kcal/protein/carbs/fat — but nothing renders it.** Figma's `NutritionalData` row (`3997:15948` mobile / `3997:15543` desktop) draws exactly six buttons — time, kcal, carbs, protein, fat, servings — and none of them is fibre. Building a seventh would be inventing UI absent from Figma, which `CLAUDE.md` forbids (ADR-0013 §3's own reasoning: importing the column now is cheaper than a second migration pass over a populated table later, so the data exists ahead of any UI need for it). Needs a design answer: either Figma adds a fibre button to `NutritionalData`, or fibre stays computed-but-unrendered indefinitely.

## nutrition-dropdown-content-undesigned

**V2's NutritionalData row (`3997:15948` mobile / `3997:15543` desktop) carries Dev Mode annotations naming WHAT each of the five interactive buttons' dropdown should contain ("Clicking launches dropdown with: Calorieën", etc.) but no separate frame anywhere in the file draws the resulting expanded popover** — unlike the "Pas aan" panel, which has full frames (`3998:10701`/`3999:10877`) for its opened state. `NutritionalDataRow.tsx` builds the popover with the same `Atom/Dropdown` bordered-panel pattern already established for undrawn micro-interactions on this exact page (`recipe-detail-mobile-overflow-menu-undesigned` above), rendering a single line of explanatory text (the annotation's named full word — "Calorieën", "Koolhydraten", etc.). The content is Figma-specified; the popover's own width/padding/position are not. Needs a design answer only if the intended visual differs from this reused pattern.

**#161 (ADR-0013 §2): the four macro dropdowns (calories/carbs/protein/fat, not time) now also carry a mandatory NEVO licence attribution line** below the existing full-word text — the exact string RIVM's conditions require, rendered smaller/muted (`text-xs`/`text-text-muted`) to read as secondary to `fullLabel`, in a widened `w-64` panel (macro dropdowns only; `time`'s stays `w-40`). Like the popover itself, this line's content is fixed (the licence prescribes the exact wording) but its visual treatment — size, colour, panel width — is this codebase's own choice, not a Figma-drawn spec. Same open question, same answer needed only if design wants a different treatment.

## winkelmand-no-section-grouping

**#177's Winkelmand design draws one flat `Card` of rows with no supermarket-`section` grouping anywhere** (nodes `4044:10838`/`4044:10830`, and the older `3779:4112`/`3779:3996` state mockups), although #29 and `Architecture.md` §4.2 both call for it. `shopping_list_items.section` (#175) exists in the schema and is round-tripped by `addShoppingListItem` (#176), but no query or component in #177 groups or renders it — every row is fetched in one flat, `position`-ordered list (`getShoppingListItems`) and rendered in one `Card`. Needs a design pass adding a real grouped-by-section layout before this column has any UI consumer.

## winkelmand-no-manual-add-entry-point

**No "add item manually" control exists anywhere in the fetched Winkelmand nodes** — no input field, no "+" button — yet `Vision.md`'s Boodschappenlijst section says the list is filled "handmatig of vanuit recepten". `addShoppingListItem` (#176) is fully built and tested at the data layer; #177 ships no UI that calls it. Needs a design pass adding a real entry point (a row-adding input, a panel, or otherwise) before this action has any UI consumer.

## winkelmand-empty-state-undesigned

**No empty state is drawn for a zero-item Winkelmand** in either fetched node. #177 renders a minimal, text-only placeholder (`shopping.page.emptyStateText`, next-intl, both catalogs) in the Card's place rather than an empty `Card` or nothing at all — the same "must render something" reasoning `ReceptenBoard.md`'s own empty-state entry gives, but without a Figma reference to reuse the way that ticket had Te-Doen's `EmptyState` node available. Needs a real design once one exists.

## winkelmand-clear-all-no-confirmation

**"Alles verwijderen" (#177) has no designed confirmation step** — the fetched header (`4044:10843`/`4044:10835`) is a single destructive `Button/Default`, no second frame or annotation for a confirm/cancel state, unlike `RecipeDetailPage.tsx`'s own "Verwijderen" (`design/notes/RecipeDetailPage.md`'s #94-precedent two-step confirm). Built as a literal, single-click read of the fetched node rather than importing that precedent uninvited — a real destructive-action risk (this button empties the whole list in one click, with no undo), but inventing a confirmation step that Figma doesn't draw would be adding UI the ticket explicitly asked to flag, not build. Needs a design/product answer: ratify the single-click behaviour as correct, or design a confirm step (reusing the existing two-step pattern or a new one).

