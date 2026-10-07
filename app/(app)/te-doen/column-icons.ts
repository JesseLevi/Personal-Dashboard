import type { IconName } from "@/components/atoms/Icon";

// Icon picker for te-doen columns: the four default columns' icons first
// (lib/boards/defaults.ts; the first is also the create-mode default), then a
// general set. Every entry is already in Icon.tsx's IconName union.
export const TODO_COLUMN_ICONS: IconName[] = [
  "Lightbulb",
  "AlarmClockCheck",
  "Loader",
  "CircleCheck",
  "Star",
  "Calendar",
  "Timer",
  "Flame",
  "Check",
  "Columns3",
  "FolderClosed",
  "Notebook",
  "ShoppingBasket",
  "BicepsFlexed",
  "User",
  "Shirt",
  "Image",
  "Scroll",
];
