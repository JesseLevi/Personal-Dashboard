# CategoryPanel
Figma: `Add column/Mobile` node `3891:17997`, `Pull-up panel` desktop `3957:11537` (`Icons` frame `3957:11251` mobile / `3957:11542` desktop; `Icon list` `3891:18524` / `3957:11544`). Notities has no node of its own: `Pages/Notities/Breakpoints` (`3934:32790`) draws no category panel. · Code: `app/(app)/_components/CategoryPanel.tsx` (shared by /recepten and /notities since #287); icon sets `app/(app)/recepten/category-icons.ts` (74) and `app/(app)/notities/category-icons.ts` (14); stories `app/(app)/recepten/CategoryPanel.stories.tsx`, `app/(app)/notities/NoteCategoryPanel.stories.tsx`

## Anatomy
Page-level composition of `SidePanel` + `InputField` + `Button`, not in `figma-map.json` (same precedent as `BoardPanel` / `CardDetailPanel`). One component for create and edit (`target.mode`): Name field, an "Icons" label plus a wrapping row of `Button variant="filled"` icon buttons, footer Verwijderen (edit only) + Opslaan. Figma draws a row of 8 identical `Icon/Sandwich` placeholder buttons, i.e. a slot count, not a list.

Shared via props (#287): `icons` (first entry = create default and fallback), `translationNamespace` (`components.categoryPanel` / `components.noteCategoryPanel`, also its `.iconLabels` child), `errorsNamespace` (`recipes.errors` / `notes.errors`), and `onCreateCategory` / `onUpdateCategory` / `onDeleteCategory` (Notities passes `renameCategory` as `onUpdateCategory`). `CategoryPanelCategory` and `CategoryPanelActionResult` are structural subsets, so the file imports nothing from `lib/*`. The panel never imports `"use server"` code; the composer passes real actions so Ladle can mock them.

## Deliberate decisions
- Reset-on-open by comparing against the previous render's state, not `BoardPanel`'s `key`-per-target remount. Remounting `SidePanel` destroys its closed dialog node, so the next open has no painted closed frame to animate from and jumps to open. This panel has two triggers on the same entity (header create, column pencil edit), so target-changing opens are common (#125, #105).
- /recepten icon picker shows all 74 lucide "Food & beverage" icons, by explicit user instruction (2026-08-01); the first pass was a curated 8. The list comes from lucide's per-icon `categories` metadata (lucide.dev does not render its grid server-side), each name verified as a `lucide-react` export and added to `Icon.tsx`. Every icon has its own a11y label in both catalogs (`iconLabels.*`) from the same tag metadata, e.g. `FishOff`/`MilkOff`/`WheatOff` read "Fish-free"/"Lactose-free"/"Gluten-free". `SidePanel`'s content already scrolls, so 74 buttons need no new layout (#125).
- /notities uses a general-purpose 14-icon set (`FolderClosed`, `Notebook`, `Lightbulb`, `Scroll`, `Star`, `Calendar`, `Timer`, `AlarmClockCheck`, `CircleCheck`, `ShoppingBasket`, `BicepsFlexed`, `User`, `Shirt`, `Image`), all already in `IconName`. UI-action glyphs (`Pencil`, `Trash`, `Ellipsis`, chevrons, arrows, `X`, `Save`, `Search`) are excluded so a category icon never reads as that action. `FolderClosed` is first, so it is the create default and the fallback (#232).
- No Selected state is drawn, so each picker button sets `aria-pressed={icon === iconName}` and reuses Filled's own Selected semantics (text darkens, no fill change), the same convention as `CardDetailPanel`'s Status dropdown (#125).
- Delete is `CardDetailPanel`'s two-step confirm (`DeleteConfirm`, footer swaps to a prompt + Annuleren / "Ja, verwijderen"); the wording is generic, not cascade-specific. Name validation is only Save disabled while `name.trim() === ""`, mirroring the schemas' `min(1).max(200)`; no counter and no duplicate check, since the server enforces no uniqueness (#125, #94).
- Deleting a category cascades: `recipes.category_id` and `notes.category_id` are `not null ... on delete cascade`, and there is no Postgres guard. The generic confirm text was kept rather than inventing a blocking warning that would misrepresent a cascade (#232).
- The Notities copy (`NoteCategoryPanel`, #232) was merged into this component and moved to `app/(app)/_components/` (organisms may not import from `app/`, and it uses `DeleteConfirm`). Pure refactor: element id became `category-panel-name`; stories stay beside their callers with unchanged story ids, so their baselines did not move (#287).
- `seed_default_note_categories()` is an `after insert on auth.users` trigger, so accounts created before it have zero note categories; this panel is then the only way `/notities` gets a column (#232).

## Token gaps and flags
Spacing measured from `boundVariables`, no raw spacing left (#219):
- Footer button rows `gap-inline-sm`: the shared `SidePanel` "Bottom" template (`3779:4858` mobile / `3779:4950` desktop, `itemSpacing` 8), identical in the delete-confirming and default states.
- Label + row wrapper `gap-stack-sm`: Figma "Icons" frame, vertical, `itemSpacing` 8 -> `spacing/stack/stack-sm`.
- Icon row `gap-x-inline-md gap-y-stack-md`: `itemSpacing` 12 -> `spacing/inline/gap-md` (row axis) and `counterAxisSpacing` 12 -> `spacing/stack/stack-md` (wrap axis). Both are 12px today, but Figma binds two distinct variables, so the axis rule needs two tokens, not a flat `gap-3`.

## Gotchas
- Desktop frame `3891:18024` also contains `3957:11962`, an unrelated stray "Add recipe" panel instance. Not built; read `3957:11537` directly.
- Stories must be wrapped in `<div className="min-h-screen">` (the `SidePanel` overlay is `position: fixed`, and `tests/visual/screenshot-override.css` forces Ladle's own wrapper to `min-height: 0`). Without it the baselines crop to 1280x64, contain none of the panel, and pass byte-identical whatever changes inside. `CardDetailPanel.stories.tsx` inherits this bug (#106); the correct baselines are 1280x784 (#125). `Interactive` starts closed and does not need the wrapper.
- A stale `ladle preview` on port 4310 is reused by Playwright (`reuseExistingServer: !CI`) and can serve an outdated build to `--update-snapshots`; kill it first.
- `BoardPanel.tsx` still uses the old `key` remount (its "same reasoning as CardDetailPanel's key" comment is stale); left alone because its header-only trigger never hits a target-changing open.

## Open
- `docs/open-questions.md#notes-category-panel-not-designed`
