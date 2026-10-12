"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Basket } from "@lucasmarkes/hairline/react";
import { Button } from "@/components/atoms/Button";
import { AvatarGroup, type AvatarGroupMember } from "@/components/molecules/AvatarGroup";
import { Card } from "@/components/molecules/Card";
import { CardContentIngredient } from "@/components/molecules/CardContentIngredient";
import { IngredientSearchPanel } from "@/components/organisms/IngredientSearchPanel";
import { ShareInviteBanner } from "@/components/organisms/ShareInviteBanner";
import { blurInTotalMs, blurFadeStagger, blurOutTotalMs, usePrefersReducedMotion } from "@/lib/ui/blur-fade";
import { cn } from "@/lib/ui/cn";
import { formatQuantity } from "@/lib/recipes/units";
import { formatQuantityFraction } from "@/lib/recipes/kitchen-units";
import {
  toggleShoppingListItem,
  deleteShoppingListItem,
  clearShoppingList,
  addShoppingListItem,
  createShoppingList,
  renameShoppingList,
  deleteShoppingList,
  searchShareMembers,
  inviteShareMember,
  revokeShareMember,
  acceptShareInvite,
  declineShareInvite,
  leaveSharedList,
} from "./actions";
import { ShoppingListPanel, type ShoppingListOption, type ShoppingListPanelTarget } from "./ShoppingListPanel";
import { WinkelmandHeader, type SortBy } from "./WinkelmandHeader";
import { clearListEnter, markListEnter, wantsListEnter } from "./list-switch";
// #222 pt.4: reuses RecipePanel.tsx's own ingredient search/create actions
// rather than duplicating them -- same cross-route-group import direction
// RecipeDetailPage.tsx already uses for winkelmand/actions.ts (imports go
// both ways in this codebase, a Server Action is a global RPC endpoint, not
// folder-scoped). See design/notes/WinkelmandPage.md#222.
import { searchIngredients, createOwnIngredient } from "@/app/(app)/recepten/actions";
import type { IngredientRow } from "@/lib/recipes/types";
import type { ActionResult, ShoppingListItemWithGroupInfo } from "@/lib/shopping/types";
import type { ListShare, MemberProfile } from "@/lib/sharing/types";

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
//
// #424: one instance per basket (`key={listId}` on the page), so sort, pending
// actions and the switch motion reset by themselves on a basket change. Every
// action below passes `listId`.
export type WinkelmandListOption = ShoppingListOption;

export interface WinkelmandListProps {
  /** The basket this page shows (`/winkelmand/[listId]`). */
  listId: string;
  /** Every basket of the user, default first; `name` is already the display name. */
  lists: WinkelmandListOption[];
  items: ShoppingListItemWithGroupInfo[];
  /** The owner's current share on this basket (#426); null when not shared or not the owner. */
  share: ListShare | null;
  /** The basket owner (profile), for a member; shown read-only in the panel (#427). */
  owner: MemberProfile | null;
  /** Owner first, then the accepted member; empty while the basket is not shared (#427). */
  people: AvatarGroupMember[];
  /** Pending invitations, one banner each (#427). */
  invites: WinkelmandInvite[];
}

export interface WinkelmandInvite {
  listId: string;
  inviterName: string;
}

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

export function WinkelmandList({ listId, lists, items, share, owner, people, invites }: WinkelmandListProps) {
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
  const tSharingErrors = useTranslations("sharing.errors");
  const t = useTranslations("shopping.page");

  const [localItems, setLocalItems] = useState(items);
  const pendingActions = useRef(0);
  useEffect(() => {
    if (pendingActions.current === 0) setLocalItems(items);
  }, [items]);

  const [actionError, setActionError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>("recipe");
  const [addItemPanelOpen, setAddItemPanelOpen] = useState(false);
  const [listPanel, setListPanel] = useState<{ open: boolean; target: ShoppingListPanelTarget }>({
    open: false,
    target: { mode: "create" },
  });
  // Invitations: declined ones disappear at once, an accepted one navigates away.
  const [dismissedInvites, setDismissedInvites] = useState<string[]>([]);
  const [respondingInvite, setRespondingInvite] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const currentList = lists.find((list) => list.id === listId);
  const defaultList = lists.find((list) => list.isDefault && list.isOwner);

  // Basket switch: the groups blur out, then the route changes, then the new
  // basket's groups blur in (only when this mount follows a switch). Same
  // pattern as te-doen/TeDoenBoardSwitch.tsx; the enter class is dropped
  // after it has played, since its fill would keep a `filter` on the cards.
  const reduced = usePrefersReducedMotion();
  const [exiting, setExiting] = useState(false);
  const switchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [entering, setEntering] = useState(() => wantsListEnter(listId));
  useEffect(() => () => {
    if (switchTimer.current) clearTimeout(switchTimer.current);
  }, []);

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

  async function respondToInvite(invite: WinkelmandInvite, accept: boolean) {
    setInviteError(null);
    setRespondingInvite(invite.listId);
    try {
      const input = { resource: "shopping_list", id: invite.listId };
      const result = await (accept ? acceptShareInvite(input) : declineShareInvite(input));
      if (!result.success) {
        setInviteError(tSharingErrors(result.error));
        return;
      }
      if (accept) router.push(`/winkelmand/${invite.listId}`);
      else setDismissedInvites((current) => [...current, invite.listId]);
    } catch {
      setInviteError(tSharingErrors("generic"));
    } finally {
      setRespondingInvite(null);
    }
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
    runAction(() => [], () => clearShoppingList({ listId }));
  }

  // #222 pt.4: sequential, awaited (not Promise.all) -- addShoppingListItem
  // computes its own `position` by reading the current last row server-side
  // per call, the same "no move queue" file only holds for id-targeted
  // actions with no shared computed value; awaiting each call in turn avoids
  // two saves racing onto the same position. Mirrors
  // IngredientSearchPanel.tsx's own handleSave, which already awaits its
  // onCreateOwnIngredient calls in a for-of loop for the same reason. No
  // optimistic localItems mutation -- there's no client-side row to
  // synthesize (group/recipe info is server-resolved) -- a real failure
  // surfaces via actionError, never an invented success. See
  // design/notes/WinkelmandPage.md#222.
  // #324: plain names (hand-typed, no library row) are added by name only,
  // the same as library picks (no reference_ingredient_id is written today).
  async function handleAddIngredients(ingredients: IngredientRow[], plainNames: string[]) {
    setActionError(null);
    try {
      for (const name of [...ingredients.map((ingredient) => ingredient.name), ...plainNames]) {
        const result = await addShoppingListItem({ name, listId });
        if (!result.success) {
          setActionError(tErrors(result.error));
          return;
        }
      }
    } catch {
      setActionError(tErrors("generic"));
    }
  }

  const visibleInvites = invites.filter((invite) => !dismissedInvites.includes(invite.listId));
  const isEmpty = localItems.length === 0;
  const groups = isEmpty ? [] : buildGroups(localItems, sortBy, locale, t("otherGroupLabel"));
  const motionCount = Math.max(groups.length, 1);

  useEffect(() => {
    if (!entering) return;
    clearListEnter();
    const id = setTimeout(() => setEntering(false), blurInTotalMs(motionCount, reduced));
    return () => clearTimeout(id);
  }, [entering, motionCount, reduced]);

  function switchToList(targetListId: string) {
    if (targetListId === listId || switchTimer.current) return;
    const href = `/winkelmand/${targetListId}`;
    router.prefetch(href);
    setExiting(true);
    switchTimer.current = setTimeout(() => {
      switchTimer.current = null;
      markListEnter(targetListId);
      router.push(href);
    }, blurOutTotalMs(motionCount, reduced));
  }

  function groupMotion(index: number) {
    if (exiting) return cn("animate-blur-out", blurFadeStagger(index));
    if (entering) return cn("animate-blur-in", blurFadeStagger(index));
    return undefined;
  }

  return (
    <>
      <WinkelmandHeader
        title={currentList?.name ?? ""}
        lists={lists}
        currentListId={listId}
        sortBy={sortBy}
        onSortChange={setSortBy}
        isEmpty={isEmpty}
        onSwitchList={switchToList}
        onAddList={() => setListPanel({ open: true, target: { mode: "create" } })}
        onEditList={() =>
          currentList && setListPanel({ open: true, target: { mode: "edit", list: currentList } })
        }
        onAddItem={() => setAddItemPanelOpen(true)}
        onClearAll={handleClearAll}
      />
      {visibleInvites.length > 0 && (
        <div className="flex w-full flex-col gap-stack-xl pr-page-right-equal">
          {visibleInvites.map((invite) => (
            <ShareInviteBanner
              key={invite.listId}
              inviterName={invite.inviterName}
              pending={respondingInvite !== null}
              onAccept={() => respondToInvite(invite, true)}
              onDecline={() => respondToInvite(invite, false)}
            />
          ))}
        </div>
      )}
      {inviteError && <p className="text-base font-semibold text-priority-urgent">{inviteError}</p>}
      {people.length > 0 && <AvatarGroup members={people} />}
      {actionError && <p className="text-base font-semibold text-priority-urgent">{actionError}</p>}
      {isEmpty ? (
        // #179: the fetched empty-state nodes (4049:11175 desktop /
        // 4049:11167 mobile) replace the old text-only placeholder -- see
        // docs/open-questions.md (former winkelmand-empty-state-undesigned,
        // now resolved/removed) and design/notes/WinkelmandPage.md. Button
        // is full-width on mobile (Figma's Button carries its own
        // `alignSelf: stretch`) and hugs, centred, on desktop (no such
        // override there) -- `w-full md:w-fit` reproduces that split.
        <div className={cn("pr-page-right-equal", groupMotion(0))}>
          <Card>
            {/* #222 pt.5: re-measured "Stap + Card" (4049:11174 mobile,
                4050:11597 desktop) via the bridge -- the Card's own p-
                component-sm (Card.tsx) already reproduces the "Type" slot's
                8px, itemSpacing between EmptyText/Button is 0 (no gap), and
                EmptyText's paddingTop/Bottom (bound spacing/component/
                padding-lg = 16px) is the TEXT's own padding, not a wrapper
                gap. Corrects #219's "stays raw" call, which compared this
                wrapper against the wrong box. design/notes/WinkelmandPage.md#222. */}
            <div className="flex w-full flex-col items-center justify-center">
              {/* Hairline figure; its six theme properties bind semantic tokens. Not in Figma: user-requested. */}
              <Basket
                label={t("emptyStateTitle")}
                className="-mb-5 mt-1 w-full max-w-64 [--hairline-edge:var(--color-text-secondary)] [--hairline-hi:var(--color-text-primary)] [--hairline-lo:var(--color-stroke-primary)] [--hairline-mid:var(--color-text-placeholder)] [--hairline-plate:var(--color-surface-highlight-white)]"
              />
              <p className="w-full py-component-lg text-center text-base font-semibold text-text-secondary">
                {t("emptyStateTitle")}
              </p>
              <Button
                trailingIcon="ArrowRight"
                className="mb-6 w-full md:w-fit"
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
          {groups.map((group, groupIndex) => (
            <div key={group.key} className={groupMotion(groupIndex)}>
            <Card title={group.label}>
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
            </div>
          ))}
        </div>
      )}
      {/* #222 pt.4: the ticket's own "ingredientList" screen is this
          existing organism, reused as-is (onSave rows carry no quantity, so
          CardContentIngredient's Tag stays hidden -- expected, not a bug,
          quantityLabel() above already returns undefined for a null
          quantity). See design/notes/WinkelmandPage.md#222. */}
      <IngredientSearchPanel
        open={addItemPanelOpen}
        onClose={() => setAddItemPanelOpen(false)}
        onSearch={searchIngredients}
        onCreateOwnIngredient={createOwnIngredient}
        onSave={handleAddIngredients}
      />
      <ShoppingListPanel
        open={listPanel.open}
        onClose={() => setListPanel((current) => ({ ...current, open: false }))}
        target={listPanel.target}
        onCreateList={createShoppingList}
        onRenameList={renameShoppingList}
        onDeleteList={deleteShoppingList}
        onSearchMembers={searchShareMembers}
        onInviteMember={inviteShareMember}
        onRevokeShare={revokeShareMember}
        onLeaveList={leaveSharedList}
        owner={owner}
        share={share}
        onCreated={(list) => switchToList(list.id)}
        onRenamed={() => router.refresh()}
        // The deleted basket was this page: go to the default one (the action
        // does not revalidate, see deleteShoppingList).
        onDeleted={() => router.replace(defaultList ? `/winkelmand/${defaultList.id}` : "/winkelmand")}
      />
    </>
  );
}
