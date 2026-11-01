import type { CommandAction } from "@/lib/command/types";

/** The palette's fixed quick actions, in `COMMAND_ACTION_IDS` order. */
export const COMMAND_ACTIONS: readonly CommandAction[] = [
  { id: "new-card", kind: "create", icon: "Plus", href: "/te-doen?nieuw=1", pinned: true },
  { id: "new-note", kind: "create", icon: "Notebook", href: "/notities?nieuw=1", pinned: true },
  { id: "new-recipe", kind: "create", icon: "ChefHat", href: "/recepten?nieuw=1", pinned: true },
  { id: "new-event", kind: "create", icon: "Calendar", href: "/agenda?nieuw=1", pinned: true },
  { id: "open-settings", kind: "settings", icon: "Settings", pinned: true },
  { id: "go-todo", kind: "navigate", icon: "Columns3", href: "/te-doen", pinned: false },
  { id: "go-agenda", kind: "navigate", icon: "Calendar", href: "/agenda", pinned: false },
  { id: "go-notes", kind: "navigate", icon: "Notebook", href: "/notities", pinned: false },
  { id: "go-recipes", kind: "navigate", icon: "ChefHat", href: "/recepten", pinned: false },
  { id: "go-shopping", kind: "navigate", icon: "ShoppingBasket", href: "/winkelmand", pinned: false },
];
