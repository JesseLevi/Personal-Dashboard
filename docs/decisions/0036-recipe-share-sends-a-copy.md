# ADR-0036: Sharing a recipe sends a copy

**Status**: Accepted (user decision, 2026-10-13, #464).

## Context

- The user wants a "Delen" button on the recipe page that opens the same person picker as basket sharing (`MemberSearchPanel`). The recipient sees the offer at the top of the first category on their Recepten board, marked "Gedeeld door {first name}", with accept (check) and decline (cross).
- ADR-0035 shares containers live: an accepted member reads and edits the owner's rows. For a single recipe that would mean member policies on `recipes`, `recipe_ingredients`, `recipe_steps` and `recipe_step_ingredients`, a per-member board position, and cross-user thumbnail access.
- Asked on 2026-10-13, the user chose a **copy**: after accepting, the recipient owns an independent recipe.

## Decision

1. **A recipe share is an offer, not a membership.** Accepting copies the recipe into the recipient's own data. Afterwards the two recipes are unrelated; edits never propagate.
2. **It reuses `public.shares`** (ADR-0035's single invitation table): a nullable `recipe_id references public.recipes on delete cascade`, the exclusive-arc check widened to `num_nonnulls(shopping_list_id, recipe_id) = 1`, and `unique (recipe_id, member_id)`.
   - A recipe row never becomes `accepted`: a check constraint `recipe_id is null or status = 'pending'` holds that.
   - Only the recipe's owner inserts (the insert policy gains a recipe branch: `recipes.user_id = auth.uid()`).
   - Decline and the owner's revoke delete the row, as in ADR-0035. Accepting deletes it too, after the copy.
   - The owner deleting the recipe cascades the pending offer away.
3. **The invitee sees the offer only through a definer RPC**, `public.pending_recipe_shares()`: share id, recipe id, title, `time_minutes`, `thumbnail_path`, inviter id and first name, and `created_at`, for the caller's own pending recipe rows only. The `recipes` policies are never widened (ADR-0035 points 4 and 5).
4. **Accepting is one definer RPC**, `public.accept_recipe_share(p_share_id uuid)`:
   - it checks the caller is that row's `member_id` and the row is a pending recipe share, else raises;
   - it inserts the copy with `user_id = auth.uid()` into the caller's first `recipe_categories` row (lowest `position`), at the top of that column, with `import_status = 'done'` and `thumbnail_path = null`;
   - it copies ingredients (keeping `group_label`, `needs_review`, `position`), steps and step–ingredient links;
   - `ingredient_id` is remapped to the caller's own `ingredients` row: the one with the same `reference_id`, else for a self-added source the caller's self-added row with the same name (case-insensitive), else a new row. The source user's private ingredient rows are never referenced;
   - it deletes the share and returns the new recipe id plus the source `thumbnail_path`.
   
   Definer is needed because the invitee cannot read the source under RLS. That is a deliberate exception to ADR-0015's invoker rule, limited by the guard above, and covered by pgTAP for the member, the owner, a stranger and a second accept.
5. **The thumbnail is copied in server code** (`lib/storage`, ADR-0024): after the RPC, the server action reads both variants of the source stem and writes them under the recipient's `<user_id>/recipes/<uuid>`, then sets `thumbnail_path`. A failed copy leaves the recipe without a photo; it never fails the accept. The pending card's thumbnail is presigned server-side from the path the RPC returned; the path never reaches the browser.
6. `lib/sharing` gets resource type `recipe`. `inviteMember`, `declineShare` and `revokeShare` work unchanged through `SHARE_COLUMN`. Accept for recipes is its own action, not `acceptShare`.
7. There is no polling: the offer shows on the next Recepten load.

## Consequences

- Sharing a recipe adds no new access path to the owner's data beyond two narrow definer RPCs.
- The sender's per-user `ingredient_unit_masses` overrides are not copied. The copy's nutrition may therefore differ for self-added ingredients until the recipient relinks them; reference-backed ingredients resolve the same.
- A recipient who accepts twice (two offers) gets two copies. Nothing deduplicates.
- Live recipe sharing (ADR-0035's "single recipe" container) stays possible later. It would be a new `role`/status path, not this one.
- `pending_share_invites()` keeps returning baskets only (inner join on `shopping_lists`).
