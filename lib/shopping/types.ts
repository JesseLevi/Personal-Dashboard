import type { Database } from "@/lib/database.types";

// Read-side row type plus the write-side ActionResult/ShoppingErrorCode
// contract for app/(app)/winkelmand/actions.ts -- same split as
// lib/recipes/types.ts (#122), scoped down for #176.

export type ShoppingListItemRow = Database["public"]["Tables"]["shopping_list_items"]["Row"];

// #179: the Winkelmand page's own read shape -- the base row plus the two
// fields its Recept/Voedingsgroep grouping needs, resolved by
// getShoppingListItems() in one batched round trip each (never per-row):
// the source recipe's title (embedded via the existing recipe_id FK) and
// the linked reference.ingredients row's bilingual food-group name. All
// three are null wherever the underlying link is null (manually-added item,
// no recipe, or no library match) -- WinkelmandList.tsx's own grouping
// falls those rows into the shared "Overig"/"Other" group.
export type ShoppingListItemWithGroupInfo = ShoppingListItemRow & {
  recipeName: string | null;
  categoryNl: string | null;
  categoryEn: string | null;
};

// Every write action (app/(app)/winkelmand/actions.ts) returns one of these
// instead of throwing or returning a bare string -- same shape and reasoning
// as lib/recipes/types.ts's ActionResult/RecipesErrorCode. Deliberately
// smaller than RecipesErrorCode: no thumbnail-upload variants exist for a
// shopping list item.
export type ShoppingErrorCode = "invalid-input" | "unauthenticated" | "not-found" | "generic";

export type ActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: ShoppingErrorCode };
