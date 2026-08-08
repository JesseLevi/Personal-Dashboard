import type { Database } from "@/lib/database.types";

// Read-side row type plus the write-side ActionResult/ShoppingErrorCode
// contract for app/(app)/winkelmand/actions.ts -- same split as
// lib/recipes/types.ts (#122), scoped down for #176.

export type ShoppingListItemRow = Database["public"]["Tables"]["shopping_list_items"]["Row"];

// Every write action (app/(app)/winkelmand/actions.ts) returns one of these
// instead of throwing or returning a bare string -- same shape and reasoning
// as lib/recipes/types.ts's ActionResult/RecipesErrorCode. Deliberately
// smaller than RecipesErrorCode: no thumbnail-upload variants exist for a
// shopping list item.
export type ShoppingErrorCode = "invalid-input" | "unauthenticated" | "not-found" | "generic";

export type ActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: ShoppingErrorCode };
