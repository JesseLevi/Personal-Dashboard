import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";
import { tokenScales } from "./token-scales.generated";

// Without the token names, twMerge can't tell `text-text-primary` is a colour or
// `gap-x-inline-md` a gap, and would keep both of a conflicting pair (#289).
// Lists are generated from app/theme.css (`pnpm sync:tokens`), never hand-kept.
export const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      color: [...tokenScales.color],
      spacing: [...tokenScales.spacing],
      radius: [...tokenScales.radius],
      ease: [...tokenScales.ease],
    },
  },
});

/** clsx + tailwind-merge: later conflicting utilities win (a caller's `hidden` beats a cva base `inline-flex`). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
