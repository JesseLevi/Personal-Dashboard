// The Recepten -> Boodschappenlijst hand-off (#178, sub-ticket of #29).
// Pure, framework-free, no Supabase import -- same house style as
// lib/recipes/scaling.ts / lib/boards/positioning.ts, testable without a
// database (tests/shopping-send-to-list.test.ts).
//
// -- THE RULE (Architecture §4.2, #29) --------------------------------------
// Portion scaling happens in the app layer AT SEND TIME. shopping_list_items
// stores already-resolved values and carries no servings factor -- this
// module is where "already-resolved" gets computed, once, right before the
// insert. Scaling itself is delegated entirely to scaleIngredientRows
// (lib/recipes/scaling.ts) -- no arithmetic reimplemented here, and no
// `unitSystem` is passed through: cup/ounce conversion at send time is a
// caller opt-in this ticket doesn't ask for, not a default.
//
// -- Merge rule: same name AND same unit -------------------------------------
// Two scaled rows merge into one shopping-list line iff both their `name`
// AND their `unit` match. Never across units -- "1 cup bloem" and "200 gram
// bloem" stay two separate lines even though they name the same ingredient;
// bridging mass<->volume is lib/recipes/mass-resolution.ts's job and
// deliberately has no UI entry point (see that module's own header).
//
// Name matching is normalised (trimmed + locale-lowercased), not
// case-sensitive: two recipes spelling the same ingredient "Bloem" and
// "bloem" should collapse into one line rather than leave a user two
// visually-near-identical rows to notice and merge by hand. The DISPLAYED
// name on the merged line is the first-seen row's own original, unnormalised
// `name` -- the normalised key is only ever used to compare, never rendered.
// Units are never normalised this way: UnitCode is a closed enum, not free
// text, so an exact match is already exact.
//
// -- null quantity rule -------------------------------------------------------
// `null` means "naar smaak" / unspecified and must never silently become 0.
// Merging two same-unit rows where exactly one side is `null` keeps the
// numeric side -- a known quantity is strictly more useful on a shopping
// list than discarding it because an unrelated line said "naar smaak."
// `null` only wins when BOTH merging rows are `null`.

import { scaleIngredientRows } from "@/lib/recipes/scaling";
import type { UnitCode } from "@/lib/recipes/units";

export interface SendToListIngredient {
  name: string;
  quantity: number | null;
  unit: UnitCode;
  /** #179: `reference.ingredients.id`, for Voedingsgroep grouping on the Winkelmand page. Optional -- existing callers/tests that don't pass it behave exactly as before (see mergeKey's own first-seen-wins reasoning for `name`). */
  referenceIngredientId?: string | null;
}

export interface ShoppingListLine {
  name: string;
  quantity: number | null;
  unit: UnitCode;
  referenceIngredientId?: string | null;
}

/** A row already stored in `shopping_list_items` -- the merge target for
 * `mergeSingleIngredientLine` below. `unit` is nullable (a manually-typed
 * item may carry none, #175/#176) unlike a recipe ingredient's own
 * always-set `unit`; such a row can never match (`mergeKey` needs a real
 * `UnitCode` on both sides), so it's simply excluded from the search. */
export interface ExistingShoppingListLine {
  id: string;
  name: string;
  quantity: number | null;
  unit: UnitCode | null;
}

export type SingleItemMergeResult =
  | { kind: "update"; id: string; quantity: number | null }
  | { kind: "insert"; line: ShoppingListLine };

function mergeKey(name: string, unit: UnitCode): string {
  // NUL separator, written as an escape and never as a raw byte: no
  // name/unit pair can collide across it (names are user text but never
  // contain NUL; UnitCode is a closed enum), and a literal NUL in the
  // source makes git treat this whole file as binary and stop diffing it.
  return `${name.trim().toLocaleLowerCase()}\u0000${unit}`;
}

function mergeQuantities(a: number | null, b: number | null): number | null {
  if (a === null && b === null) return null;
  return (a ?? 0) + (b ?? 0);
}

/**
 * Scales `ingredients` from `sourcePortions` (the recipe's own stored
 * `servings`) to `targetPortions` (the caller's chosen portion count at send
 * time) via `scaleIngredientRows`, then merges same-name/same-unit rows into
 * one shopping-list line each, summing their quantities. Order-preserving:
 * each output line keeps the position of its first-seen matching input row.
 * An empty `ingredients` list returns an empty array.
 */
export function buildShoppingListLines<T extends SendToListIngredient>(
  ingredients: readonly T[],
  sourcePortions: number,
  targetPortions: number,
): ShoppingListLine[] {
  const scaled = scaleIngredientRows(ingredients, sourcePortions, targetPortions);

  const order: string[] = [];
  const byKey = new Map<string, ShoppingListLine>();

  for (const ingredient of scaled) {
    const key = mergeKey(ingredient.name, ingredient.unit);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, {
        name: ingredient.name,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        // First-seen wins, same rule as the displayed `name` above -- never
        // overwritten on a later merge.
        referenceIngredientId: ingredient.referenceIngredientId,
      });
      order.push(key);
      continue;
    }
    existing.quantity = mergeQuantities(existing.quantity, ingredient.quantity);
  }

  return order.map((key) => byKey.get(key)!);
}

/**
 * #179 part 2: the swipe-to-cart single-ingredient add (app/(app)/winkelmand/
 * actions.ts's `addIngredientToShoppingList`). Scales one recipe ingredient
 * to `targetPortions` (same `scaleIngredientRows` call `buildShoppingListLines`
 * makes for a whole recipe, just given a one-element array) and applies this
 * module's own same-name/same-unit merge rule -- but against rows that
 * already exist in the database, not a second batch being merged with
 * itself. A pure decision only: the caller (a Server Action, since this
 * module stays Supabase-free) does the actual update-or-insert.
 */
export function mergeSingleIngredientLine<T extends SendToListIngredient>(
  ingredient: T,
  sourcePortions: number,
  targetPortions: number,
  existingLines: readonly ExistingShoppingListLine[],
): SingleItemMergeResult {
  const [scaled] = scaleIngredientRows([ingredient], sourcePortions, targetPortions);
  const key = mergeKey(scaled.name, scaled.unit);
  const match = existingLines.find(
    (line) => line.unit !== null && mergeKey(line.name, line.unit) === key,
  );
  if (match) {
    return { kind: "update", id: match.id, quantity: mergeQuantities(match.quantity, scaled.quantity) };
  }
  return {
    kind: "insert",
    line: {
      name: scaled.name,
      quantity: scaled.quantity,
      unit: scaled.unit,
      referenceIngredientId: scaled.referenceIngredientId,
    },
  };
}
