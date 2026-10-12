# ShoppingListPanel
Figma: `Winkelmand/03` node `4231:16736` (mobile 402px; no desktop pair drawn) · Code: `app/(app)/winkelmand/ShoppingListPanel.tsx`

## Anatomy
Page-level composition of `SidePanel` + `InputField` + `Button` (add/edit basket), same precedent as `BoardPanel` / `CategoryPanel`; not an atomic-design leaf, so not in `design/figma-map.json`. No new component or token: the node binds the same variables the existing atoms already read. Only the Naam field is built; the "Delen met persoon" field is drawn but belongs to the sharing ticket.

## Contract
- Props: `open`, `onClose`, `target` (`{mode: "create"}` or `{mode: "edit", list}` with `list: ShoppingListOption {id, name, isDefault}`), the three actions (`onCreateList`, `onRenameList`, `onDeleteList`, each `(input: unknown) => Promise<ActionResult>`), and result callbacks `onCreated(row)`, `onRenamed()`, `onDeleted()`. It never imports `"use server"` code, so Ladle passes mocks.
- `ShoppingListOption.name` is already the display name: the page resolves a null DB name to `shopping.lists.defaultName` ("Mijn mand" / "My basket").
- Create: Naam + Opslaan. Edit: Naam prefilled, "Verwijder mand" (destructive, `Trash`) + Opslaan, each `grow basis-0` as in the footer node.
- Delete is hidden when `list.isDefault` (the default basket cannot be deleted; RLS agrees). Delete uses the shared two-step `DeleteConfirm` (`layout="stacked"`), since the node draws no confirm.
- Opslaan is disabled while the trimmed name is empty or a request is pending. Errors render inline from `shopping.errors.*`.
- State resets on open or target change (CategoryPanel's pattern, not a `key` remount, which would break the first open transition).
- Strings: `components.shoppingListPanel.*`.

## Token gaps and flags
- Footer row `gap-inline-sm`: node `4231:16743` is horizontal with `itemSpacing` bound to `spacing/inline/gap-sm`.

## Gotchas
- Stories `CreateList`, `EditList`, `EditDefaultList` sit in a `min-h-screen` wrapper: `SidePanel` is `position: fixed`, so without it the baseline collapses.
- `ci-visual.yml` also triggers on `app/(app)/winkelmand/*Panel.tsx`.
