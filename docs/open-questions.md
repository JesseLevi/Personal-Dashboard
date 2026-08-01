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

## metric-imperial-conversion-has-no-ui-entry-point

**The design shows imperial units on the recipe detail page (cup, tsp, tbs) but metric units in the input form (Gram, Kilogram, Liter), with no conversion toggle designed anywhere.** That is an internal inconsistency in the design itself, not something #120 can resolve by building UI that isn't there (`CLAUDE.md`: never build what isn't in Figma). `lib/recipes/units.ts` ships a same-magnitude `convert()` function (volume↔volume, mass↔mass, e.g. cup↔milliliter) precisely so that an American recipe's imperial units can round-trip to metric, but nothing wires it to a user-facing toggle or automatic display conversion — the function exists and is unit-tested, but has no UI entry point. Needs a design/product answer on whether and how a conversion toggle should be designed before a follow-up ticket wires `convert()` into any screen.

## fraction-notation-vs-decimal-formatter

**The recipe detail design (`3778:3792`) shows fractional notation ("1/4 cup"); #120's `formatQuantity` emits rounded decimals instead** (`formatQuantity(0.25, "Cup")` → `"0.25 Cup"`, and `scaleQuantity`'s own tests assert 1/4 cup scaled to 3/8 reads `0.38`, not `"3/8"` — see the rounding rule documented in `lib/recipes/units.ts`, not repeated here). This is a defensible build decision, not an oversight: the ticket's own formatter examples ("1250 Gram", "2 Scoops") are both decimal, and a vulgar-fraction renderer is a display concern that can be layered on top of the same numeric `quantity` later without any schema or conversion change. But it is a place where the shipped build reads differently from what the design draws, and that gap was nowhere written down until now. Needs a design/product answer on whether quantities should render as vulgar fractions (and if so, to what denominator) before #128 wires the portion stepper to this formatter.

## recipe-card-no-photo-placeholder

**`Card-content/Recipi` (node `3628:67`) always draws a photo — it has no "no photo yet" state.** #124 needed one anyway: `recipes.thumbnail_path` is nullable and, in practice, always null right now (#121's storage bucket + upload flow don't exist yet), so every recipe card on `/recepten` renders without a real image. `CardContentRecipe.tsx`'s `imageUrl` prop became optional and falls back to a plain `bg-surface-muted` placeholder square in the Thumbnail's own place (`design/notes/CardContentRecipe.md`'s "#124" entry has the full reasoning) — a functionally-motivated deviation, not a guess, but Figma itself gives no visual spec for this case (unlike, say, `CardContentRecipe.md`'s earlier confirmation that the Thumbnail frame carries no skeleton fill for a *filled* state — this is the reverse question: what a *missing* photo should look like at all). Needs a design answer once #121 makes real thumbnails reachable: is a muted square the intended empty-photo treatment, or should design draw one (e.g. a generic food/camera icon)?

## recipes-overview-duplicate-fourth-column

**The recipe overview (`3672:1588`, the desktop Carousel instance) draws a 4th `Card-container` after Ontbijt/Lunch/Avond, and it is copy-paste residue, not a 4th category.** Confirmed directly by fetching the node (#124), not just taken on the ticket's word: the 4th instance carries a distinct icon override (`Icon/Cake-slice`) but its `Name`/`Hoeveelheid` text nodes are left at the *base component's own unedited default sample values* — `"Ontbijt"`/`"4"` — identical to the real Ontbijt column, rather than a real label like "Toetje"/"Dessert". Reads as someone duplicating the Ontbijt instance, swapping only the icon, and never finishing the rename. `seed_default_recipe_categories()` (`supabase/migrations/20260730000002_recipe_schema.sql`) only ever seeds three categories (Ontbijt/Lunch/Avond), matching the read that this is authoring debris, not an intended design.

Not built (`app/(app)/recepten/page.tsx`/`ReceptenBoard.tsx` render however many categories `recipe_categories` actually holds — three today, per the seed trigger). Needs a design answer only if a 4th default category (dessert/toetje?) was actually intended; otherwise this entry can simply be closed once design confirms it was copy-paste.

## category-icon-picker-curated-set

**#125's "Icoon" picker shows 8 curated lucide icons, not the ticket's
literal "list all 74 lucide food icons here."** Both fetched nodes
(`3891:18524` mobile, `3957:11544` desktop) draw exactly 8 `Button/Default`
instances — a fixed slot count, all 8 rendering the identical `Icon/Sandwich`
placeholder — and the Dev Mode annotation the ticket quotes is an
instruction to the builder, not delivered content (the ticket itself flags
this as unresolved). Building 74 new `IconName` entries on a text
instruction alone, with no Figma vector behind any of them to shape-verify
against, would invert this codebase's own "never build what isn't in Figma"
rule and also wouldn't fit the 8-slot layout Figma actually draws. Shipped:
`Sandwich`, `Croissant`, `CakeSlice`, `Broccoli` (already valid, and the
first three are `seed_default_recipe_categories()`'s own seeded icons),
`Coffee`, `Soup`, `Pizza`, `Cookie` (newly added, `design/notes/Icon.md`'s
#125 entry). Full reasoning: `design/notes/CategoryPanel.md`. Needs a
design/product answer: ratify this curated 8, or specify a real UI shape
(search? paginated grid?) that could actually hold all 74.

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
