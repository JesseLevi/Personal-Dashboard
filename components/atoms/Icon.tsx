// figma: node-id=3760:6187
import type { ComponentType } from "react";
import {
  PanelLeftClose,
  PanelLeftOpen,
  ShoppingBasket,
  Lightbulb,
  AlarmClockCheck,
  Loader,
  Broccoli,
  CakeSlice,
  Infinity as InfinityIcon,
  Croissant,
  Scroll,
  Plus,
  Pencil,
  FolderClosed,
  Shirt,
  ArrowLeft,
  ArrowUpDown,
  Sandwich,
  Columns3,
  ChevronDown,
  Trash,
  Ellipsis,
  Calendar,
  X,
  Notebook,
  Star,
  Check,
  Timer,
  Sparkle,
  type LucideProps,
} from "lucide-react";

/**
 * Stable, dashboard-facing icon vocabulary — one entry per icon in the Figma
 * "Icons" frame (node-id 3760:6187). Figma layer names are kept in sync with
 * lucide-react's export names directly (renamed 2026-07-20, refined again
 * 2026-07-20: `Clock`->`Alarm-clock-check`, `Cake`->`Cake-slice`, `List`->
 * `Scroll`, `Folder`->`Folder-closed`, `Columns`->`Columns-3`), so `IconName`
 * is a literal PascalCase of the Figma name resolving to the identically-named
 * lucide export — adding a future icon is a direct lookup, no judgment call.
 * Every mapping below is verified against the actual rendered SVG (element
 * count + path bounding boxes), not assumed from the name — same-named lucide
 * exports can still be the wrong glyph (see the `Cross`/`X` history below).
 *
 * Two discrepancies surfaced and resolved during Phase 2 (kept as history —
 * this is exactly why every mapping is verified against rendered SVG, not
 * assumed from the name):
 * - The sidebar-panel icons went through two rounds: an open/close label swap
 *   (fixed 2026-07-20), then a left/right correction — the app's sidebar sits
 *   on the left, so the nodes are now named `Panel-left-close`/
 *   `Panel-left-open`, matching the verified vector geometry (divider at
 *   x=9, i.e. the left third of the box) and the chevron direction.
 * - `Cross` was a false friend: lucide's literal `Cross` export is a medical/
 *   plus glyph, not an X — the Figma layer is now named `X` directly.
 *
 * `Timer` added for ticket #19 (Card-content/Recipi, node-id 3628:67): the
 * node's "Icon" child is an IMAGE-SVG with no layer name beyond "Icon", so it
 * was verified by rendered path structure, not name — the fetched vector
 * (two short lines at 10,2->14,2 and 12,14->15,11 plus a circle at cx=12
 * cy=14 r=8) matches lucide's `Timer` export exactly (a plain stopwatch, no
 * checkmark) and does NOT match `AlarmClockCheck`, which was ruled out.
 *
 * `Sparkle` added for ticket #25 (Organism/Sidebar, node-id 3674:5664, the
 * Assistant/AI-agent nav item's icon, Figma layer "Icon/Astroid"): another
 * false-friend name, same class as `Cross`/`X` above — the downloaded vector
 * (a single closed four-point "twinkle" path, `M12.6389 21.7716C12.8184
 * 21.6225…`) is not an asteroid shape at all. Matched by numeric fingerprint
 * against lucide's exports, not by name: normalising Figma's absolute-cubic
 * curve against lucide's relative-arc `Sparkle` path
 * (`M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558…`) shows the same control
 * points (11.017, 2.814/2.81395, 1.966, 5.558) recurring in both, an exact
 * match; `Asterisk`, `Bot`, and `Orbit` were considered and ruled out by
 * shape (none of them are a single four-point star).
 */
export type IconName =
  | "PanelLeftClose"
  | "PanelLeftOpen"
  | "ShoppingBasket"
  | "Lightbulb"
  | "AlarmClockCheck"
  | "Loader"
  | "Broccoli"
  | "CakeSlice"
  | "Infinity"
  | "Croissant"
  | "Scroll"
  | "Plus"
  | "Pencil"
  | "FolderClosed"
  | "Shirt"
  | "ArrowLeft"
  | "ArrowUpDown"
  | "Sandwich"
  | "Columns3"
  | "ChevronDown"
  | "Trash"
  | "Ellipsis"
  | "Calendar"
  | "X"
  | "Notebook"
  | "Star"
  | "Check"
  | "Timer"
  | "Sparkle";

// Figma name -> lucide-react component. Verified against lucide-react@1.25.0
// exports and against actual rendered SVG path/element structure (see the
// class doc comment above for the discrepancies this caught).
const ICONS: Record<IconName, ComponentType<LucideProps>> = {
  PanelLeftClose: PanelLeftClose,
  PanelLeftOpen: PanelLeftOpen,
  ShoppingBasket: ShoppingBasket,
  Lightbulb: Lightbulb,
  AlarmClockCheck: AlarmClockCheck,
  Loader: Loader,
  Broccoli: Broccoli,
  CakeSlice: CakeSlice,
  Infinity: InfinityIcon,
  Croissant: Croissant,
  Scroll: Scroll,
  Plus: Plus,
  Pencil: Pencil,
  FolderClosed: FolderClosed,
  Shirt: Shirt,
  ArrowLeft: ArrowLeft,
  ArrowUpDown: ArrowUpDown,
  Sandwich: Sandwich,
  Columns3: Columns3,
  ChevronDown: ChevronDown,
  Trash: Trash,
  Ellipsis: Ellipsis,
  Calendar: Calendar,
  X: X,
  Notebook: Notebook,
  Star: Star,
  Check: Check,
  Timer: Timer,
  Sparkle: Sparkle,
};

export interface IconProps {
  /** Corrected Figma icon name (see `IconName`), not the lucide name. */
  name: IconName;
  /** Pixel size, applied to both width and height. Defaults to 24 (Figma spec). */
  size?: number;
  /** Stroke width. Defaults to 2 (Figma spec). */
  strokeWidth?: number;
  /** Forwarded to the underlying SVG — use a text-color token (e.g. `text-accent`) to set color via `currentColor`. */
  className?: string;
}

/** Single wrapper atom around lucide-react (see `design/figma-map.json` -> `Icon/*`). */
export function Icon({ name, size = 24, strokeWidth = 2, className }: IconProps) {
  const IconComponent = ICONS[name];
  return <IconComponent size={size} strokeWidth={strokeWidth} className={className} aria-hidden="true" />;
}
