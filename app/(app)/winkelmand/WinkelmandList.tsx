"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { PageHeader } from "@/components/organisms/PageHeader";
import { Button } from "@/components/atoms/Button";
import { Dropdown } from "@/components/atoms/Dropdown";
import type { IconName } from "@/components/atoms/Icon";
import { Card } from "@/components/molecules/Card";
import { CardContentIngredient } from "@/components/molecules/CardContentIngredient";
import { formatQuantity } from "@/lib/recipes/units";
import { formatQuantityFraction } from "@/lib/recipes/kitchen-units";
import { toggleShoppingListItem, deleteShoppingListItem, clearShoppingList } from "./actions";
import type { ActionResult, ShoppingListItemWithGroupInfo } from "@/lib/shopping/types";

// Client owner of row interactions (#177), same split as ReceptenBoard.tsx.
// No moveQueue/pendingMoves *sequencing* is needed here the way
// ReceptenBoard.tsx's drag-and-drop needs one: every action here targets one
// row by `id` and never recomputes a position against sibling rows, so two
// concurrent toggles can never race each other's math. `pendingActions` is
// still a *count* (not a boolean), for the same reason ReceptenBoard.tsx's
// `pendingMoves` is: it guards the `items` prop -> `localItems` resync below
// against a server-action-triggered background revalidation clobbering an
// optimistic update that's still in flight, and two actions can overlap.
//
// #179: grouped by source recipe (default) or NEVO food group ("Recept"/
// "Voedingsgroep" — Sort dropdown, exact click-outside/z-999 pattern reused
// from app/(app)/te-doen/TeDoenHeader.tsx's own sort menu, per the fetched
// node's annotation). Full grouping/ordering reasoning:
// design/notes/WinkelmandPage.md.
export interface WinkelmandListProps {
  items: ShoppingListItemWithGroupInfo[];
  /** Page title (`nav.shopping`). */
  title: string;
}

type SortBy = "recipe" | "foodGroup";
const SORT_OPTIONS: SortBy[] = ["recipe", "foodGroup"];
const SORT_ICONS: Record<SortBy, IconName> = {
  recipe: "FolderClosed",
  foodGroup: "Broccoli",
};

interface Group {
  key: string;
  label: string;
  items: ShoppingListItemWithGroupInfo[];
}

// Bilingual pick, same "en if present else nl" convention
// IngredientSearchPanel.tsx's own resultDisplayName already uses for
// reference.ingredients' name_nl/name_en pair.
function categoryLabel(item: ShoppingListItemWithGroupInfo, locale: string): string | null {
  if (locale === "en" && item.categoryEn) return item.categoryEn;
  return item.categoryNl ?? item.categoryEn;
}

// Groups stay in first-seen order, which is `items`' own `position` order
// (getShoppingListItems, #175) -- the "first item's position decides its
// group's place" rule needs no separate sort. The one exception: a group
// with no real identity (no recipe / no resolvable category) is always
// pushed last, per the ticket's own "items with recipe_id = null go in a
// final group" instruction -- forced regardless of that item's own position.
const OTHER_KEY = "__other__";

function buildGroups(
  items: ShoppingListItemWithGroupInfo[],
  sortBy: SortBy,
  locale: string,
  otherLabel: string,
): Group[] {
  const order: string[] = [];
  const byKey = new Map<string, Group>();

  for (const item of items) {
    const identity = sortBy === "recipe" ? item.recipe_id : (item.categoryNl ?? item.categoryEn);
    const key = identity ?? OTHER_KEY;
    let group = byKey.get(key);
    if (!group) {
      const label =
        key === OTHER_KEY
          ? otherLabel
          : sortBy === "recipe"
            ? (item.recipeName ?? otherLabel)
            : (categoryLabel(item, locale) ?? otherLabel);
      group = { key, label, items: [] };
      byKey.set(key, group);
      order.push(key);
    }
    group.items.push(item);
  }

  const ordered = order.filter((key) => key !== OTHER_KEY);
  if (byKey.has(OTHER_KEY)) ordered.push(OTHER_KEY);
  return ordered.map((key) => byKey.get(key)!);
}

// Same click-outside-closes shape as TeDoenHeader.tsx's own
// useCloseOnOutsidePointerDown (#95) -- reimplemented here rather than
// imported, matching that file's own precedent of a small, page-local copy
// over a shared module for a single-caller interaction.
function useCloseOnOutsidePointerDown(
  ref: React.RefObject<HTMLElement | null>,
  active: boolean,
  onClose: () => void,
) {
  useEffect(() => {
    if (!active) return;
    function handlePointerDown(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [active, ref, onClose]);
}

export function WinkelmandList({ items, title }: WinkelmandListProps) {
  const router = useRouter();
  const locale = useLocale();
  // Long-form recipes.units labels are the ingredient-CARD Tag's usual
  // convention (RecipeDetailPage.tsx), but the fetched Winkelmand node
  // itself draws abbreviated labels + ASCII fractions ("1 cup", "2 tbs",
  // "1/4 cup") -- the same recipes.unitsShort + formatQuantityFraction pair
  // RecipeDetailPage.tsx's per-STEP Tag uses. Built to match the fetched
  // node directly, not the other page's precedent. See
  // design/notes/WinkelmandPage.md.
  const tUnitsShort = useTranslations("recipes.unitsShort");
  const tErrors = useTranslations("shopping.errors");
  const t = useTranslations("shopping.page");
  const tSort = useTranslations("shopping.page.sortOptions");

  const [localItems, setLocalItems] = useState(items);
  const pendingActions = useRef(0);
  useEffect(() => {
    if (pendingActions.current === 0) setLocalItems(items);
  }, [items]);

  const [actionError, setActionError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>("recipe");
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);
  useCloseOnOutsidePointerDown(sortMenuRef, sortMenuOpen, () => setSortMenuOpen(false));

  function quantityLabel(item: ShoppingListItemWithGroupInfo): string | undefined {
    if (item.quantity === null) return undefined;
    return item.unit
      ? formatQuantityFraction(item.quantity, item.unit, tUnitsShort(item.unit))
      : formatQuantity(item.quantity, null);
  }

  function runAction(
    optimisticUpdate: (current: ShoppingListItemWithGroupInfo[]) => ShoppingListItemWithGroupInfo[],
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

  function handleToggle(item: ShoppingListItemWithGroupInfo) {
    const nextChecked = !item.checked;
    runAction(
      (current) => current.map((row) => (row.id === item.id ? { ...row, checked: nextChecked } : row)),
      () => toggleShoppingListItem({ id: item.id, checked: nextChecked }),
    );
  }

  function handleDelete(item: ShoppingListItemWithGroupInfo) {
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

  const isEmpty = localItems.length === 0;
  const groups = isEmpty ? [] : buildGroups(localItems, sortBy, locale, t("otherGroupLabel"));

  return (
    <>
      <PageHeader
        title={title}
        // Figma's EmptyState header ("Knoppen" frame) carries no action
        // buttons at all -- verified against the fetched empty-state nodes
        // (4049:11175/4049:11167), not assumed. See
        // design/notes/WinkelmandPage.md.
        actions={
          isEmpty ? undefined : (
            // #182: a single flex wrapper mirroring Figma's own "Knoppen"
            // frame (row, gap 8px mobile / 20px desktop) -- both buttons
            // must be ONE child of PageHeader's actions slot, not two.
            // PageHeader's <header> is itself `justify-between` between
            // title and actions; passing the two buttons as Fragment
            // siblings made them three separate flex children of <header>,
            // so the header's own space-between spread Sort away from
            // Verwijder-alles instead of grouping them. See
            // design/notes/WinkelmandPage.md#182.
            // #182: the Sort wrapper is the positioning context at every
            // breakpoint -- no relative/static flip. Only the panel's
            // horizontal anchor switches per breakpoint: left-anchored to
            // the Sort button below md, right-anchored to it from md up.
            // Desktop's right anchor is pixel-verified against the fetched
            // node: the Dropdown's own `absoluteBoundingBox` right edge
            // (x=10620) exactly matches the Sort button's right edge, not
            // the group's. Figma draws no open-dropdown mobile frame at all
            // (Mobile/Sort, 4052:13689, has no Dropdown child) -- undesigned,
            // so the mobile anchor is this ticket's own call: left-anchor to
            // the button that opened it, rather than the far side of the
            // whole group, per user decision. Geometry re-verified in a real
            // browser at 320/375/390/430px, see design/notes/WinkelmandPage.md#182.
            <div className="flex items-center gap-inline-sm md:gap-inline-xl">
              <div ref={sortMenuRef} className="relative">
                <Button
                  icon="ArrowUpDown"
                  align="left"
                  // #182: icon-only on mobile (fetched Mobile nodes draw
                  // "With text: false") -- text hidden via `hidden md:inline`
                  // rather than swapping `children`, so the accessible name
                  // stays on aria-label at both breakpoints instead of
                  // depending on which text node happens to be visible.
                  aria-label={t("sortLabel")}
                  aria-expanded={sortMenuOpen}
                  onClick={() => setSortMenuOpen((open) => !open)}
                >
                  <span className="hidden md:inline">{t("sortLabel")}</span>
                </Button>
                {sortMenuOpen && (
                  // Left-aligned under the Sort button (mobile) / right-
                  // aligned under it (desktop), z-999, closes on outside
                  // click -- the fetched panel's own annotation ("See
                  // #DropdownActive ... z-index: 999. Click outside to
                  // disappear") points at the exact same mechanism
                  // TeDoenHeader.tsx's sort menu already implements.
                  <div className="absolute top-full left-0 z-[999] mt-2 w-[209px] md:left-auto md:right-0">
                    <Dropdown className="shadow-sm">
                      {SORT_OPTIONS.map((option) => (
                        <Button
                          key={option}
                          icon={SORT_ICONS[option]}
                          variant={option === sortBy ? "filled" : "white"}
                          align="left"
                          aria-pressed={option === sortBy}
                          onClick={() => {
                            setSortMenuOpen(false);
                            setSortBy(option);
                          }}
                        >
                          {tSort(option)}
                        </Button>
                      ))}
                    </Dropdown>
                  </div>
                )}
              </div>
              <Button variant="destructive" icon="Trash" onClick={handleClearAll}>
                {t("clearAllLabel")}
              </Button>
            </div>
          )
        }
      />
      {actionError && <p className="text-base font-semibold text-priority-urgent">{actionError}</p>}
      {isEmpty ? (
        // #179: the fetched empty-state nodes (4049:11175 desktop /
        // 4049:11167 mobile) replace the old text-only placeholder -- see
        // docs/open-questions.md (former winkelmand-empty-state-undesigned,
        // now resolved/removed) and design/notes/WinkelmandPage.md. Button
        // is full-width on mobile (Figma's Button carries its own
        // `alignSelf: stretch`) and hugs, centred, on desktop (no such
        // override there) -- `w-full md:w-fit` reproduces that split.
        <div className="pr-page-right-equal">
          <Card>
            {/* spacing-flag: gap-2 py-4 (8px / 16px) — measured the fetched
                EmptyState Card (4049:11174 mobile, 4050:11597 desktop):
                its "Type" slot (padding bound spacing/component/padding-sm)
                holds "EmptyText" (own paddingTop/Bottom bound
                spacing/component/padding-lg, itemSpacing to the sibling
                Button unbound at 0) plus a Step-number badge this page
                doesn't render — no boundVariables entry wraps a title+CTA
                group the way this div does, so the 16px here isn't the
                same padding as the measured one even though the number
                matches — design/notes/WinkelmandPage.md#219. */}
            <div className="flex w-full flex-col items-center justify-center gap-2 py-4">
              <p className="text-base font-semibold text-text-secondary">{t("emptyStateTitle")}</p>
              <Button
                trailingIcon="ArrowRight"
                className="w-full md:w-fit"
                onClick={() => router.push("/recepten")}
              >
                {t("emptyStateCta")}
              </Button>
            </div>
          </Card>
        </div>
      ) : (
        // spacing-flag: gap-6 (24px) — measured the fetched Default frames'
        // "Ingredients" wrapper (4051:13534 mobile, 4051:13056 desktop):
        // itemSpacing is 24 but carries no boundVariables entry at all (an
        // unbound/detached value in Figma itself) — 24 coincides with both
        // page-stack and stack-xl, exactly the ambiguity this ticket
        // forbids guessing through — design/notes/WinkelmandPage.md#219.
        <div className="flex w-full flex-col gap-6 pr-page-right-equal">
          {groups.map((group) => (
            <Card key={group.key} title={group.label}>
              {group.items.map((item, index) => (
                <CardContentIngredient
                  key={item.id}
                  name={item.name}
                  quantity={quantityLabel(item)}
                  checked={item.checked}
                  onCheckedToggle={() => handleToggle(item)}
                  divider={index < group.items.length - 1}
                  swipeAction="delete"
                  onDelete={() => handleDelete(item)}
                  deleteLabel={t("deleteItemLabel", { name: item.name })}
                />
              ))}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
