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
 * One partially-resolved discrepancy (open/close fixed by the user 2026-07-20;
 * left/right still flagged, not silently resolved):
 * - `PanelRightClose`/`PanelRightOpen`: Figma originally had these two nodes'
 *   open/close labels swapped relative to their chevron direction — fixed.
 *   The open/close pairing now agrees with the shape (verified: the
 *   "...close" node's chevron points left, matching `PanelLeftClose`; the
 *   "...open" node's chevron points right, matching `PanelLeftOpen`).
 *   Still unresolved: both nodes' divider sits at x=9 (left third of the box),
 *   which is `PanelLeft*` geometry — lucide's actual `PanelRightOpen`/
 *   `PanelRightClose` have their divider at x=15. So the code still renders
 *   the verified-matching `PanelLeftClose`/`PanelLeftOpen` glyphs under
 *   Figma's "right" names. If this sidebar genuinely sits on the right, the
 *   Figma vector (not just the label) needs the divider moved to x=15;
 *   otherwise the label should read "Panel-left-*". Flagging rather than
 *   guessing which is intended.
 */
export type IconName =
  | "PanelRightClose"
  | "PanelRightOpen"
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
  | "Check";

// Figma name -> lucide-react component. Verified against lucide-react@1.25.0
// exports and against actual rendered SVG path/element structure (see the
// class doc comment above for the one unresolved discrepancy).
const ICONS: Record<IconName, ComponentType<LucideProps>> = {
  PanelRightClose: PanelLeftClose, // see left/right note above — shape-verified, name-mismatched
  PanelRightOpen: PanelLeftOpen, // see left/right note above — shape-verified, name-mismatched
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
