// The open cards the plan drawer offers, grouped per board, and how its search narrows them.
import type { AgendaActionResult } from "@/lib/agenda/schemas";
import { addDays } from "@/lib/agenda/time";
import type { ActionResult } from "@/lib/boards/types";

export interface PlanCard {
  id: string;
  title: string;
  columnName: string;
  /** `cards.planned_for`, `YYYY-MM-DD`. */
  plannedFor: string | null;
}

export interface PlanCardGroup {
  boardId: string;
  boardName: string;
  cards: PlanCard[];
}

/** Where quick add puts a new card: the first column of the favourite board (else the first board). */
export interface QuickAddBoard {
  boardName: string;
  columnId: string;
  columnName: string;
}

/** One board as read from the database; columns and cards in any order. */
export interface PlanBoardInput {
  id: string;
  name: string;
  is_favorite: boolean;
  position: number;
  board_columns: {
    name: string;
    position: number;
    cards: { id: string; title: string; planned_for: string | null; position: number }[];
  }[];
}

function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase();
}

/**
 * Open cards per board: the favourite board first, then by position. The
 * rightmost column of a board is its done column (like the board view), so its
 * cards are left out, and so are boards without an open card. Cards keep column
 * order, then their own position.
 */
export function groupOpenCards(boards: readonly PlanBoardInput[]): PlanCardGroup[] {
  return [...boards]
    .sort((a, b) => Number(b.is_favorite) - Number(a.is_favorite) || a.position - b.position)
    .map((board) => {
      const columns = [...board.board_columns].sort((a, b) => a.position - b.position).slice(0, -1);
      const cards = columns.flatMap((column) =>
        [...column.cards]
          .sort((a, b) => a.position - b.position)
          .map((card) => ({ id: card.id, title: card.title, columnName: column.name, plannedFor: card.planned_for })),
      );
      return { boardId: board.id, boardName: board.name, cards };
    })
    .filter((group) => group.cards.length > 0);
}

/** Cards whose title contains `query` (case and accents ignored); boards left without a card drop out. */
export function filterPlanCards(groups: readonly PlanCardGroup[], query: string): PlanCardGroup[] {
  const needle = fold(query.trim());
  if (needle === "") return [...groups];
  return groups
    .map((group) => ({ ...group, cards: group.cards.filter((card) => fold(card.title).includes(needle)) }))
    .filter((group) => group.cards.length > 0);
}

/** The groups with one card's day replaced (or cleared with `null`). */
export function withPlannedFor(groups: readonly PlanCardGroup[], cardId: string, plannedFor: string | null): PlanCardGroup[] {
  return groups.map((group) => ({
    ...group,
    cards: group.cards.map((card) => (card.id === cardId ? { ...card, plannedFor } : card)),
  }));
}

/** A planned day within the coming week reads as a weekday ("za"); any other as day and month. */
export function plannedLabelStyle(plannedFor: string, today: string): "weekday" | "date" {
  return plannedFor >= today && plannedFor < addDays(today, 7) ? "weekday" : "date";
}

/** A `planCard` result in the Agenda's error vocabulary; the one code it cannot say (`column-mismatch`) becomes `generic`. */
export function toAgendaResult(result: ActionResult): AgendaActionResult {
  if (result.success) return { success: true, data: undefined };
  return { success: false, error: result.error === "column-mismatch" ? "generic" : result.error };
}
