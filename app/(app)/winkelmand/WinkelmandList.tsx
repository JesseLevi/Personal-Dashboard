"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/organisms/PageHeader";
import { Button } from "@/components/atoms/Button";
import { Card } from "@/components/molecules/Card";
import { CardContentIngredient } from "@/components/molecules/CardContentIngredient";
import { formatQuantity } from "@/lib/recipes/units";
import { formatQuantityFraction } from "@/lib/recipes/kitchen-units";
import { toggleShoppingListItem, deleteShoppingListItem, clearShoppingList } from "./actions";
import type { ActionResult, ShoppingListItemRow } from "@/lib/shopping/types";

// Client owner of row interactions (#177), same split as ReceptenBoard.tsx.
// No moveQueue/pendingMoves *sequencing* is needed here the way
// ReceptenBoard.tsx's drag-and-drop needs one: every action here targets one
// row by `id` and never recomputes a position against sibling rows, so two
// concurrent toggles can never race each other's math. `pendingActions` is
// still a *count* (not a boolean), for the same reason ReceptenBoard.tsx's
// `pendingMoves` is: it guards the `items` prop -> `localItems` resync below
// against a server-action-triggered background revalidation clobbering an
// optimistic update that's still in flight, and two actions can overlap.
export interface WinkelmandListProps {
  items: ShoppingListItemRow[];
  /** Page title (`nav.shopping`). */
  title: string;
  /** Header "Alles verwijderen" button label. */
  clearAllLabel: string;
  /** Rendered instead of the Card when the list is empty -- no empty state
   * is drawn in Figma, see docs/open-questions.md#winkelmand-empty-state-undesigned. */
  emptyStateText: string;
}

export function WinkelmandList({ items, title, clearAllLabel, emptyStateText }: WinkelmandListProps) {
  // Long-form recipes.units labels are the ingredient-CARD Tag's usual
  // convention (RecipeDetailPage.tsx), but the fetched Winkelmand node
  // itself draws abbreviated labels + ASCII fractions ("1 cup", "2 tbs",
  // "1/4 cup") -- the same recipes.unitsShort + formatQuantityFraction pair
  // RecipeDetailPage.tsx's per-STEP Tag uses. Built to match the fetched
  // node directly, not the other page's precedent. See
  // design/notes/WinkelmandPage.md.
  const tUnitsShort = useTranslations("recipes.unitsShort");
  const tErrors = useTranslations("shopping.errors");
  const tDeleteLabel = useTranslations("shopping.page");

  const [localItems, setLocalItems] = useState(items);
  const pendingActions = useRef(0);
  useEffect(() => {
    if (pendingActions.current === 0) setLocalItems(items);
  }, [items]);

  const [actionError, setActionError] = useState<string | null>(null);

  function quantityLabel(item: ShoppingListItemRow): string | undefined {
    if (item.quantity === null) return undefined;
    return item.unit
      ? formatQuantityFraction(item.quantity, item.unit, tUnitsShort(item.unit))
      : formatQuantity(item.quantity, null);
  }

  function runAction(
    optimisticUpdate: (current: ShoppingListItemRow[]) => ShoppingListItemRow[],
    action: () => Promise<ActionResult>,
  ) {
    setActionError(null);
    const previous = localItems;
    pendingActions.current += 1;
    setLocalItems(optimisticUpdate);
    action()
      .then((result) => {
        if (!result.success) {
          setLocalItems(previous);
          setActionError(tErrors(result.error));
        }
      })
      .catch(() => {
        setLocalItems(previous);
        setActionError(tErrors("generic"));
      })
      .finally(() => {
        pendingActions.current -= 1;
      });
  }

  function handleToggle(item: ShoppingListItemRow) {
    const nextChecked = !item.checked;
    runAction(
      (current) => current.map((row) => (row.id === item.id ? { ...row, checked: nextChecked } : row)),
      () => toggleShoppingListItem({ id: item.id, checked: nextChecked }),
    );
  }

  function handleDelete(item: ShoppingListItemRow) {
    runAction(
      (current) => current.filter((row) => row.id !== item.id),
      () => deleteShoppingListItem({ id: item.id }),
    );
  }

  function handleClearAll() {
    // No confirmation step -- Figma draws none for this button, unlike the
    // recipe-detail delete's two-step confirm. See
    // docs/open-questions.md#winkelmand-clear-all-no-confirmation.
    runAction(() => [], () => clearShoppingList());
  }

  return (
    <>
      <PageHeader
        title={title}
        actions={
          <Button variant="destructive" icon="Trash" onClick={handleClearAll}>
            {clearAllLabel}
          </Button>
        }
      />
      {actionError && <p className="text-base font-semibold text-priority-urgent">{actionError}</p>}
      {localItems.length === 0 ? (
        <p className="text-base font-semibold text-text-muted">{emptyStateText}</p>
      ) : (
        <Card>
          {localItems.map((item, index) => (
            <CardContentIngredient
              key={item.id}
              name={item.name}
              quantity={quantityLabel(item)}
              checked={item.checked}
              onCheckedToggle={() => handleToggle(item)}
              divider={index < localItems.length - 1}
              swipeToDelete
              onDelete={() => handleDelete(item)}
              deleteLabel={tDeleteLabel("deleteItemLabel", { name: item.name })}
            />
          ))}
        </Card>
      )}
    </>
  );
}
