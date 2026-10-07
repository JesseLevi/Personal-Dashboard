"use client";

import { useEffect, useRef, useState, useTransition, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/organisms/PageHeader";
import { Button } from "@/components/atoms/Button";
import { Dropdown } from "@/components/atoms/Dropdown";
import type { IconName } from "@/components/atoms/Icon";
import { usePopoverPosition } from "@/lib/dom/use-popover-position";
import { SORT_OPTIONS, type SortOption } from "@/lib/boards/sort";
import type { ActionResult, BoardRow, BoardWithColumns } from "@/lib/boards/types";
import { BoardPanel, type BoardPanelTarget } from "./BoardPanel";
import { useTeDoenColumnPanel } from "./TeDoenColumnPanel";

// Per-option icon, matching the fetched sort-dropdown node (3877:7682) and
// SORT_OPTIONS' own order (lib/boards/sort.ts): Aanmaakdatum/Prioriteit/
// Grootte/Alfabetisch.
const SORT_ICONS: Record<SortOption, IconName> = {
  createdAt: "Calendar",
  priority: "AlarmClockCheck",
  size: "WeightTilde",
  alphabetical: "AArrowDown",
};

// #95 header interactions — Figma "Te doen/Desktop/SwitchBoard" (3878:12036)
// + "Te doen/Desktop/SortOnClick" (3877:6693). Page-level composition (same
// non-mapped-component precedent as TeDoenBoard.tsx/CardDetailPanel.tsx), the
// only file here that owns router navigation for board switching/sorting —
// TeDoenPageBody.tsx stays a Server Component. Full reasoning for every
// decision below (dropdown positioning, sort-vs-drag, the missing rename
// trigger): design/notes/TeDoenBoard.md.

export interface TeDoenHeaderProps {
  boards: BoardRow[];
  board: BoardWithColumns;
  sort: SortOption | null;
  onCreateBoard: (input: unknown) => Promise<ActionResult<BoardRow>>;
  onRenameBoard: (input: unknown) => Promise<ActionResult>;
  onToggleFavorite: (input: unknown) => Promise<ActionResult<{ isFavorite: boolean }>>;
}

// Both floating panels (board switcher, sort) close the same way: a pointer
// down outside their wrapper. Escape is left to each dropdown's own content
// (plain Buttons; nothing here traps focus like SidePanel does) since the
// ticket only specifies "click-outside closes."
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

export function TeDoenHeader({
  boards,
  board,
  sort,
  onCreateBoard,
  onRenameBoard,
  onToggleFavorite,
}: TeDoenHeaderProps) {
  const t = useTranslations("components.pageHeader.todo");
  const tSort = useTranslations("components.pageHeader.todo.sortOptions");
  const router = useRouter();
  const columnPanel = useTeDoenColumnPanel();
  const [isFavoritePending, startFavoriteTransition] = useTransition();

  const [boardMenuOpen, setBoardMenuOpen] = useState(false);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [panel, setPanel] = useState<{ open: boolean; target: BoardPanelTarget }>({
    open: false,
    target: { mode: "create" },
  });

  const boardMenuRef = useRef<HTMLDivElement>(null);
  const boardPopoverRef = useRef<HTMLDivElement>(null);
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const sortPopoverRef = useRef<HTMLDivElement>(null);
  useCloseOnOutsidePointerDown(boardMenuRef, boardMenuOpen, () => setBoardMenuOpen(false));
  useCloseOnOutsidePointerDown(sortMenuRef, sortMenuOpen, () => setSortMenuOpen(false));

  // Left/right-anchored below by design — docs/incidents.md, 2026-08-18.
  const boardPopover = usePopoverPosition(boardMenuRef, boardPopoverRef, {
    open: boardMenuOpen,
    anchor: "left",
    prefer: "below",
  });
  const sortPopover = usePopoverPosition(sortMenuRef, sortPopoverRef, {
    open: sortMenuOpen,
    anchor: "right",
    prefer: "below",
  });

  // Board is in the URL (ticket's own "shareable/bookmarkable" requirement),
  // never client state — both navigations below preserve the current sort so
  // switching boards doesn't silently drop the user's chosen view.
  function goToBoard(id: string) {
    router.push(sort ? `/te-doen/${id}?sort=${sort}` : `/te-doen/${id}`);
  }

  function goWithSort(nextSort: SortOption) {
    router.push(`/te-doen/${board.id}?sort=${nextSort}`);
  }

  function handleFavoriteClick() {
    startFavoriteTransition(async () => {
      await onToggleFavorite({ boardId: board.id });
      router.refresh();
    });
  }

  return (
    <>
      <PageHeader
        title={board.name}
        titleAdornments={
          <>
            <div ref={boardMenuRef} className="relative">
              <Button
                icon="ChevronDown"
                aria-label={t("boardSwitcherLabel")}
                aria-expanded={boardMenuOpen}
                onClick={() => setBoardMenuOpen((open) => !open)}
              />
              {boardMenuOpen && (
                // Left-aligned to the chevron, matching the fetched
                // SwitchBoard node's own position (near the title/chevron
                // cluster at the header's left side); now clamp-protected by
                // the shared positioner rather than the fixed offset the
                // comment above used to describe — see
                // design/notes/TeDoenBoard.md.
                <div ref={boardPopoverRef} className="absolute z-[999] w-[209px]" style={boardPopover.style}>
                  <Dropdown className="shadow-sm">
                    {boards.map((b) => (
                      <Button
                        key={b.id}
                        variant={b.id === board.id ? "filled" : "white"}
                        align="left"
                        onClick={() => {
                          setBoardMenuOpen(false);
                          goToBoard(b.id);
                        }}
                      >
                        {b.name}
                      </Button>
                    ))}
                    <Button
                      variant="outline"
                      icon="Plus"
                      align="left"
                      onClick={() => {
                        setBoardMenuOpen(false);
                        setPanel({ open: true, target: { mode: "create" } });
                      }}
                    >
                      {t("addBoardOptionLabel")}
                    </Button>
                  </Dropdown>
                </div>
              )}
            </div>
            {board.is_favorite ? (
              <Button
                icon="Star"
                aria-label={t("favoriteActiveLabel")}
                disabled
              />
            ) : (
              <Button
                icon="StarPlus"
                aria-label={t("favoriteLabel")}
                onClick={handleFavoriteClick}
                disabled={isFavoritePending}
              />
            )}
          </>
        }
        actions={
          <div className="flex items-center gap-inline-sm md:gap-inline-xl">
          <div ref={sortMenuRef} className="relative">
            <Button
              icon="ArrowUpDown"
              align="left"
              aria-expanded={sortMenuOpen}
              onClick={() => setSortMenuOpen((open) => !open)}
            >
              {t("sortLabel")}
            </Button>
            {sortMenuOpen && (
              // Right-aligned to the Sort button — matches the fetched
              // SortOnClick node (the button sits at the header's far right
              // edge, so a right-aligned 209px panel never overflows).
              <div ref={sortPopoverRef} className="absolute z-[999] w-[209px]" style={sortPopover.style}>
                <Dropdown className="shadow-sm">
                  {SORT_OPTIONS.map((option) => (
                    <Button
                      key={option}
                      icon={SORT_ICONS[option]}
                      variant={option === sort ? "filled" : "white"}
                      align="left"
                      // "nothing active until chosen" (2026-07-25): `sort` is
                      // null on load, so no option matches and none renders
                      // pressed/filled — see design/notes/TeDoenBoard.md.
                      aria-pressed={option === sort}
                      onClick={() => {
                        setSortMenuOpen(false);
                        goWithSort(option);
                      }}
                    >
                      {tSort(option)}
                    </Button>
                  ))}
                </Dropdown>
              </div>
            )}
          </div>
          <Button icon="Plus" onClick={columnPanel.openCreate}>
            {t("addCategoryLabel")}
          </Button>
          </div>
        }
      />
      <BoardPanel
        open={panel.open}
        onClose={() => setPanel((current) => ({ ...current, open: false }))}
        target={panel.target}
        onCreateBoard={onCreateBoard}
        onRenameBoard={onRenameBoard}
        onCreated={(newBoard) => goToBoard(newBoard.id)}
        onRenamed={() => router.refresh()}
      />
    </>
  );
}
