# ShoppingListPanel
Figma: `Winkelmand/03` node `4231:16736`, and `Winkelmand/07` `4233:17612` for the chosen person (mobile 402px; no desktop pair drawn) · Code: `app/(app)/winkelmand/ShoppingListPanel.tsx`

## Anatomy
Page-level composition of `SidePanel` + `InputField` + `Button` (add/edit basket), same precedent as `BoardPanel` / `CategoryPanel`; not an atomic-design leaf, so not in `design/figma-map.json`. No new component or token: the node binds the same variables the existing atoms already read. For the owner, edit mode also holds the "Delen met persoon" field, which opens `MemberSearchPanel` (level 2).

## Contract
- Props: `open`, `onClose`, `target` (`{mode: "create"}` or `{mode: "edit", list}` with `list: ShoppingListOption {id, name, isDefault, isOwner, shared}`), the three basket actions (`onCreateList`, `onRenameList`, `onDeleteList`, each `(input: unknown) => Promise<ActionResult>`), the three sharing actions (`onSearchMembers`, `onInviteMember`, `onRevokeShare`, sharing `ActionResult`s), `onLeaveList`, `owner` (member view), `share` (`ListShare | null`: the owner's current member and status) and result callbacks `onCreated(row)`, `onRenamed()`, `onDeleted()`. It never imports `"use server"` code, so Ladle passes mocks.
- `ShoppingListOption.name` is already the display name: the page resolves a null DB name to `shopping.lists.defaultName` ("Mijn mand" / "My basket").
- Create: Naam + Opslaan. Edit: Naam prefilled, "Verwijder mand" (destructive, `Trash`) + Opslaan, each `grow basis-0` as in the footer node.
- Delete is hidden when `list.isDefault` (the default basket cannot be deleted; RLS agrees). Delete uses the shared two-step `DeleteConfirm` (`layout="stacked"`), since the node draws no confirm.
- Opslaan is disabled while the trimmed name is empty or a request is pending. Errors render inline from `shopping.errors.*`.
- Sharing (#426): the field shows in create mode and in edit mode when `list.isOwner`; members never see it. In create mode the optional person is invited right after the basket is created (a failed invite does not undo the basket). The page loads `share` server-side (`getShoppingListShare`, RLS-based) and passes it only to the owner.
- The field is a read-only `InputField` (`User` leading icon, placeholder "Kies", trailing `Plus`); clicking it, or Enter/Space, opens the member search. "Voeg toe" only fills the field; nothing is written until Opslaan.
- Opslaan runs rename, then brings the share in line with the field: `revokeShare` for the old person, `inviteMember` for the new one (changing person = both). A revoke answering `not-found` counts as done. Errors render from `sharing.errors.*` (including `rate-limited`); the panel stays open, and the page is refreshed if the rename or revoke already landed. Success is never faked.
- Status Tag: a yellow `Tag variant="highlight"` "Delen wordt actief na toestemming" while the shown person is pending, or newly picked (always a fresh pending invite). Accepted: no Tag.
- **Deliberate addition, not in Figma:** once a person is chosen the trailing icon turns from `Plus` into an `X` button ("Stop met delen met {name}"). It clears the field, and Opslaan then calls `revokeShare` (withdraws a pending invite or removes an accepted member). Same trailing-icon button pattern as the search field clear.
- v1: one person per basket (ADR-0035 point 11); picking someone else replaces the current person.
- Member view (#427, not drawn in Figma, designed in code): `list.isOwner` false. Name is a read-only `InputField`, followed by a read-only "Eigenaar" field (`User`, the `owner` prop, full name). No sharing field, no rename, no delete. The footer is one destructive "Verlaat mand" (`LogOut`) behind the shared two-step `DeleteConfirm`; it calls `onLeaveList({resource, id})` (`leaveShare`) and then `onDeleted` (the caller goes to the user's own default basket). Errors from `sharing.errors.*`.
- State resets on open or target change (CategoryPanel's pattern, not a `key` remount, which would break the first open transition).
- Strings: `components.shoppingListPanel.*`.

## Token gaps and flags
- Footer row `gap-inline-sm`: node `4231:16743` is horizontal with `itemSpacing` bound to `spacing/inline/gap-sm`.

## Gotchas
- Stories `CreateList`, `EditList` (owner, not shared), `EditDefaultList`, `EditListSharedPending`, `EditListSharedAccepted`, `EditListAsMember` sit in a `min-h-screen` wrapper: `SidePanel` is `position: fixed`, so without it the baseline collapses.
- `ci-visual.yml` also triggers on `app/(app)/winkelmand/*Panel.tsx`.
