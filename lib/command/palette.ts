import type { SearchResult } from "@/lib/search/query";
import { matchesQuery } from "./match";
import type { CommandAction, CommandBoard, CommandProject } from "./types";

/** Boards and projects shown with an empty field. */
export const PALETTE_BOARD_LIMIT = 3;
export const PALETTE_PROJECT_LIMIT = 3;

export type PaletteRow =
  | { kind: "action"; key: string; action: CommandAction }
  | { kind: "board"; key: string; board: CommandBoard }
  | { kind: "project"; key: string; project: CommandProject }
  | { kind: "result"; key: string; result: SearchResult };

export type PaletteGroup = { key: string; label: string; rows: PaletteRow[] };

/** Whole percent done, clamped to 0-100; null when `total` is 0 (no ring). The palette only rings projects. */
export function boardPercent(board: Pick<CommandBoard, "total" | "done">): number | null {
  if (board.total <= 0) return null;
  return Math.min(100, Math.max(0, Math.round((board.done / board.total) * 100)));
}

/** The first boards in the order `loadBoards` gives them (most recently active first). */
export const pinnedBoards = (boards: readonly CommandBoard[]): CommandBoard[] =>
  boards.slice(0, PALETTE_BOARD_LIMIT);

/** The first projects in the order `loadProjects` gives them (most recently updated first). */
export const pinnedProjects = (projects: readonly CommandProject[]): CommandProject[] =>
  projects.slice(0, PALETTE_PROJECT_LIMIT);

export const matchingProjects = (projects: readonly CommandProject[], query: string): CommandProject[] =>
  projects.filter((project) => matchesQuery(project.title, query));

export const matchingBoards = (boards: readonly CommandBoard[], query: string): CommandBoard[] =>
  boards.filter((board) => matchesQuery(board.name, query));

/** `labelOf` is the translated label, so matching follows the member's language. */
export const matchingActions = (
  actions: readonly CommandAction[],
  labelOf: (action: CommandAction) => string,
  query: string,
): CommandAction[] => actions.filter((action) => matchesQuery(labelOf(action), query));
