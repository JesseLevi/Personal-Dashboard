"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { BoardView, type BoardColumn } from "@/components/organisms/BoardView";
import { CardContentTicket } from "@/components/molecules/CardContentTicket";
import { Tag } from "@/components/atoms/Tag";
import { isIconName } from "@/components/atoms/Icon";
import { isPriority } from "@/lib/boards/enums";
import { applyCardMove, type CardMove } from "@/lib/boards/optimistic";
import type { BoardWithColumns, CardWithLabels } from "@/lib/boards/types";
import { useTeDoenColumnPanel } from "./TeDoenColumnPanel";
import { CardDetailPanel, type CardDetailPanelTarget } from "./CardDetailPanel";
import { createCard, deleteCard, moveCard, updateCard } from "./actions";

// Client wrapper around BoardView (#93) — also owns the card-detail
// SidePanel's open/target state and the server-action calls (#94), per the
// ticket's explicit "keep BoardView presentational" instruction generalized
// to CardDetailPanel too: both stay props-in/callback-out, this file is the
// only place that imports "use server" code. BoardView's `renderItem` is a
// function prop, and functions can't cross the Server->Client boundary — so
// `page.tsx`/`TeDoenPageBody.tsx` stay Server Components that only fetch
// `BoardWithColumns` (plain, serializable data) and this file is the lowest
// point the client boundary can start. Composition/label decisions:
// design/notes/TeDoenBoard.md; panel wiring: design/notes/CardDetailPanel.md;
// #96 drag persistence + optimistic update: design/notes/TeDoenBoard.md.
export interface TeDoenBoardProps {
  board: BoardWithColumns;
  /** #95: true whenever a non-manual sort (`?sort=`) is active — see design/notes/TeDoenBoard.md for why dragging is disabled rather than persisting a move against a view the stored `position` no longer matches. */
  dragDisabled?: boolean;
}

export function TeDoenBoard({ board, dragDisabled }: TeDoenBoardProps) {
  const t = useTranslations("components.cardContainer");
  const tPriority = useTranslations("boards.priority");
  const tErrors = useTranslations("boards.errors");
  const format = useFormatter();
  const router = useRouter();
  const columnPanel = useTeDoenColumnPanel();

  // Local optimistic copy of `board` (#96) — same pattern @dnd-kit's own
  // docs describe one layer down (Context7 /clauderic/dnd-kit,
  // sortable-state-management.mdx: render from local state, only re-sync
  // from fetched data when nothing is pending, revert to a snapshot on
  // failure). `board` (the server prop) is re-fetched via `router.refresh()`
  // after every create/update/delete/rename in this file, but NOT after a
  // successful move (#114 — see handleMove) — this effect still re-syncs
  // `localBoard` whenever one of those OTHER refreshes lands, EXCEPT while a
  // move is still in flight, so an unrelated mutation's refresh can't yank
  // an in-flight optimistic move out from under it. A *count*, not a
  // boolean: with two quick drags queued (see below), the first settling
  // must not flip this back to "nothing pending" while the second is still
  // outstanding.
  const [localBoard, setLocalBoard] = useState(board);
  const pendingMoves = useRef(0);
  useEffect(() => {
    if (pendingMoves.current === 0) setLocalBoard(board);
  }, [board]);

  // Serializes moveCard() calls one at a time — a second drag dropped before
  // the first request settles must not compute its target position against
  // sibling rows the first move hasn't persisted yet (moveCard fetches live
  // sibling positions per call, server-side). The *optimistic* local reorder
  // still applies immediately for every drop (dnd-kit's own live-drag preview
  // already shows it instantly); only the network calls themselves queue.
  const moveQueue = useRef<Promise<unknown>>(Promise.resolve());
  const [moveError, setMoveError] = useState<string | null>(null);

  function handleMove(move: CardMove) {
    setMoveError(null);
    const preMoveSnapshot = localBoard;
    pendingMoves.current += 1;
    setLocalBoard((current) => applyCardMove(current, move));

    moveQueue.current = moveQueue.current
      .then(() =>
        moveCard({ cardId: move.itemId, columnId: move.toColumnId, targetIndex: move.toIndex }),
      )
      .then((result) => {
        if (!result.success) {
          // Reverts to this specific move's own pre-drop snapshot. If a
          // later drag already landed on top of it while this request was
          // in flight, that later drag's own moveCard() call is queued right
          // behind this one and — once it resolves — either leaves its own
          // (already-applied) optimistic state in place or reverts itself
          // the same way, so the board still converges on server truth
          // either way.
          setLocalBoard(preMoveSnapshot);
          setMoveError(tErrors(result.error));
        }
        // Success: no `router.refresh()` here (#114) — `applyCardMove` above
        // already IS the landed state, so a drop never waits on a network
        // round trip to visually settle. `moveCard` re-queries live sibling
        // positions server-side on every call, so this client's now
        // out-of-date `position` numbers are harmless until the next
        // refresh (any other mutation, or a reload) re-syncs them for free.
      })
      .catch(() => {
        setLocalBoard(preMoveSnapshot);
        setMoveError(tErrors("generic"));
      })
      .finally(() => {
        pendingMoves.current -= 1;
      });
  }

  const columns: BoardColumn<CardWithLabels>[] = localBoard.columns.map((column) => ({
    id: column.id,
    name: column.name,
    icon: isIconName(column.icon) ? column.icon : "Croissant",
    items: column.cards,
  }));
  // Done styling: cards in the rightmost column (by position, not name).
  const lastColumnId = columns[columns.length - 1]?.id;
  const panelColumns = columns.map(({ id, name, icon }) => ({ id, name, icon }));

  // `open`/`target` are independent: closing (X, overlay, Escape) only
  // flips `open` and leaves `target` pointing at whatever was last shown, so
  // SidePanel's close transition has real content to animate away from. A
  // fresh open (Plus, empty-column button, or a card click) always sets
  // both together. Default target picks the board's first column so the
  // panel never renders with an empty Status field before any real open.
  const [panel, setPanel] = useState<{ open: boolean; target: CardDetailPanelTarget }>({
    open: false,
    target: { mode: "create", columnId: panelColumns[0]?.id ?? "" },
  });

  return (
    <>
      {/* Drag-persist failure only (create/update/delete errors surface inside
          CardDetailPanel's own form) — same inline convention as
          CardDetailPanel.tsx/BoardPanel.tsx (`boards.errors.*`, no toast
          component exists in this design system yet). Cleared on the next
          drop attempt; not auto-dismissed otherwise, so a failure stays
          visible until the user acts again. */}
      {moveError && <p className="text-base font-semibold text-priority-urgent">{moveError}</p>}
      <BoardView
        columns={columns}
        dragDisabled={dragDisabled}
        onMove={handleMove}
        addLabel={t("addLabel")}
        editLabel={t("editLabel")}
        emptyLabel={t("addItemLabel")}
        onAddItem={(columnId) => setPanel({ open: true, target: { mode: "create", columnId } })}
        onEditColumn={(columnId) => {
          const column = columns.find((c) => c.id === columnId);
          if (column) columnPanel.openEdit({ id: column.id, name: column.name, icon: column.icon });
        }}
        isItemMuted={(_card, columnId) => columnId === lastColumnId}
        onItemClick={(card) => setPanel({ open: true, target: { mode: "edit", card } })}
        renderItem={(card) => {
          const priority = isPriority(card.priority) ? card.priority : "medium";
          return (
            <CardContentTicket title={card.title}>
              <Tag variant={priority}>{tPriority(priority)}</Tag>
              {card.size && <Tag variant="neutral">{card.size.toUpperCase()}</Tag>}
              {card.due_at && (
                <Tag variant="neutral">
                  {format.dateTime(new Date(card.due_at), {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })}
                </Tag>
              )}
            </CardContentTicket>
          );
        }}
      />
      <CardDetailPanel
        open={panel.open}
        onClose={() => setPanel((current) => ({ ...current, open: false }))}
        columns={panelColumns}
        target={panel.target}
        onCreateCard={createCard}
        onUpdateCard={updateCard}
        onMoveCard={moveCard}
        onDeleteCard={deleteCard}
        onMutated={() => router.refresh()}
      />
    </>
  );
}
