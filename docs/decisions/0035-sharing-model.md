# ADR-0035: Sharing model: containers shared through one `shares` table, access decided in policies

**Status**: Accepted (user decision, 2026-10-12, #421). **Supersedes** ADR-0001.

## Context

- ADR-0001 kept every row private to its `user_id` and promised a sharing ADR once sharing was built. Its "staying sharing-ready" rules still hold and are folded in below.
- The first feature is sharing a shopping basket (epic #420, Figma `Pages/Winkelmand/Sharing update` `4233:17988`). Te doen boards, recipe collections and single recipes should follow the same model later without a rebuild.
- `shopping_list_items` hangs directly off a user today: there is no basket row to share.

Alternatives weighed:
- (a) one membership table per shareable type;
- (b) one polymorphic table (`resource_type` + `resource_id`, no foreign key);
- (c) households or workspaces that own everything;
- (d) one `shares` table with one nullable foreign key per shareable type (an exclusive arc).

(d) keeps foreign keys, cascades, one invitation flow and one UI. (b) loses referential integrity. (c) is the migration ADR-0001 declined.

## Decision

1. **Sharing happens per container**: a basket now, later a board, a recipe collection (`recipe_categories`) or a single recipe. Rows inside a container are never shared on their own.
2. **`user_id` stays the owner.** A row inside a container carries the container owner's `user_id`, even when a member adds it; a trigger sets it. Access to the rows follows from the container.
3. **One table, `public.shares`**:
   - `user_id` (owner and inviter) and `member_id`, both `references auth.users on delete cascade`, with `member_id <> user_id`;
   - one nullable foreign key per shareable type (`shopping_list_id … on delete cascade`) and `check (num_nonnulls(shopping_list_id) = 1)`. A new type adds a column and widens that check;
   - `status` `pending|accepted`, `role` `editor` (room for `viewer` later), `responded_at`;
   - unique per (container, member).
   
   Declining, leaving and revoking all delete the row. There is no `declined` state.
4. **Policies decide access** (ADR-0033):
   - **Through helper functions**: one `private.<type>_role(id)` per type returns `owner`, `editor` or null. It is `security definer stable` with `search_path = ''`, so container and `shares` policies never recurse into each other.
   - **Owner**: everything.
   - **Accepted `editor`**: reads the container; inserts, updates and deletes its rows (add, tick off, remove, clear); deletes its own share (leave).
   - **Pending invitee**: sees nothing of the container.
   - **Owner only**: renaming, inviting and revoking, and deleting the container.
   - **Write limits on `shares`**: only the owner inserts, always as `pending`/`editor`. A member may only flip its own row to `accepted`, enforced by `grant update (status, responded_at)` plus the policy.
5. **Consent**: a share is active only after the member accepts. The invitee sees who invited them and the container's name through `pending_share_invites()`, not through the container's policies.
6. **Other people's profiles** are readable only through definer RPCs that return name and avatar. The `profiles` policies are never widened.
   - `member_profiles(ids)` returns only users the caller shares something with, in either direction and any status.
   - `search_members(q)` finds **all members by first or last name**. It requires 2 to 64 characters, returns at most 8 results, leaves out the caller and deleted or banned users, and returns the e-mail address only when `q` is exactly that address.
   - The search is rate-limited in a `private` table, using ADR-0031's pattern: 30 per user and 500 globally per 15 minutes.
   - **Accepted trade-off**: any member can look up the names of other members. Atlas is a closed circle without self-signup.
7. **Freshness without realtime.** The browser never talks to Supabase (ADR-0033), so a shared container is re-read on the server:
   - on focus and when the tab becomes visible;
   - every 15 s while the tab is visible.
   
   A personal container never polls. An in-flight optimistic update is never overwritten.
8. **Generic seams**:
   - `lib/sharing/` holds a zod enum of resource types plus invite, accept, decline, leave, revoke, search and pending-invite actions.
   - The UI organisms (member search panel, invite banner, `AvatarGroup`) know nothing about baskets.
9. **Account deletion cascades.** When an owner's account goes, its containers and their shares go with it. When a member's account goes, only that member's shares go.
10. **Baskets**: `public.shopping_lists` is the first container. Every user has exactly one `is_default` basket, seeded through ADR-0017.
    - The default basket cannot be deleted.
    - With a null `name`, it shows the translated "Mijn mand" / "My basket".
    - Each basket has its own route, `/winkelmand/[listId]`.
11. **Scope of the first UI**: one member per basket, as Figma draws it. The model allows more.

## Consequences

- Sharing a new type later means:
  - adding a column to `shares` and widening its check;
  - adding a role function;
  - adding owner-or-member policies on that type's tables;
  - extending the resource enum in `lib/sharing/`.

  The UI organisms are reused.
- Every shareable table's policies now call a definer function. Those functions are part of the security surface and each needs pgTAP coverage for the owner, editor, pending and stranger roles.
- ADR-0001's sharing-ready rules still apply to modules that are not shared yet:
  - access is decided in policies;
  - every module keeps a clear owning container;
  - `user_id` means owner, not "the only reader".
- Two members editing at once can produce equal `position` values; ordering breaks ties on `created_at`.
- Polling costs one server render per 15 s per open shared basket. That is acceptable for a small circle, and it is the first thing to revisit if usage grows.
