import type { IconName } from "@/components/atoms/Icon";

// General-purpose set for note categories, distinct from /recepten's
// food-specific 74-icon picker — reasoning in design/notes/CategoryPanel.md.
// Every entry is already in Icon.tsx's IconName union; none was added for
// this ticket.
export const NOTE_CATEGORY_ICONS: IconName[] = [
  "FolderClosed",
  "Notebook",
  "Lightbulb",
  "Scroll",
  "Star",
  "Calendar",
  "Timer",
  "AlarmClockCheck",
  "CircleCheck",
  "ShoppingBasket",
  "BicepsFlexed",
  "User",
  "Shirt",
  "Image",
];
