"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/organisms/PageHeader";
import { Button } from "@/components/atoms/Button";
import { Dropdown } from "@/components/atoms/Dropdown";
import { DeleteConfirm, useDeleteConfirm } from "@/app/(app)/_components/DeleteConfirm";
import type { IconName } from "@/components/atoms/Icon";
import { usePopoverPosition } from "@/lib/dom/use-popover-position";
import type { ShoppingListOption } from "./ShoppingListPanel";

// design: Claude-designed (#424) from Figma "Winkelmand/01" (4231:15596,
// header) and "Winkelmand/02" (4231:15721, switcher open). Page-level
// composition of PageHeader + Button + Dropdown, extracted from
// WinkelmandList.tsx so the open switcher has a Ladle story. Owns only the
// two menus' open state; every action is a callback. Reasoning:
// design/notes/WinkelmandPage.md.

export type SortBy = "recipe" | "foodGroup";
const SORT_OPTIONS: SortBy[] = ["recipe", "foodGroup"];
const SORT_ICONS: Record<SortBy, IconName> = {
  recipe: "FolderClosed",
  foodGroup: "Broccoli",
};

export interface WinkelmandHeaderProps {
  /** Current basket's display name. */
  title: string;
  lists: ShoppingListOption[];
  currentListId: string;
  sortBy: SortBy;
  onSortChange: (sortBy: SortBy) => void;
  /** Empty basket: Sort is hidden. */
  isEmpty: boolean;
  onSwitchList: (listId: string) => void;
  onAddList: () => void;
  /** Opens the settings panel of that basket. */
  onEditList: (listId: string) => void;
  onAddItem: () => void;
  onClearAll: () => void;
  /** Story-only: renders with the basket switcher already open. */
  defaultListMenuOpen?: boolean;
  /** Story-only: renders with the "Leeg mand" confirmation already asked. */
  defaultClearConfirming?: boolean;
}

// Both floating panels close the same way: a pointer down outside their
// wrapper (TeDoenHeader's #95 pattern; no Escape, nothing traps focus).
function useCloseOnOutsidePointerDown(
  ref: RefObject<HTMLElement | null>,
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

export function WinkelmandHeader({
  title,
  lists,
  currentListId,
  sortBy,
  onSortChange,
  isEmpty,
  onSwitchList,
  onAddList,
  onEditList,
  onAddItem,
  onClearAll,
  defaultListMenuOpen = false,
  defaultClearConfirming = false,
}: WinkelmandHeaderProps) {
  const t = useTranslations("shopping.page");
  const tSort = useTranslations("shopping.page.sortOptions");

  const { confirming: clearConfirming, ask: askClear, cancel: cancelClear } = useDeleteConfirm();
  const [storyAsked, setStoryAsked] = useState(defaultClearConfirming);
  const confirmingClear = clearConfirming || storyAsked;
  const [listMenuOpen, setListMenuOpen] = useState(defaultListMenuOpen);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const listMenuRef = useRef<HTMLDivElement>(null);
  const listPopoverRef = useRef<HTMLDivElement>(null);
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const sortPopoverRef = useRef<HTMLDivElement>(null);
  useCloseOnOutsidePointerDown(listMenuRef, listMenuOpen, () => setListMenuOpen(false));
  useCloseOnOutsidePointerDown(sortMenuRef, sortMenuOpen, () => setSortMenuOpen(false));

  // Basket switcher: left-anchored under the chevron, like TeDoenHeader's
  // board switcher. The hook clamps into the viewport (docs/incidents.md,
  // 2026-08-18).
  const listPopover = usePopoverPosition(listMenuRef, listPopoverRef, {
    open: listMenuOpen,
    anchor: "left",
    prefer: "below",
  });
  // #182's left-anchor-to-the-trigger decision stands (user call, see
  // docs/open-questions.md#winkelmand-mobile-sort-dropdown-anchor-undesigned)
  // — clamp-protected instead of measurement-dependent. Desktop's right
  // anchor stays pixel-verified against Figma. design/notes/WinkelmandPage.md#182.
  const sortPopover = usePopoverPosition(sortMenuRef, sortPopoverRef, {
    open: sortMenuOpen,
    anchor: { base: "left", md: "right" },
    prefer: "below",
  });

  // #222 pt.4: icon-only on mobile, "Item" from md up: span-hide + permanent
  // aria-label (same pattern as Sort).
  const addItemButton = (
    <Button icon="Plus" aria-label={t("addItemLabel")} onClick={onAddItem}>
      <span className="hidden md:inline">{t("addItemLabel")}</span>
    </Button>
  );

  // Icon-only below md, as the fetched mobile node draws ("With text" off);
  // four buttons no longer fit the 370px header row with a text label.
  const clearAllButton = (
    <Button variant="destructive" icon="Trash" aria-label={t("clearAllLabel")} onClick={askClear}>
      <span className="hidden md:inline">{t("clearAllLabel")}</span>
    </Button>
  );

  return (
    <PageHeader
      title={title}
      titleAdornments={
        <div ref={listMenuRef} className="relative">
          <Button
            icon="ChevronDown"
            aria-label={t("listSwitcherLabel")}
            aria-expanded={listMenuOpen}
            onClick={() => setListMenuOpen((open) => !open)}
          />
          {listMenuOpen && (
            <div ref={listPopoverRef} className="absolute z-[999] w-[209px]" style={listPopover.style}>
              <Dropdown className="shadow-sm">
                {lists.map((list) => (
                  // The settings icon is a sibling button laid over the row's
                  // trailing edge: buttons cannot nest.
                  <div key={list.id} className="relative">
                    <Button
                      icon={list.shared ? "Users" : "User"}
                      variant={list.id === currentListId ? "filled" : "white"}
                      align="left"
                      // spacing-flag: room for the 32px settings button — design/notes/WinkelmandPage.md
                      className="w-full pr-10"
                      onClick={() => {
                        setListMenuOpen(false);
                        if (list.id !== currentListId) onSwitchList(list.id);
                      }}
                    >
                      {list.name}
                    </Button>
                    <Button
                      icon="Settings"
                      variant="transparent"
                      size="compact"
                      className="absolute right-1 top-1/2 -translate-y-1/2"
                      aria-label={t("listSettingsLabel", { name: list.name })}
                      onClick={() => {
                        setListMenuOpen(false);
                        onEditList(list.id);
                      }}
                    />
                  </div>
                ))}
                <Button
                  variant="white"
                  icon="Plus"
                  align="left"
                  onClick={() => {
                    setListMenuOpen(false);
                    onAddList();
                  }}
                >
                  {t("addListOptionLabel")}
                </Button>
              </Dropdown>
            </div>
          )}
        </div>
      }
      // A single flex wrapper mirroring Figma's own "Knoppen" frame (row, gap
      // 8px mobile / 20px desktop): every button must be ONE child of
      // PageHeader's actions slot, not siblings (a Fragment's children render
      // as flat siblings of <header>, which is itself `justify-between`).
      // Empty state: Sort is hidden, "+ Item" stays by user instruction.
      actions={
        confirmingClear ? (
          // "Leeg mand" is two-step (the RecipeDetailPage idiom): the first
          // click swaps the buttons for the confirm row. The clear itself is
          // optimistic, so there is no pending state to show.
          <DeleteConfirm
            layout="inline"
            isPending={false}
            onCancel={() => {
              setStoryAsked(false);
              cancelClear();
            }}
            onConfirm={() => {
              setStoryAsked(false);
              cancelClear();
              onClearAll();
            }}
            labels={{
              prompt: t("clearAllConfirmLabel"),
              cancel: t("cancelLabel"),
              confirm: t("clearAllConfirmButtonLabel"),
              deleting: t("clearAllDeletingLabel"),
            }}
          />
        ) : (
        <div className="flex items-center gap-inline-sm md:gap-inline-xl">
          {addItemButton}
          {!isEmpty && (
            // #182: the Sort wrapper is the positioning context at every breakpoint.
            <div ref={sortMenuRef} className="relative">
              <Button
                icon="ArrowUpDown"
                align="left"
                aria-label={t("sortLabel")}
                aria-expanded={sortMenuOpen}
                onClick={() => setSortMenuOpen((open) => !open)}
              >
                <span className="hidden md:inline">{t("sortLabel")}</span>
              </Button>
              {sortMenuOpen && (
                <div ref={sortPopoverRef} className="absolute z-[999] w-[209px]" style={sortPopover.style}>
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
                          onSortChange(option);
                        }}
                      >
                        {tSort(option)}
                      </Button>
                    ))}
                  </Dropdown>
                </div>
              )}
            </div>
          )}
          {clearAllButton}
        </div>
        )
      }
    />
  );
}
