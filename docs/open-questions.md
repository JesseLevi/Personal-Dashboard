# Known gaps and product calls

An entry belongs here when a design gap is still worth knowing about, or a product decision needs the user (marked **Product call.**). Per ADR-0034 Claude designs UI in code from existing components and semantic tokens, so a missing Figma frame is no blocker: where an entry says "Claude may design when touched", do so when a ticket touches it.
Reference an entry as `docs/open-questions.md#<slug>`, by slug, never by number. Slugs are stable because code comments point at them.
To resolve: delete the entry, add its slug to "Resolved" at the bottom, put the reasoning in the component's `design/notes/<Component>.md`.

---

## Design-system wide

### button-root-gap-binding-split

`Atom/Button` roots (`3623:4346`): every `Alignment=Left` binds the 4px gap to `spacing/component/padding-xs`, every `Center` leaves a literal 4. Likely drift; `Button.tsx` keeps `gap-1`. Needs a call: bind all eight or unbind all eight. -> `design/notes/Button.md`.

### figma-stroke-primary-2-malformed-name

Figma variable `Stroke/primary 2` (`VariableID:3787:6533`) resolves to `#0C0A09`, same as `color/text/base/primary`; unused, listed in `design/tokens.json` `$notMirrored`. Needs a Figma-side decision before code uses it.

### login-visual-has-no-dark-asset

`app/login/page.tsx` shows a light-mode PNG (`/login/login-visual-{mobile,desktop}.png`) while the page follows the OS theme, so it looks off on dark. Cosmetic. A dark image must be exported; Claude may not invent product imagery.

### skeleton-breathe-timing-unsourced

Skeletons breathe (opacity 1 -> 0.4 -> 1, 1.6s, `--animate-breathe` in `app/globals.css`, off under `prefers-reduced-motion`). The frames carry no motion spec and it is not a token. Needs ratification, like `sidebar-motion-timing-unsourced`.

### skeleton-column-header-desktop-visible

Recepten desktop frame (4164:25197) draws column headers visible, mobile (4164:25190) hidden. The skeleton hides them at both breakpoints (names are unknown while loading). Claude may design placeholder text for desktop when touched.

### skeleton-predates-recipe-page-v2

Recipe-detail frames (4164:26042/26088) predate the shipped page (#160): servings stepper vs `NutritionalDataRow`, `Title=No` cards, width 314 vs 296/320. Content shifts on load. Claude may align the skeleton when touched.

### note-editor-skeleton-undesigned

No loading frame for the note editor; `NoteEditorSkeleton` renders only the inert back-button row. Claude may design more when touched.

### no-pointer-affordance

`Button/Toggle` segments have hover/active suppressed (they would paint over the white Active indicator; `3623:4345` has no state axis). `Card-content/Ingredient` (`3727:4021`) has only `Default | Active | Delete`. Claude may design pointer feedback that keeps the indicator visible when touched.

### sidebar-motion-timing-unsourced

`semantic.duration.base` (200ms) and `semantic.easing.base` are this codebase's own defaults (frame `3859:6647` has no timing). Needs ratification; `Dropdown` grid-rows and `ButtonToggle` track still hardcode `duration-200 ease-out`.

### recipe-image-field-personen-label

The image-upload field's Title reads "Personen" in both frames (`3968:11192` / `3953:9875`), a copy-paste artifact. `ImageUploadField` renders no visible label. Claude may add a label ("Afbeelding" / "Foto") when touched.

## Winkelmand

### winkelmand-no-section-grouping

`shopping_list_items.section` (#175) is stored but no query or component reads it; #179 shipped other groupings instead. Dead weight until a grouping consumes it; see `winkelmand-gangpad-grouping-not-built`.

### winkelmand-gangpad-grouping-not-built

**Product call.** Annotation on `4052:13970` wants "Gangpad" (aisle) grouping; NEVO's 27 groups are food-science groups (canned tomato puree lands in `Groente`). An aisle layer needs a curated map plus name-pattern overrides: new data, so its own ADR. Shipped: Voedingsgroep only.

### winkelmand-send-no-success-feedback

**Product call.** No node shows send acknowledgement. Since #290 `AnimatedAddToBasketButton` plays "Toegevoegd" only on `success: true`; on failure it silently rests, so there is no failure signal. Decide: toast, inline confirmation, basket badge, or silence.

### winkelmand-mobile-sort-dropdown-anchor-undesigned

Mobile/Sort (`4052:13689`) has no open-panel frame. The panel is `left-0`-anchored to the Sort button and clamp-protected by `lib/dom/use-popover-position.ts`. Claude may redesign when touched. -> `design/notes/WinkelmandPage.md#182`.

### winkelmand-mobile-header-content-overflows-320px

At 320px the header row (title, icon-only Sort, "Verwijder alles", and since #222 pt.4 an icon-only "+ Item") overflows (339px before the fourth control; not re-measured). Claude may design a fix when touched. -> `design/notes/WinkelmandPage.md#182`.

### winkelmand-empty-state-add-button-not-in-figma

By user instruction the empty header carries "+ Item" before "Leeg mand"; Figma's EmptyState `Knoppen` (`4049:11175`/`4049:11167`) draws only the Destructive button. Figma is behind the code. -> `design/notes/WinkelmandPage.md`.

### winkelmand-merged-line-keeps-first-recipes-group

**Product call.** #179 groups by source recipe and merges same-name/unit lines, but a merged line has one `recipe_id`, so B's "Banaan" sums onto A's row and B's card never shows it; swipe-to-cart and whole-recipe send also merge differently. Options: no cross-recipe merge; show under every recipe (join table); drop `recipe_id` on merge.

### member-search-scope

**Product call.** `search_members` finds every account by partial first or last name (ADR-0035, accepted trade-off for a closed circle). Decide whether that stays, or whether finding someone needs more than a name (exact e-mail address only, or a shared code).

## Notities

### notes-tagging-not-designed

**Product call.** `Vision.md` names "Taggen", but #225 shipped notes without a tagging table (user decision 2026-08-13): no design for picker, chips or filter. `public.tags` exists and is generic, so a future `note_tags` join can reuse it. Decide what tagging looks like before building it.

### notes-overview-duplicate-mobile-frame

`Mobile/Notes/Overview/01` (`4067:19334`) is pixel-identical to `Mobile/Notes/Overview` (`4067:18157`), copy-paste residue. Not built; delete the duplicate in Figma eventually.

### notes-desktop-searchfield-detached

Desktop search bar (`4109:16063`) is a hand-rebuilt frame, not an `Input-field` instance; its tokens match the mobile instance (`4067:18163`), so no code change. Only its 240px width (`w-60`) rests on it alone. -> `design/notes/NotitiesBoard.md`.

### notes-search-clear-button-states-undesigned

The `/notities` search clear button (`InputField` `onTrailingIconClick`, #231) has no Figma hover/active; it reuses Button's `rounded-control` and `transparent` hover/active tokens. Claude may design when touched. -> `design/notes/InputField.md` (#231).

### notes-editingbar-detached-from-components

`EditingBar` frames (`3978:14138` / `3978:14870`) use detached frames, not `Button`/`Icon` instances; code uses real components. Since #333 the shipped bar is deliberately slimmer than the 20-button frames; redraw or mark them superseded. -> `design/notes/EditingBar.md`.

### notes-category-panel-not-designed

`Pages/Notities/Breakpoints` (`3934:32790`) has no category panel; #232 reuses the shared `CategoryPanel` (#287). By precedent: the 14-icon set (`NOTE_CATEGORY_ICONS`), two-step delete confirm, generic wording despite the `notes.category_id` cascade. Claude may design these when touched. -> `design/notes/CategoryPanel.md`.

### notes-prose-font-scale-no-tokens

`app/theme.css` has no font-size, weight or line-height tokens, so #329's prose uses Tailwind's type scale via `@apply` in `app/globals.css`. Needs a typography token set in `design/tokens.json` before binding. -> `design/notes/NoteEditor.md` (#329).

### button-no-disabled-state

`Button` has no disabled look or token. #330's table menu uses `aria-disabled` plus `opacity-40` as a stand-in. Claude may design a disabled state and tokens when touched. -> `design/notes/NoteEditor.md` (#330).

### notes-slash-menu-icon-glyphs-missing

Slash menu (#332) wants `Pilcrow`, `Heading1-3`, `ListOrdered`, `ListTodo`; `Icon` lacks them and new glyphs change the `icon--all-icons` baseline, so it reuses `TextAlignStart`, `Heading`, `List`. Register glyphs in `components/atoms/Icon.tsx`, regenerate the baseline, switch `lib/notes/slash-items.ts`. -> `design/notes/NoteEditor.md` (#332).

### code-syntax-colour-tokens

Code highlighting (#336) has no syntax palette: ~16 highlight.js classes map onto 5 hues in `app/globals.css` (names and attributes share red, also "urgent"); contrast on `surface-secondary` is unmeasured. Claude may design `text/syntax/*` tokens (light and dark) when touched. Also missing: `Copy`, `ChevronRight` glyphs. -> `design/notes/NoteEditor.md` (#336).

### notes-block-menu-icon-glyphs-missing

Block handle and menu (#335) want `GripVertical`, `Copy`, `ArrowUp`/`ArrowDown`; `Icon` has none, so the handle reuses `EllipsisVertical` and rows are text-only except Delete. Register glyphs in `Icon.tsx`, regenerate the baseline, switch `NoteBlockHandle.tsx`. -> `design/notes/NoteEditor.md` (#335).

### notes-image-states-glyph-and-spinner

Image states (#339): the broken-image block reuses `Image` (no `ImageOff` glyph); the upload placeholder is a pulsing `surface-secondary` block, since `Icon`'s `Loader` has no spin treatment. Claude may design both when touched. -> `design/notes/NoteEditor.md` (#339).

### notes-toc-rail-undesigned

TOC rail (#342) is Claude-designed on request. Untokenised: rail width (`w-44`), sticky offset (`top-stack-xl` reused), the `xl` hide breakpoint; no mobile menu. Claude may adjust when touched. -> `design/notes/NoteEditor.md` (#342).

## Agenda

### calendar-sync-drop-override

**Product call.** An imported feed that loses more than half of the events in its window, or comes back empty, counts as a failed sync and deletes nothing (ADR-0037 §5). If the loss is real (a series removed, a calendar emptied on purpose), the account stays "failed" until the feed grows back or the user removes and re-adds it. Options: a "Toch bijwerken" button per failed account, or accept it. -> `design/notes/AgendaCalendarsPanel.md`.

### agenda-week-basket-merged-line-attribution

**Product call.** "Week naar mand" sums the same ingredient and unit across meals into one basket line, but `shopping_list_items.meal_plan_id` holds one id, so a merged line records only the first contributing meal. A meal whose ingredients were all merged into earlier lines has no basket item and a second "Week naar mand" would send it again; the ADR-0037 §6 notice on deleting an event also misses its share of a merged line. Fix needs a migration (a `meal_plan_ids uuid[]` column or a join table), so it waits for a decision. -> `design/notes/AgendaPage.md`.

### agenda-meal-position-not-in-timeline

`agenda_items()` returns no `meal_plans.position`, so `getAgendaItems` reads it in a second query for the meals in range. Adding the column to the function (a new migration, `create or replace`) would drop that query. -> `design/notes/AgendaPage.md`.

---

## Resolved

- `english-nav-labels-overflow`, `loading-skeleton-undesigned`, `touch-hold-duration-deviates-from-figma`, `unit-dropdown-list-not-drawn`, `recipe-panel-unit-list-etc-unsourced`, `ios-safari-fixed-viewport-unverified`, `button-vs-input-active-border`, `token-names-are-hex-derived`, `dark-mode-is-placeholder-only`, `transparent-binding-unverified`, `per-page-home-screen-icon-unverified`
- `portion-stepper-figma-draws-plus-twice`, `recipe-name-field-swap-icon-unusual`, `recipe-image-field-no-filled-state`, `input-field-text-boolean`, `checkbox-delete-state`, `settings-mobile-delete-button-not-built`
- `notes-editingbar-link-no-url-input-designed`, `category-delete-no-confirm-designed`, `category-name-no-validation-designed`, `category-icon-no-selected-state`, `recipe-detail-mobile-overflow-menu-undesigned`, `nutrition-dropdown-content-undesigned`, `ingredient-search-panel-empty-and-zero-result-states-unsourced`, `recipe-panel-verwijderen-hidden-on-create`
- `ingredient-name-annotation-only-on-row-two`, `recipe-panel-two-identical-voeg-toe-buttons`, `recipe-panel-personen-chevron-behaviour-unsourced`, `recipe-panel-desktop-layout-gap`, `recipe-ingredient-row-unit-label-always-shown`, `recipe-card-no-photo-placeholder`, `toggle-group-shared-track`, `winkelmand-send-no-subset-picker`
- `notes-table-ui-not-designed`, `notes-prose-typography-not-designed`
- `import-skeleton-bars-unbound`, `import-link-panel-input-chevron`, `import-description-not-stored`, `import-range-and-pack-note-dropped`
- `notes-link-chip-undesigned`, `notes-editingbar-mobile-image-button-out-of-scope`
- `winkelmand-clear-all-no-confirmation`
- `notes-delete-has-no-confirmation`
- `dropdown-row-not-fully-clickable`
- `step-rows-no-delete-reorder`
