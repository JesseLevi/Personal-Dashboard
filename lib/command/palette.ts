import type { SearchResult } from "@/lib/search/query";
import { matchesQuery } from "./match";
import type { CommandAction, CommandBoard } from "./types";

/** Boards shown with an empty field. */
export const PALETTE_BOARD_LIMIT = 3;

export type PaletteRow =
  | { kind: "action"; key: string; action: CommandAction }
  | { kind: "board"; key: string; board: CommandBoard }
  | { kind: "result"; key: string; result: SearchResult };

export type PaletteGroup = { key: string; label: string; rows: PaletteRow[] };

/** Whole percent of cards done, clamped to 0-100; null for a board without cards (no ring). */
export function boardPercent(board: Pick<CommandBoard, "total" | "done">): number | null {
  if (board.total <= 0) return null;
  return Math.min(100, Math.max(0, Math.round((board.done / board.total) * 100)));
}

/** The first boards in the order `loadBoards` gives them (most recently active first). */
export const pinnedBoards = (boards: readonly CommandBoard[]): CommandBoard[] =>
  boards.slice(0, PALETTE_BOARD_LIMIT);

export const matchingBoards = (boards: readonly CommandBoard[], query: string): CommandBoard[] =>
  boards.filter((board) => matchesQuery(board.name, query));

/** `labelOf` is the translated label, so matching follows the member's language. */
export const matchingActions = (
  actions: readonly CommandAction[],
  labelOf: (action: CommandAction) => string,
  query: string,
): CommandAction[] => actions.filter((action) => matchesQuery(labelOf(action), query));
