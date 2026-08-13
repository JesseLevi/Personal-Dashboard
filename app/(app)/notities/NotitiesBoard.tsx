"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/organisms/PageHeader";
import { Button } from "@/components/atoms/Button";
import { Dropdown } from "@/components/atoms/Dropdown";
import { BoardView, type BoardColumn } from "@/components/organisms/BoardView";
import { CardContentNote } from "@/components/molecules/CardContentNote";
import { isIconName, type IconName } from "@/components/atoms/Icon";
import { applyItemMove, type CardMove } from "@/lib/boards/optimistic";
import { formatNoteTimestamp } from "@/lib/notes/timestamp";
import { NOTE_SORT_OPTIONS, type NoteSortOption } from "@/lib/notes/sort";
import type { CategoryWithNotes, NoteSummaryRow } from "@/lib/notes/types";
import { createNote, moveNote } from "./actions";

// Client wrapper around BoardView (#230) -- `renderItem` is a function prop
// and can't cross the Server->Client boundary, so `page.tsx` stays a Server
// Component that only fetches serialisable `CategoryWithNotes[]` (#228) and
// this file is the lowest point the client boundary can start. Same split as
// app/(app)/recepten/ReceptenBoard.tsx / te-doen/TeDoenBoard.tsx. Header +
// board live in one file, like ReceptenBoard.tsx and unlike Te-Doen's
// TeDoenHeader/TeDoenBoard split -- that split exists there because
// BoardPanel/CardDetailPanel each own a real, different entity; here the
// header's "Categorie" button and every column's pencil button are BOTH
// still no-ops (#232 owns category management), so there is no shared panel
// state to justify a second file yet. Full reasoning for every decision
// below: design/notes/NotitiesBoard.md.
export interface NotitiesBoardProps {
  categories: CategoryWithNotes[];
  /** #230: resolved server-side from `?sort=` (notes-data.ts) -- `null` means manual/position order. */
  sort: NoteSortOption | null;
  /** Notities page title (`nav.notes`) -- a fixed page label, not board data (no board switcher exists here), same reasoning PageHeader.md records for Recepten's title. */
  title: string;
  /** Header "Categorie" trigger label (`components.pageHeader.notes.addCategoryLabel`). */
  addCategoryLabel: string;
  /** Header "Sorteren" trigger label (`components.pageHeader.notes.sortLabel`) -- also the mobile icon-only button's `aria-label`. */
  sortLabel: string;
}

// note_categories.icon is free-text at the schema layer, same gap
// recipe_categories.icon/board_columns.icon already have (design/notes/
// ReceptenBoard.md / TeDoenBoard.md). Fallback is "Notebook" -- the same
// icon Sidebar.tsx's own NAV_ITEMS already assigns to the whole Notities
// section, a neutral "notebook" glyph with no category-specific meaning,
// same reasoning ReceptenBoard.tsx's FALLBACK_CATEGORY_ICON documents for
// "FolderClosed".
const FALLBACK_CATEGORY_ICON: IconName = "Notebook";

// Per-option icon, matching TeDoenHeader.tsx's SORT_ICONS convention
// (lib/boards/sort.ts's own createdAt->Calendar/alphabetical->AArrowDown
// pairing) -- the two options this dropdown actually offers.
const SORT_ICONS: Record<NoteSortOption, IconName> = {
  createdAt: "Calendar",
  alphabetical: "AArrowDown",
};

// Closes the Sort dropdown on an outside pointerdown -- duplicated from
// TeDoenHeader.tsx's own (unexported) hook of the same name/shape rather
// than shared, same per-domain-duplication precedent lib/notes/queries.ts's
// escapeIlike already documents for a small, stable helper.
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

export function NotitiesBoard({ categories, sort, title, addCategoryLabel, sortLabel }: NotitiesBoardProps) {
  const t = useTranslations("components.cardContainer");
  const tSort = useTranslations("components.pageHeader.notes.sortOptions");
  const tTimestamp = useTranslations("notes.timestamp");
  const tErrors = useTranslations("notes.errors");
  const router = useRouter();

  // Local optimistic copy of `categories` (#230, same pattern #155 already
  // established for ReceptenBoard.tsx -- see that file's own comment for the
  // full Context7 citation). `pendingMoves` is a *count*, not a boolean, for
  // the same reason: two quick drags queued must not have the first
  // settling flip this back to "nothing pending" while the second is still
  // outstanding.
  const [localCategories, setLocalCategories] = useState(categories);
  const pendingMoves = useRef(0);
  useEffect(() => {
    if (pendingMoves.current === 0) setLocalCategories(categories);
  }, [categories]);

  // Serializes moveNote() calls one at a time -- same reasoning as
  // ReceptenBoard.tsx's `moveQueue`.
  const moveQueue = useRef<Promise<unknown>>(Promise.resolve());
  const [actionError, setActionError] = useState<string | null>(null);

  function handleMove(move: CardMove) {
    setActionError(null);
    const preMoveSnapshot = localCategories;
    pendingMoves.current += 1;
    setLocalCategories((current) =>
      applyItemMove<NoteSummaryRow, "notes", CategoryWithNotes>(current, move, "notes"),
    );

    moveQueue.current = moveQueue.current
      .then(() =>
        moveNote({
          noteId: move.itemId,
          categoryId: move.toColumnId,
          targetIndex: move.toIndex,
        }),
      )
      .then((result) => {
        if (!result.success) {
          setLocalCategories(preMoveSnapshot);
          setActionError(tErrors(result.error));
        }
        // Success: no `router.refresh()` here -- same "the optimistic state
        // already IS the landed state" reasoning as ReceptenBoard.tsx/
        // TeDoenBoard.tsx (#114).
      })
      .catch(() => {
        setLocalCategories(preMoveSnapshot);
        setActionError(tErrors("generic"));
      })
      .finally(() => {
        pendingMoves.current -= 1;
      });
  }

  // Column "+" creates a new empty note in that category and navigates
  // straight to its editor -- the ticket's own explicit instruction: the
  // editor draws no category picker, so this is the only place a note can
  // originate. `/notities/[noteId]` (#233) does not exist yet -- linking to
  // it anyway is fine (pnpm build doesn't require the target route to
  // exist), same precedent ReceptenBoard.md records for `/recepten/
  // [recipeId]` pre-#127.
  async function handleAddNote(categoryId: string) {
    setActionError(null);
    const result = await createNote({ categoryId });
    if (result.success) {
      router.push(`/notities/${result.data.id}`);
    } else {
      setActionError(tErrors(result.error));
    }
  }

  const columns: BoardColumn<NoteSummaryRow>[] = localCategories.map((category) => ({
    id: category.id,
    name: category.name,
    icon: isIconName(category.icon) ? category.icon : FALLBACK_CATEGORY_ICON,
    items: category.notes,
  }));

  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);
  useCloseOnOutsidePointerDown(sortMenuRef, sortMenuOpen, () => setSortMenuOpen(false));

  function goWithSort(nextSort: NoteSortOption) {
    router.push(`/notities?sort=${nextSort}`);
  }

  function formatTimestamp(note: NoteSummaryRow): string {
    const result = formatNoteTimestamp(note.updated_at);
    switch (result.tier) {
      case "today":
        return result.time;
      case "yesterday":
        return tTimestamp("yesterday");
      case "older":
        return result.date;
    }
  }

  return (
    <>
      <PageHeader
        title={title}
        actions={
          <div className="flex items-center gap-inline-sm md:gap-inline-xl">
            <div ref={sortMenuRef} className="relative">
              {/* Mobile: icon-only (Figma "Sorteer" With text=false, node
                  4067:19272, 40x40). Desktop: icon + text (node 4067:19250,
                  120x40). Two real Button branches rather than one Button
                  with CSS-hidden text -- each is a genuine Figma instance
                  with its own layout, and Button.tsx's own icon-only vs.
                  labelled branches already model that distinction (see
                  design/notes/NotitiesBoard.md for the alternative
                  considered). */}
              <Button
                icon="ArrowUpDown"
                aria-label={sortLabel}
                aria-expanded={sortMenuOpen}
                onClick={() => setSortMenuOpen((open) => !open)}
                className="md:hidden"
              />
              <Button
                icon="ArrowUpDown"
                align="left"
                aria-expanded={sortMenuOpen}
                onClick={() => setSortMenuOpen((open) => !open)}
                className="hidden md:inline-flex"
              >
                {sortLabel}
              </Button>
              {sortMenuOpen && (
                <div className="absolute top-full right-0 z-[999] mt-2 w-[209px]">
                  <Dropdown className="shadow-sm">
                    {NOTE_SORT_OPTIONS.map((option) => (
                      <Button
                        key={option}
                        icon={SORT_ICONS[option]}
                        variant={option === sort ? "filled" : "white"}
                        align="left"
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
            {/* "Categorie" -- deliberately a no-op. #232 (category
                management) owns opening a real create panel here; wiring a
                placeholder panel in this ticket would mean inventing #232's
                UI un-briefed, so the button renders inert (with a real
                aria-label from Figma's own "Categorie" text) rather than
                nothing at all -- same "not invented here" scope-limit
                PageHeader.md already records for Te-Doen's pre-#95 Chevron/
                Star buttons. */}
            <Button icon="Plus">{addCategoryLabel}</Button>
          </div>
        }
      />
      {/* Drag-persist / create-note failure only -- same inline convention
          as ReceptenBoard.tsx/TeDoenBoard.tsx (`notes.errors.*`, no toast
          component exists in this design system yet). */}
      {actionError && <p className="text-base font-semibold text-priority-urgent">{actionError}</p>}
      <BoardView
        columns={columns}
        // #230: sorting is a VIEW choice (lib/notes/sort.ts) -- when active
        // the on-screen order no longer matches `position`, so dragging is
        // disabled rather than letting a drop write a misleading position
        // against what the user actually sees. Same precedent design/notes/
        // TeDoenBoard.md records for #95.
        dragDisabled={sort !== null}
        onMove={handleMove}
        addLabel={t("addLabel")}
        editLabel={t("editLabel")}
        emptyLabel={t("addItemLabel")}
        onAddItem={handleAddNote}
        onItemClick={(note) => router.push(`/notities/${note.id}`)}
        renderItem={(note) => (
          <CardContentNote title={note.title} timestamp={formatTimestamp(note)} snippet={note.snippet} />
        )}
      />
    </>
  );
}
