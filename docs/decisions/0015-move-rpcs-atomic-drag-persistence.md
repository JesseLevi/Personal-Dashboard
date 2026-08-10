# ADR-0015: RPC-backed atomic move for drag & drop (`move_card` / `move_recipe`)

**Status**: Accepted

## Context

Issue #169 traced the ~2s pause between dropping a card/recipe and the drag visually settling to two compounding causes in `app/(app)/te-doen/actions.ts`'s `moveCard` and `app/(app)/recepten/actions.ts`'s `moveRecipe`:

1. Each action ran an **auth → card/recipe lookup → target-column/category lookup → siblings lookup → update** chain — four sequential round trips to resolve ownership, check the target is legal, and compute the new fractional position (`lib/boards/positioning.ts`'s `nextPosition`) — before the row was ever updated.
2. Both actions called `revalidatePath("/te-doen")` / `revalidatePath("/recepten")` on success. Inside a Server Action, `revalidatePath` bundles a re-rendered RSC payload into the *same* response, so the client waited for a full page re-render on top of the four round trips — even though the board/category UI already applies the move optimistically and doesn't need the server's copy back.

`public.replace_recipe_contents` (#149, `20260802000001_recipe_step_ingredients.sql`) had already established this repo's first non-trivial RPC: a `security invoker`, `set search_path = ''` Postgres function that re-checks ownership explicitly (RLS governs every statement inside it, same as if the caller issued them directly) and does its multi-statement write in one atomic round trip instead of several from the Next.js server action.

## Decision

- Delete `revalidatePath` from `moveCard` and `moveRecipe`. Both actions already return the new `position` to a UI that applies it optimistically; nothing downstream needs a server-refreshed page as part of the same response.
- Add `type: "layout"` to every *other* `revalidatePath("/te-doen")` / `revalidatePath("/recepten")` call in these two files. Next.js only revalidates a bare path by exact match — a dynamic child route (`/te-doen/[boardId]`, `/recepten/[recipeId]`) was never being revalidated by any of these actions, a pre-existing bug this ticket also closes while it's in the area.
- Replace the four-query chain in both actions with one call each to two new RPCs, `public.move_card(p_card_id, p_column_id, p_target_index)` and `public.move_recipe(p_recipe_id, p_category_id, p_target_index)` (`20260810000002_move_rpcs.sql`), following the `replace_recipe_contents` precedent exactly: `security invoker`, `set search_path = ''`, an explicit ownership guard in the function body (belt-and-braces on top of RLS, not a replacement for it), one atomic statement doing lookup + validation + position math + update.
- Port `nextPosition`'s midpoint rule (and its `InvalidNeighborOrderError` case) into SQL faithfully rather than reimplementing the logic differently server-side. The TypeScript version and its test suite (`tests/boards-positioning.test.ts`) stay as the reference implementation — the SQL copy is reviewed against it, not tested independently in pgTAP (no property-style bisection assertion exists in that harness).
- Signal errors from the RPC via custom 5-character SQLSTATEs (`MV404` not-found, `MV409` — `move_card` only — column-mismatch) rather than message-string matching, so the calling action can map them back onto the exact same `ActionResult` error codes (`invalid-input`, `not-found`, `column-mismatch`, `generic`) the four-query implementation returned. The UI's error handling is unchanged; only the transport underneath it moved.

## Consequences

- A drop now costs one round trip instead of five (four queries + the bundled re-render), which is the ticket's actual fix for the perceived hang.
- `move_card` and `move_recipe` are the second and third RPCs in this codebase, cementing "atomic multi-step write → RPC, `security invoker` + explicit ownership guard" as this repo's standing pattern for any Server Action that would otherwise need more than one dependent round trip to do its job safely. `replace_recipe_contents` was the first instance of this pattern for a *replace*-shaped write; `move_card`/`move_recipe` are the first instance for a *reposition*-shaped write, and the pattern is expected to be reached for again rather than re-litigated.
- The position math now has two representations (TypeScript, SQL) that must be kept in sync by hand — no codegen bridges them. Accepted the same way `replace_recipe_contents` already duplicates recipe-write logic that used to live only in TypeScript: the alternative (calling out to a shared implementation from SQL) doesn't exist in this stack, and the midpoint rule is small and stable enough that manual sync is a low ongoing cost.
- `lib/database.types.ts` (hand-maintained, no local Docker to regenerate it — see that file's header) gained `move_card`/`move_recipe` entries in `Database["public"]["Functions"]`; CI's regeneration-drift check (when it exists, #190) must agree with the hand-written shape the same way it already must for `replace_recipe_contents`.
- `supabase/tests/rls-move-rpcs.sql` extends ADR-0009's two-user isolation discipline to these two functions specifically (a foreign card/recipe and a foreign-or-other-board column/category are both rejected), matching `rls-recipe_step_ingredients.sql`'s precedent for asserting an RPC's own ownership guard fires for a real, resolvable id belonging to another user — not just that RLS blocks the lookup.
