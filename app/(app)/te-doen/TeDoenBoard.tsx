"use client";

import { useFormatter, useTranslations } from "next-intl";
import { BoardView, type BoardColumn } from "@/components/organisms/BoardView";
import { CardContentTicket } from "@/components/molecules/CardContentTicket";
import { Tag } from "@/components/atoms/Tag";
import { isIconName } from "@/components/atoms/Icon";
import type { BoardWithColumns, CardWithLabels } from "@/lib/boards/types";

// Client wrapper around BoardView (#93). BoardView's `renderItem` is a
// function prop, and functions can't cross the Server->Client boundary — so
// `page.tsx` stays a Server Component that only fetches `BoardWithColumns`
// (plain, serializable data) and this file is the lowest point the client
// boundary can start, owning `renderItem` itself. `onMove` is left unset:
// persisting a drag move is #96, not this ticket. Composition/label
// decisions: design/notes/TeDoenBoard.md.
export interface TeDoenBoardProps {
  board: BoardWithColumns;
}

// cards.priority is DB-checked to these three values (kanban_schema.sql),
// but typed as plain `string` by codegen — validate before it reaches Tag's
// `variant` (whose type is the same three-plus-neutral+highlight union) or
// next-intl's `boards.priority.*` lookup.
const PRIORITIES = ["low", "medium", "urgent"] as const;
type Priority = (typeof PRIORITIES)[number];
function isPriority(value: string): value is Priority {
  return (PRIORITIES as readonly string[]).includes(value);
}

export function TeDoenBoard({ board }: TeDoenBoardProps) {
  const t = useTranslations("components.cardContainer");
  const tPriority = useTranslations("boards.priority");
  const format = useFormatter();

  const columns: BoardColumn<CardWithLabels>[] = board.columns.map((column) => ({
    id: column.id,
    name: column.name,
    icon: isIconName(column.icon) ? column.icon : "Croissant",
    items: column.cards,
  }));

  return (
    <BoardView
      columns={columns}
      addLabel={t("addLabel")}
      editLabel={t("editLabel")}
      emptyLabel={t("addItemLabel")}
      renderItem={(card) => {
        const priority: Priority = isPriority(card.priority) ? card.priority : "medium";
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
  );
}
