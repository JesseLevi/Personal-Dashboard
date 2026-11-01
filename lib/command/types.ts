import type { IconName } from "@/components/atoms/Icon";

// Shared shapes of the ⌘K command palette (ADR-0048). Data lives in lib/command, rendering in CommandPalette.

export const COMMAND_ACTION_IDS = [
  "new-card",
  "new-note",
  "new-recipe",
  "new-event",
  "open-settings",
  "go-todo",
  "go-agenda",
  "go-notes",
  "go-recipes",
  "go-shopping",
] as const;
export type CommandActionId = (typeof COMMAND_ACTION_IDS)[number];

/** `create` and `navigate` carry an `href`; `settings` is handled by the shell. */
export type CommandAction = {
  id: CommandActionId;
  kind: "create" | "navigate" | "settings";
  icon: IconName;
  href?: string;
  /** Shown with an empty field (create actions and Settings); go-to actions only show on a match. */
  pinned: boolean;
};

/** A Te doen board with its progress: `done` = cards in its done columns (ADR-0050). */
export type CommandBoard = {
  id: string;
  name: string;
  href: string;
  total: number;
  done: number;
  isFavorite: boolean;
};
