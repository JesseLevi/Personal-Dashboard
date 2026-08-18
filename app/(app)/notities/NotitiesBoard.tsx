"use client";

import { useEffect, useRef, useState, useTransition, type RefObject } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import clsx from "clsx";
import { PageHeader } from "@/components/organisms/PageHeader";
import { Button } from "@/components/atoms/Button";
import { Dropdown } from "@/components/atoms/Dropdown";
import { InputField } from "@/components/atoms/InputField";
import { BoardView, type BoardColumn } from "@/components/organisms/BoardView";
import { Card } from "@/components/molecules/Card";
import { CardContentNote } from "@/components/molecules/CardContentNote";
import { isIconName, type IconName } from "@/components/atoms/Icon";
import { applyItemMove, type CardMove } from "@/lib/boards/optimistic";
import { usePopoverPosition } from "@/lib/dom/use-popover-position";
import { formatNoteTimestamp } from "@/lib/notes/timestamp";
import { NOTE_SORT_OPTIONS, type NoteSortOption } from "@/lib/notes/sort";
import { effectiveNotesSearchQuery, NOTES_SEARCH_DEBOUNCE_MS } from "@/lib/notes/search";
import type { CategoryWithNotes, NoteSummaryRow } from "@/lib/notes/types";
import type { NotitiesPageData } from "./notes-data";
import { NoteCategoryPanel, type NoteCategoryPanelTarget } from "./NoteCategoryPanel";
import { createCategory, createNote, deleteCategory, moveNote, renameCategory } from "./actions";

// Client wrapper around BoardView (#230) -- `renderItem` is a function prop
// and can't cross the Server->Client boundary, so `page.tsx` stays a Server
// Component that only fetches serialisable data (`NotitiesPageData`,
// notes-data.ts) and this file is the lowest point the client boundary can
// start. Same split as app/(app)/recepten/ReceptenBoard.tsx /
// te-doen/TeDoenBoard.tsx. Header + board live in one file, like
// ReceptenBoard.tsx and unlike Te-Doen's TeDoenHeader/TeDoenBoard split --
// the header's "Categorie" trigger and every column's pencil button (#232)
// target the same NoteCategoryPanel, so one shared `categoryPanel` state
// needs one owner, same reasoning ReceptenBoard.md records for
// CategoryPanel; #231's search bar sits in this same file for the same
// reason -- it shares the PageHeader it's wired into. Full reasoning for
// every decision below: design/notes/NotitiesBoard.md.
export interface NotitiesBoardProps {
  /** #231: board (categories+sort) or search (query+results) -- server-decided in notes-data.ts, never branched on again in the client beyond which content to render. */
  data: NotitiesPageData;
  /** Notities page title (`nav.notes`) -- a fixed page label, not board data (no board switcher exists here), same reasoning PageHeader.md records for Recepten's title. */
  title: string;
  /** Header "Categorie" trigger label (`components.pageHeader.notes.addCategoryLabel`). */
  addCategoryLabel: string;
  /** Header "Sorteren" trigger label (`components.pageHeader.notes.sortLabel`) -- also the mobile icon-only button's `aria-label`. */
  sortLabel: string;
  /** #231 search field placeholder ("Zoeken"). */
  searchPlaceholder: string;
  /** #231 accessible name for the search field's clear/X button. */
  searchClearLabel: string;
  /** #231 "Geen resultaten gevonden" message. */
  noResultsLabel: string;
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

interface NotesSearchFieldProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  placeholder: string;
  clearLabel: string;
  className?: string;
}

// #231: one component, two placements (desktop inside PageHeader's actions
// row, mobile its own full-width row) -- built on `InputField` per the
// ticket's own instruction, not a new Figma-mapped molecule (the search
// field has no distinct Figma component; see design/notes/NotitiesBoard.md).
// Two literal branches, not a conditionally-spread prop object, for the
// same type-safety reason the Sorteer button below already needs two real
// `Button` branches: InputField's onTrailingIconClick/trailingIconLabel are
// a paired discriminated union (components/atoms/InputField.tsx), not two
// independently-optional props.
function NotesSearchField({
  id,
  value,
  onChange,
  onClear,
  placeholder,
  clearLabel,
  className,
}: NotesSearchFieldProps) {
  return value ? (
    <InputField
      id={id}
      className={className}
      placeholder={placeholder}
      leadingIcon="Search"
      trailingIcon="X"
      trailingIconLabel={clearLabel}
      onTrailingIconClick={onClear}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ) : (
    <InputField
      id={id}
      className={className}
      placeholder={placeholder}
      leadingIcon="Search"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

export function NotitiesBoard({
  data,
  title,
  addCategoryLabel,
  sortLabel,
  searchPlaceholder,
  searchClearLabel,
  noResultsLabel,
}: NotitiesBoardProps) {
  const t = useTranslations("components.cardContainer");
  const tSort = useTranslations("components.pageHeader.notes.sortOptions");
  const tTimestamp = useTranslations("notes.timestamp");
  const tErrors = useTranslations("notes.errors");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Local optimistic copy of the board's categories (#230, same pattern #155
  // already established for ReceptenBoard.tsx -- see that file's own comment
  // for the full Context7 citation). Declared unconditionally (React hooks
  // can't branch on `data.mode`, which changes across navigations) but only
  // meaningful in board mode -- search results are never dragged/mutated.
  // `pendingMoves` is a *count*, not a boolean, for the same reason: two
  // quick drags queued must not have the first settling flip this back to
  // "nothing pending" while the second is still outstanding.
  const [localCategories, setLocalCategories] = useState<CategoryWithNotes[]>(
    data.mode === "board" ? data.categories : [],
  );
  const pendingMoves = useRef(0);
  useEffect(() => {
    if (data.mode === "board" && pendingMoves.current === 0) setLocalCategories(data.categories);
  }, [data]);

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
  const sortPopoverRef = useRef<HTMLDivElement>(null);
  useCloseOnOutsidePointerDown(sortMenuRef, sortMenuOpen, () => setSortMenuOpen(false));
  // Right-anchored below by design — docs/incidents.md, 2026-08-18.
  const sortPopover = usePopoverPosition(sortMenuRef, sortPopoverRef, {
    open: sortMenuOpen,
    anchor: "right",
    prefer: "below",
  });

  // #232: header "Categorie" (create) and every column's pencil (edit) share
  // one NoteCategoryPanel instance, same independent open/target convention
  // as ReceptenBoard.tsx's own `panel` state -- closing (X/overlay/Escape)
  // only flips `open`, leaving `target` in place so the close transition has
  // real content to animate away from.
  const [categoryPanel, setCategoryPanel] = useState<{
    open: boolean;
    target: NoteCategoryPanelTarget;
  }>({
    open: false,
    target: { mode: "create" },
  });

  function goWithSort(nextSort: NoteSortOption) {
    // Preserves `?q=` (if any) -- picking a sort option has no effect on an
    // active search (search results are always recency-ordered, never
    // grouped/sorted, see notes-data.ts), so it must not silently drop out
    // of search mode as a side effect of an unrelated control.
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", nextSort);
    router.push(`${pathname}?${params.toString()}`);
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

  // #231: the query lives in `?q=` (URL searchparam), not local-only state
  // -- deelbaar/server-renderbaar, consistent with `?sort=` above. See
  // design/notes/NotitiesBoard.md for the full decision writeup, including
  // why this stays a *client* debounce+transition rather than a form
  // submit.
  const committedQuery = data.mode === "search" ? data.query : "";
  const [queryInput, setQueryInput] = useState(committedQuery);
  // Resyncs the visible input whenever the server's committed query changes
  // for a reason OTHER than our own debounced navigation (e.g. browser
  // back/forward, or a shared link) -- a no-op when it fires right after our
  // own navigation lands, since `queryInput` already equals `committedQuery`
  // by construction at that point (see handleQueryChange below).
  useEffect(() => {
    setQueryInput(committedQuery);
  }, [committedQuery]);

  // `effectiveQuery` applies the same threshold `notes-data.ts` used
  // server-side (lib/notes/search.ts, shared so the two sides can't
  // disagree). `contentVisible` is the whole animation: true exactly when
  // what's currently rendered (`committedQuery`, i.e. the server's actual
  // last response) matches what the user's current typing *would* resolve
  // to -- false the instant they type away from that (fade-out), true again
  // once the debounced navigation's response lands and the two agree again
  // (fade-in). No separate loading state is ever drawn; the previous
  // content just stays mounted, invisible, until the new content matches.
  const effectiveQuery = effectiveNotesSearchQuery(queryInput);
  const contentVisible = effectiveQuery === committedQuery;

  const [, startSearchTransition] = useTransition();
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(searchDebounceRef.current), []);

  function navigateWithQuery(nextQuery: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextQuery) params.set("q", nextQuery);
    else params.delete("q");
    // `replace`, not `push` (unlike goWithSort above): every keystroke would
    // otherwise spam browser history. `startTransition` is what keeps the
    // OLD tree mounted (no Suspense fallback flash) while the server
    // resolves the new one -- the ticket's own "geen laadtoestand" steer.
    startSearchTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  function handleQueryChange(value: string) {
    setQueryInput(value);
    clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      const next = effectiveNotesSearchQuery(value);
      if (next === committedQuery) return;
      navigateWithQuery(next);
    }, NOTES_SEARCH_DEBOUNCE_MS);
  }

  function handleClearQuery() {
    setQueryInput("");
    clearTimeout(searchDebounceRef.current);
    if (committedQuery !== "") navigateWithQuery("");
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
                  considered). Visibility lives on a wrapper `span`, not on
                  the Button itself -- Button's own base class already
                  carries `inline-flex` (#263), so a bare `hidden` on the
                  same element loses to it on CSS specificity order. The
                  wrapper also has to re-carry `shrink-0`, which used to sit
                  on the Button as a direct flex child of this row; see
                  design/notes/NotitiesBoard.md. */}
              <span className="shrink-0 md:hidden">
                <Button
                  icon="ArrowUpDown"
                  aria-label={sortLabel}
                  aria-expanded={sortMenuOpen}
                  onClick={() => setSortMenuOpen((open) => !open)}
                />
              </span>
              <span className="hidden shrink-0 md:inline">
                <Button
                  icon="ArrowUpDown"
                  align="left"
                  aria-expanded={sortMenuOpen}
                  onClick={() => setSortMenuOpen((open) => !open)}
                >
                  {sortLabel}
                </Button>
              </span>
              {sortMenuOpen && (
                <div ref={sortPopoverRef} className="absolute z-[999] w-[209px]" style={sortPopover.style}>
                  <Dropdown className="shadow-sm">
                    {NOTE_SORT_OPTIONS.map((option) => (
                      <Button
                        key={option}
                        icon={SORT_ICONS[option]}
                        variant={data.mode === "board" && option === data.sort ? "filled" : "white"}
                        align="left"
                        aria-pressed={data.mode === "board" && option === data.sort}
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
            <Button
              icon="Plus"
              onClick={() => setCategoryPanel({ open: true, target: { mode: "create" } })}
            >
              {addCategoryLabel}
            </Button>
            {/* #231: desktop's third "Knoppen" child (fetched node
                4067:19270) -- the detached 4109:16063 frame's own Container
                measured 240px wide (Tailwind's `w-60`, exact), so the width
                lives on this wrapper rather than InputField's own `w-full`
                root (avoids two conflicting width utilities landing on the
                same element -- see design/notes/NotitiesBoard.md). */}
            <div className="hidden md:block md:w-60 md:shrink-0">
              <NotesSearchField
                id="notes-search-desktop"
                value={queryInput}
                onChange={handleQueryChange}
                onClear={handleClearQuery}
                placeholder={searchPlaceholder}
                clearLabel={searchClearLabel}
              />
            </div>
          </div>
        }
      />
      {/* #231: mobile's own full-width row below the header (fetched node
          4067:18157/4067:18163) -- same component as the desktop instance
          above, just placed differently ("Eén component, twee plaatsingen",
          the ticket's own instruction). `pr-page-right-equal` matches the
          instance's own measured outer padding -- `main` (AppShellNav.tsx)
          only ever supplies left padding, every full-width row supplies its
          own right edge (PageHeader.tsx does the same). */}
      <NotesSearchField
        id="notes-search-mobile"
        className="pr-page-right-equal md:hidden"
        value={queryInput}
        onChange={handleQueryChange}
        onClear={handleClearQuery}
        placeholder={searchPlaceholder}
        clearLabel={searchClearLabel}
      />
      {/* #231 animation: typing fades this whole block out (contentVisible
          false the instant the typed query diverges from what's actually
          rendered), then back in once the server's response matches again --
          covers all three states (board/results/no-results) with one toggle
          rather than a separate transition per state. prefers-reduced-motion
          matches every other animated element in this codebase (BoardView.tsx,
          Dropdown.tsx, SidePanel.tsx, ButtonToggle.tsx). */}
      <div
        className={clsx(
          "flex flex-1 flex-col transition-opacity duration-[var(--duration-base)] ease-base motion-reduce:transition-none",
          contentVisible ? "opacity-100" : "opacity-0",
        )}
      >
        {data.mode === "board" ? (
          <>
            {/* Drag-persist / create-note failure only -- same inline
                convention as ReceptenBoard.tsx/TeDoenBoard.tsx
                (`notes.errors.*`, no toast component exists in this design
                system yet). Board-only: search results have no drag/create
                actions. */}
            {actionError && <p className="text-base font-semibold text-priority-urgent">{actionError}</p>}
            <BoardView
              columns={columns}
              // #230: sorting is a VIEW choice (lib/notes/sort.ts) -- when
              // active the on-screen order no longer matches `position`, so
              // dragging is disabled rather than letting a drop write a
              // misleading position against what the user actually sees.
              // Same precedent design/notes/TeDoenBoard.md records for #95.
              dragDisabled={data.sort !== null}
              onMove={handleMove}
              addLabel={t("addLabel")}
              editLabel={t("editLabel")}
              emptyLabel={t("addItemLabel")}
              onAddItem={handleAddNote}
              onItemClick={(note) => router.push(`/notities/${note.id}`)}
              // #232: every column's pencil opens the same NoteCategoryPanel
              // the header's "Categorie" trigger does, in edit mode.
              onEditColumn={(columnId) => {
                const category = localCategories.find((c) => c.id === columnId);
                if (category) setCategoryPanel({ open: true, target: { mode: "edit", category } });
              }}
              renderItem={(note) => (
                <CardContentNote title={note.title} timestamp={formatTimestamp(note)} snippet={note.snippet} />
              )}
            />
          </>
        ) : data.results.length > 0 ? (
          // #231: a flat list, no category grouping/column headers/Carousel
          // (Figma node 4067:19985, the ticket's own explicit instruction)
          // -- the same Card + CardContentNote the board itself uses, just
          // stacked directly instead of inside BoardView/CardContainer.
          <div className="flex w-full flex-col gap-stack-sm">
            {data.results.map((note) => (
              <div key={note.id} onClick={() => router.push(`/notities/${note.id}`)} className="cursor-pointer">
                <Card>
                  <CardContentNote title={note.title} timestamp={formatTimestamp(note)} snippet={note.snippet} />
                </Card>
              </div>
            ))}
          </div>
        ) : (
          // #231: "Geen resultaten gevonden" (Figma node 4067:19998), no
          // illustration/button. Centered via flex-1 within this already-flex
          // wrapper, matching CardContainer's own empty-column treatment
          // (design/notes/NotitiesBoard.md's "Empty state" section) rather
          // than the fetched static frame's own fixed pixel position -- see
          // design/notes/NotitiesBoard.md for why.
          <div className="flex flex-1 items-center justify-center">
            <p className="text-base font-semibold text-text-secondary">{noResultsLabel}</p>
          </div>
        )}
      </div>
      {/* #232: outside the #231 fade wrapper on purpose -- SidePanel is an
          overlay with its own open/close transition, and it must not inherit
          the search fade's opacity while a category is being edited. */}
      <NoteCategoryPanel
        open={categoryPanel.open}
        onClose={() => setCategoryPanel((current) => ({ ...current, open: false }))}
        target={categoryPanel.target}
        onCreateCategory={createCategory}
        onRenameCategory={renameCategory}
        onDeleteCategory={deleteCategory}
        onMutated={() => router.refresh()}
      />
    </>
  );
}
