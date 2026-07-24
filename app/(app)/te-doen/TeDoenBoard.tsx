"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { BoardView, type BoardColumn } from "@/components/organisms/BoardView";
import { CardContentTicket } from "@/components/molecules/CardContentTicket";
import { Tag } from "@/components/atoms/Tag";
import { isIconName } from "@/components/atoms/Icon";
import { isPriority } from "@/lib/boards/enums";
import type { BoardWithColumns, CardWithLabels } from "@/lib/boards/types";
import { CardDetailPanel, type CardDetailPanelTarget } from "./CardDetailPanel";
import { createCard, deleteCard, moveCard, updateCard } from "./actions";

// Client wrapper around BoardView (#93) — also owns the card-detail
// SidePanel's open/target state and the server-action calls (#94), per the
// ticket's explicit "keep BoardView presentational" instruction generalized
// to CardDetailPanel too: both stay props-in/callback-out, this file is the
// only place that imports "use server" code. BoardView's `renderItem` is a
// function prop, and functions can't cross the Server->Client boundary — so
// `page.tsx` stays a Server Component that only fetches `BoardWithColumns`
// (plain, serializable data) and this file is the lowest point the client
// boundary can start. `onMove` (live drag persistence) is left unset:
// that's #96, not this ticket. Composition/label decisions:
// design/notes/TeDoenBoard.md; panel wiring: design/notes/CardDetailPanel.md.
export interface TeDoenBoardProps {
  board: BoardWithColumns;
}

export function TeDoenBoard({ board }: TeDoenBoardProps) {
  const t = useTranslations("components.cardContainer");
  const tPriority = useTranslations("boards.priority");
  const format = useFormatter();
  const router = useRouter();

  const columns: BoardColumn<CardWithLabels>[] = board.columns.map((column) => ({
    id: column.id,
    name: column.name,
    icon: isIconName(column.icon) ? column.icon : "Croissant",
    items: column.cards,
  }));
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
      <BoardView
        columns={columns}
        addLabel={t("addLabel")}
        editLabel={t("editLabel")}
        emptyLabel={t("addItemLabel")}
        onAddItem={(columnId) => setPanel({ open: true, target: { mode: "create", columnId } })}
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
