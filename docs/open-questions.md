# Open questions awaiting a decision

Design-side gaps where the ticket, the property list or the token scale promises something the dev-ready Figma node doesn't contain, **and where the shipped code is not yet a satisfying answer**. Nobody builds these from guesswork (`CLAUDE.md`: never build what isn't in Figma).

This is the single canonical list. `docs/design-tokens.md` and `docs/HANDOFF.md` link here rather than restate it. Reference one as `docs/open-questions.md#<slug>` — by **slug, never by number**, because resolved questions get removed and numbering would silently reassign itself.

**When a question is resolved**: delete the entry and add its slug to "Resolved and removed" at the bottom. Full reasoning belongs in the component's `design/notes/<Component>.md`, not here.

---

## Design-system wide

### button-root-gap-binding-split

`Atom/Button`'s variant roots (`3623:4346`) disagree with each other about
whether their 4px `itemSpacing` is a variable: every `Alignment=Left` variant
binds `spacing/component/padding-xs`, every `Alignment=Center` variant leaves
it unbound as a literal 4. Same pixel either way, and Alignment is not a
property that should plausibly change a gap's *token status* — so this reads
as authoring drift in Figma rather than intent.

Nothing is broken: `Button.tsx` keeps `gap-1`, which is 4px in both cases, and
#205 deliberately did not convert it (picking the majority binding would be
exactly the kind of inference that ticket forbids). Needs a design call — bind
it on all eight variants, or unbind it on all eight — after which the class can
follow in one line. → `design/notes/Button.md`'s #205 entry for the measured
table.

### figma-stroke-primary-2-malformed-name

`design/figma-variables/Semantics _ Style_Light.tokens.json` carries a
variable named literally `Stroke/primary 2` (`VariableID:3787:6533`, a space
before the `2` instead of a `/`), resolving to `#0C0A09` — the exact same hex
as `color/text/base/primary`. #213's bidirectional `check:tokens-drift` gate
surfaced it (the old one-directional gate couldn't, by construction — see
`docs/incidents.md`'s corrected #204 entry for the same class of blind spot).
No component references it and no Figma node this repo builds from names it
in an annotation. Needs a Figma-side decision (real second Stroke/primary
ramp step? a duplicate slated for deletion? a rename typo?) before code
guesses at what it's for — tracked meanwhile on `design/tokens.json`'s
`$notMirrored` list with this slug as the reason.

### login-visual-has-no-dark-asset

`app/login/page.tsx`'s right-hand panel is a static `<Image>` (`/login/login-visual-{mobile,desktop}.png`) — a light-mode render of the product. Since #206 the login page itself follows the OS theme, so on a dark system that light PNG now sits against a stone-900 page. The page's own tokens switch correctly; only the asset doesn't. A dark counterpart has to be exported from Figma — building one in code would be inventing UI the design doesn't have. Until then this is cosmetic and confined to `/login`.

### loading-skeleton-undesigned

No Figma frame shows a loading/skeleton state for any page (Te-doen, Recepten, recipe detail) — Dev Mode has no "loading" variant on any of the fetched board/board-column nodes. #170's `loading.tsx`/`<Suspense>` fallbacks (`app/(app)/_components/PageSkeleton.tsx`) therefore reuse the real `CardContainer`/`Card` shells as-is (semantic tokens only, `animate-pulse` on a plain placeholder bar) rather than drawing a bespoke skeleton look. Needs a real frame from design if a more considered loading state is ever wanted.

### no-pointer-affordance

Two components still have no mouse-over feedback at all, and Figma defines none.

- **`Button/Toggle` segments** render as `Button variant="transparent"`, so #107's new hover/active fills reached them by composition and had to be suppressed — a segment's background paints *over* the white "Active" indicator, so Hover greyed the selected pill out and Active erased it entirely (measured: pressed segment and track both `oklch(0.923…)`). Figma backs the suppression: `3623:4345` has no state axis and its indicator is a real `#FFFFFF` node. Open: should segments have *any* pointer feedback, and what can it look like without hiding the indicator?
- **`Card-content/Ingredient`** (`3727:4021`) defines only `Default | Active | Delete`. Hovering a row does nothing; only pressing does.

### sidebar-motion-timing-unsourced

`semantic.duration.base` (200ms) and `semantic.easing.base` (ease-out cubic-bezier) are this codebase's own defaults — the ticket's reference frame (`3859:6647`) carries no prototype timing data, and Figma's Smart Animate lives on prototype connections that don't exist here. Needs ratification. Migration is also incomplete: `Sidebar.tsx` and `Dropdown`'s chevron use the tokens, but `Dropdown`'s grid-rows transition and `ButtonToggle`'s track slide still hardcode the literal `duration-200 ease-out`.

### english-nav-labels-overflow

Dutch nav labels are pixel-perfect at 40px per row; English is not — "Shopping basket" wraps and spills outside its button on the Sidebar's fixed 198px rail. Figma only ever shows Dutch. Needs a content or design call (shorter label, truncation, taller rows, or a wider rail), deliberately not invented in code.

### dropdown-row-not-fully-clickable

#108's feedback asked that the whole Status/Prioriteit/Grootte row open, not just the pill. Only the pill is a click target; the chevron is a decorative sibling, matching Figma's own structure. Making the row clickable needs either `<button>`-in-`<button>` or a `role="button"` wrapper around a real button — both documented ARIA anti-patterns. Needs a product call: accept the pill-only target, or restructure so the pill becomes non-interactive and `Dropdown` owns the one real button.

## Recepten

### step-rows-no-delete-reorder

Ingredient rows got a real, Figma-sourced delete in #166. **Steps did not** — no fetched node (`3717:2844`, `4025:10628`) shows any per-step delete or reorder affordance, so a step cannot be removed once added, which is awkward on edit. Ingredient *reordering* is likewise undesigned. Needs either a real trailing-icon control or confirmation that steps are meant to be immutable.

### recipe-image-field-personen-label

The image-upload field's bound Title text reads "Personen" in both frames (`3968:11192` / `3953:9875`) — a copy-paste artifact from the adjacent servings field, not a translation gap. `ImageUploadField` therefore renders **no visible label at all** rather than a wrong one. Needs a real label from design ("Afbeelding" / "Foto").

## Winkelmand

### winkelmand-no-manual-add-entry-point

`Vision.md` says the list is filled "handmatig of vanuit recepten", but no fetched Winkelmand node contains any add-item control — no input, no "+". `addShoppingListItem` (#176) is built and tested at the data layer and has **zero UI consumers**. Needs a designed entry point.

### winkelmand-no-section-grouping

`shopping_list_items.section` (#175) exists in the schema and is round-tripped by `addShoppingListItem`, but no query or component reads it — dead weight until a grouping consumes it. #179 shipped two *other* groupings (by source recipe, by NEVO food group). See `winkelmand-gangpad-grouping-not-built` for why a real aisle grouping is the larger piece.

### winkelmand-gangpad-grouping-not-built

The annotation on `4052:13970` asks for "Gangpad" (supermarket aisle) rather than "Foodgroup", *"so eg. canned tomato's don't end up with vegetables but in the 'international' isle"*. Measured against live data, not assumed: NEVO's `category_nl`/`category_en` are food-science groups (27 of them), and the annotation's own example reproduces — `"Puree tomaten- geconcentreerd blik"` resolves to `Groente`.

A real aisle layer needs a curated 27-group→aisle map **plus** name-pattern overrides for the cases the category alone gets wrong: 101 rows match `blik|glas|conserv`, 42 match `diepvries|bevroren`, 48 match `gedroogd`. That is new data with no source, the same class of gap ADR-0013/ADR-0014 were written for — so it needs its own ADR, not a page-ticket call. Shipped meanwhile: Voedingsgroep only, labelled as Figma's own `Text` property spells it.

### winkelmand-clear-all-no-confirmation

"Verwijder alles" (`4053:14285` / `4053:14274`) is drawn as a single destructive button with no confirm state and no second frame. It empties the whole list in one click with no undo. Built as a literal read of the node rather than importing `RecipeDetailPage`'s two-step confirm uninvited. Needs a ratify-or-design answer.

### winkelmand-send-no-success-feedback

No fetched node shows any acknowledgement that a send succeeded — no toast, badge, or checkmark swap. **This has already cost real time**: `AnimatedAddToBasketButton` plays its "Toegevoegd" animation regardless of the `ActionResult`, so a completely broken insert path (a migration that never reached hosted) looked like success for an entire ticket. A UI that always shows success cannot surface a broken server action. Needs a real decision: toast, inline confirmation, Winkelmand badge count, or an explicit ratification that silence is correct.

### winkelmand-mobile-sort-dropdown-anchor-undesigned

Mobile/Sort (`4052:13689`) draws the Sort button icon-only but has no Dropdown child at all — Figma never shows the open-panel state on mobile, so where the panel anchors below `md` is undrawn. #182 anchors it `left-0` to the Sort button (opens rightward, stays visually attached to the button that opened it) rather than right-anchored to the wider button group, a deliberate call made after the group-anchor alternative was reviewed and rejected — see `design/notes/WinkelmandPage.md#182` for both options and the measured geometry. Needs a real mobile frame from design to ratify (or override) this reading.

### winkelmand-mobile-header-content-overflows-320px

Independent of the dropdown: at a 320px viewport (dropdown closed), the header row's own content — title `"Winkelmand"` + icon-only Sort button + `"Verwijder alles"` — already exceeds the viewport width (`document.body.scrollWidth` measures `339px` against a `320px` viewport), causing horizontal scroll. No wrap is applied and neither button shrinks below its min-content width. Predates #182 (the old full-text mobile Sort button would have made it worse, not better) and is unrelated to the Sort dropdown's anchor — flagged here rather than fixed, since a real fix (wrap, truncate, icon-only "Verwijder alles" on mobile, or a narrower minimum supported width) is a design call, not a page-ticket's to invent. See `design/notes/WinkelmandPage.md#182` for the measured thresholds.

### winkelmand-merged-line-keeps-first-recipes-group

#179 groups by source recipe *and* merges same-name/same-unit lines; the two rules collide and Figma answers neither. A merged line carries one `recipe_id`, so adding "Banaan 2 stuk" from recipe A then B sums onto A's row — B's card never shows an ingredient the user did add from it. The two code paths also disagree: swipe-to-cart (`addIngredientToShoppingList`) merges into an **existing** DB row, whole-recipe send (`sendRecipeToShoppingList`) merges only within its own batch. So sending A then B leaves two "Banaan" lines, but swiping twice leaves one. Options: don't merge across recipes; merge and show the line under every contributing recipe (needs a join table); or drop `recipe_id` on merge and send the line to "Overig".

## Notities

### notes-tagging-not-designed

`Vision.md` names "Taggen" as a core Notities action, and an earlier draft of #30 described `tags` + `note_tags` for it. #225 (schema-only, Phase 6) deliberately shipped `public.notes`/`public.note_categories` **without** any tagging table, not even an empty `note_tags` — user decision 2026-08-13, because no Figma frame yet designs what tagging a note looks like (picker, chip rendering, filter-by-tag surface). `public.tags` already exists (added ahead of schedule by `20260730000002_recipe_schema.sql` for the recipe add-flow) and is deliberately generic — no recipe-specific column — precisely so a future `note_tags` join table can reuse it without a migration conflict. Needs a real design before that join table gets built.

### notes-overview-duplicate-mobile-frame

`Mobile/Notes/Overview/01` (`4067:19334`) is pixel-identical to `Mobile/
Notes/Overview` (`4067:18157`, the frame #230 built from) -- copy-paste
residue in the file, not a second state (no differing property, annotation,
or content between the two). Same class of gap #124 already flagged and
closed for Recepten's un-renamed 4th column. Not built; needs no design
action beyond eventually deleting the duplicate frame in Figma.

### notes-desktop-searchfield-detached

The desktop search bar (`4109:16063`, a `FRAME` named "Container") is
**not** an `Input-field` instance — it's hand-rebuilt from the component's
own anatomy (`Container` → `Content` → `Leading + Text` → `Slot` →
`Trekking-icon-container`), copy-paste residue like `notes-overview-
duplicate-mobile-frame` and `notes-editingbar-detached-from-components`
below. Measured 2026-08-13 (#231) via `figma_execute`/`boundVariables`
alongside the real mobile instance (`4067:18163`) before trusting anything
from it, per the ticket's own instruction: every token binding on the
detached `Container` (`gap-stack-md`, `p-component-xs` all sides,
`rounded-control-outer`, `surface-highlight-white` fill, `stroke-primary`
default/selected stroke) is **byte-identical** to the real mobile
instance's own `Container` node — so this frame is a faithful (if
detached) manual rebuild, not a stale/divergent one, and its Container-level
styling was safe to treat as confirmation of `InputField.tsx`'s own already-
correct tokens (no code change needed there). The one number taken from
this frame that has no mobile equivalent to cross-check is its own width
(240px, `FIXED` sizing → Tailwind's exact `w-60`) — mobile's field is
full-width by design (no fixed-width case exists to compare against), so
that specific measurement rests on the detached frame alone. Also
confirmed, structurally: the frame's own `Slot` (hidden, `visible: false`)
still nests a leftover "Categorie" `Button/Default` instance —
`design/notes/NotitiesBoard.md`'s "Search bar" section had already flagged
this as "likely copy-paste residue, not this ticket's to resolve" and that
reading holds: it is invisible in the fetched node, never rendered, not a
real third Categorie trigger.

### notes-search-clear-button-states-undesigned

The `/notities` search field's clear/X button (`components/atoms/
InputField.tsx`'s new `onTrailingIconClick`, #231) has no fetched hover/
active state of its own — Figma draws no separate `Button` instance behind
`Icon/X` (confirmed: it's the icon directly inside `Trekking-icon-
container`, no `Button/*` wrapper), so there is no state row to fetch.
Built per the ticket's own steer ("gebruik Button's bestaande states"):
reuses Button's `rounded-control` radius and its `transparent` variant's
`hover:bg-surface-secondary-hover`/`active:bg-surface-secondary-active`
tokens directly, rather than leaving the trigger with zero affordance or
inventing a new one-off pair. See `design/notes/InputField.md`'s #231
entry. Needs design confirmation once/if this trigger gets its own Figma
state.

### notes-editingbar-detached-from-components

`EditingBar` (desktop `3978:14138`, mobile `3978:14870`) is not built from design-system components: every toolbar button is named `Button/Default` but is a detached `FRAME`, not a `Button` instance — each carries a placeholder text layer `"Categorie "` and a stray, invisible trailing `Icon/Plus` instance left over from wherever the frame was copied from. The twenty icons inside are likewise loose frames, not `Icon/*` instances. Measured 2026-08-13 via the `figma-console` bridge while adding the twenty icons to `IconName` for #227. Nothing to fix in code — #234 (EditingBar) builds on real `Button`/`Icon` components regardless, per this repo's normal convention — but the Figma file itself should eventually be rebuilt on real instances so a future re-measurement of this toolbar isn't reading detached frames again.

### notes-category-panel-not-designed

`Pages/Notities/Breakpoints` (`3934:32790`) contains only the seven overview/editor frames — no category-add/rename/delete panel of its own. #232 built `NoteCategoryPanel` by reusing `/recepten`'s `CategoryPanel` shape one-to-one (`design/notes/NoteCategoryPanel.md`) rather than inventing a new panel, but three sub-parts have no Figma source and were resolved by precedent, not design:

- **Icon picker**: the 14-icon set offered (`NOTE_CATEGORY_ICONS`) is a codebase choice, not a Figma list — Figma only shows three seeded categories in use (`FolderClosed`/`Lightbulb`/`FolderClosed`). Reasoning and the full list: `design/notes/NoteCategoryPanel.md`.
- **Delete confirmation**: no confirm dialog/step is designed anywhere in this file for any category panel (same gap `category-delete-no-confirm-designed`'s history already covers for `/recepten`, now resolved there by reuse). `NoteCategoryPanel` reuses `CategoryPanel.tsx`'s two-step confirm verbatim.
- **Confirm wording vs. the cascade**: `notes.category_id` is `on delete cascade` (`20260813000001_note_schema.sql`), so deleting a category deletes its notes — the confirm text is generic ("Weet je het zeker?"), not cascade-specific, matching `/recepten`'s own generic wording rather than inventing a new sentence with no design source.

Needs a real Figma frame (panel chrome, an icon set scoped to Notities, and a delete-confirmation state) before any of the three should be considered final.

### notes-editingbar-link-no-url-input-designed

`EditingBar`'s link button (#234, `Icon/Link`, position 14) has no URL-input
UI designed anywhere in `Pages/Notities/Breakpoints` — no modal, no inline
field, nothing between clicking the button and TipTap's `setLink({href})`
needing a real URL. Built as a native `window.prompt()` (browser chrome, not
a custom Figma-absent dialog) as the least-invention stand-in: clicking while
a link mark is active unsets it, otherwise a prompt asks for a URL and
`toggleLink`-equivalent logic applies it. See `design/notes/EditingBar.md`.
Needs a real designed link-input surface before this is considered final.

### notes-editingbar-mobile-image-button-out-of-scope

Mobile `EditingBar` (`3978:14870`) carries a 21st element after a 6th
separator line that desktop doesn't have: `3978:15082`, a real `Button/
Default` **instance** (not a detached frame like the other twenty), 133px
wide, with a visible text label "Afbeelding" and `Icon/Image`. No TipTap
image extension is installed in `lib/notes/extensions.ts` and none was added
for #234 — image insertion is out of scope for this ticket, per direct user
instruction. Needs a real ticket (extension install, upload/insert flow) before
this button is built; not counted among the 20 mapped commands in
`design/notes/EditingBar.md`.

### notes-delete-has-no-confirmation

`/notities/[noteId]`'s "Verwijderen" button (`3978:14809` desktop, `3978:14839` mobile) has no confirmation step drawn anywhere in `Pages/Notities/Breakpoints` — same absence `notes-category-panel-not-designed` already documents for the category panel. #233 reused the existing two-step confirm pattern verbatim (`RecipeDetailPage.tsx`'s own in-place button-row swap, itself the same shape `NoteCategoryPanel.tsx`/`CategoryPanel.tsx` already use): deleting a note is irreversible, and the app already has one established confirm idiom rather than inventing a second. Needs a real Figma confirmation state before this is considered final.

---

## Resolved and removed

These were open questions that the shipped build now answers. The deviation and its reasoning live in the component's own `design/notes/<Component>.md`; an old `#slug` link that lands here was one of them.

**Decided by the user or by measurement** — `touch-hold-duration-deviates-from-figma` (750ms, chosen after real-device testing showed Figma's 2s felt broken), `unit-dropdown-list-not-drawn` and `recipe-panel-unit-list-etc-unsourced` (the 17-code `UNIT_CODES` list is a user decision, 2026-07-29), `ios-safari-fixed-viewport-unverified` (now tracked as a verification ticket, not a design gap), `button-vs-input-active-border` (#204, 2026-08-11: fetched both nodes' Active state side by side — `Stroke/secondary/active` for Button/Outline, `Stroke/primary/active` for Input-field, two distinct correctly-bound Figma variables, never a divergence to reconcile; `stroke-primary-active` keeps its own name), `token-names-are-hex-derived` (#203, 2026-08-11: the premise was simply wrong — `get_variable_defs` does return variable names, verified on 3623:4346 and 3705:4402. Every semantic token now carries its real Figma variable path and id, `design/figma-variables/` holds the exported collections, and `pnpm check:tokens-drift` keeps the two in step), `dark-mode-is-placeholder-only` (#204 narrowed this 2026-08-11, #206 closes it 2026-08-12: real Figma dark frames/variables back every semantic colour token's dark value as of #204 — two deliberately-accepted quirks remain (Distructive hover/press/selected collapsing to one red-50, White's Active reading lighter than Hover), not flagged for a fix. The one part this slug's own text still called open — "only Ladle sets `data-theme`, an app-level theme switch is a separate architectural decision" — is what #206 resolves: `next-themes` now sets `data-theme` from system preference app-wide, no switch UI (not in Figma, not built). Full reasoning in `design/notes/AppShell.md`), `transparent-binding-unverified` (#213, 2026-08-12: re-measured via the figma-console-mcp plugin bridge — `figma.variables`/`boundVariables` read directly on Transparent's own Hover/Active nodes, a WebSocket bridge with no Starter-plan rate limit, so the fetch is now repeatable by anyone rather than resting on a single subagent's report. Confirms exactly what the report claimed: `surface-highlight-white-hover`/`-active`, not `surface-secondary/*`. Nothing changed — the binding was already right — only the method is now reproducible; see `design/notes/Button.md`'s #213 entry), `per-page-home-screen-icon-unverified` (#223, 2026-08-13: the one thing this dev machine could not answer — whether iOS treats N manifests sharing an origin, each with its own `id`, as N independently-routed home-screen installs — the user verified on their own iPhone. It does: adding Te-Doen, Recepten and Winkelmand to the home screen gives three distinct icons that each open their own page, exactly as designed. Nothing is reverted; the build stands as shipped. Full build record in `design/notes/AppShell.md`'s "#223 vervolg" section).

**Figma authoring artifacts, built the sensible way** — `portion-stepper-figma-draws-plus-twice` (both stepper nodes draw `Icon/Plus` twice; code renders `Minus` on decrement), `recipe-name-field-swap-icon-unusual` (`Icon/Arrow-right-left` for "open a picker", built as specified), `recipe-image-field-no-filled-state`, `input-field-text-boolean`, `checkbox-delete-state`.

**Built with an existing, already-approved pattern** — `category-delete-no-confirm-designed` and `category-name-no-validation-designed` (two-step confirm + disabled-Save gate), `category-icon-no-selected-state` (`aria-pressed` reusing Button's Selected semantics), `recipe-detail-mobile-overflow-menu-undesigned` and `nutrition-dropdown-content-undesigned` (labelless `Dropdown` bordered-panel popover), `ingredient-search-panel-empty-and-zero-result-states-unsourced`, `recipe-panel-verwijderen-hidden-on-create`.

**Built as the least-surprising literal read** — `ingredient-name-annotation-only-on-row-two`, `recipe-panel-two-identical-voeg-toe-buttons`, `recipe-panel-personen-chevron-behaviour-unsourced`, `recipe-panel-desktop-layout-gap`, `recipe-ingredient-row-unit-label-always-shown`, `recipe-card-no-photo-placeholder`, `toggle-group-shared-track`, `winkelmand-send-no-subset-picker` (per-ingredient swipe covers single sends; only *multi*-select stays undesigned).
