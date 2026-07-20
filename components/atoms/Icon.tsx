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
 * One unresolved discrepancy (flagged, not silently resolved — needs a Figma-
 * side decision):
 * - `CloseSidebar`/`OpenSidebar`: Figma's layers are currently named
 *   `Panel-right-open`/`Panel-right-close`, but the actual vector geometry
 *   (divider at x=9, i.e. left third of the box) is unchanged from before and
 *   verified to match lucide's `PanelLeftClose`/`PanelLeftOpen` — not
 *   `PanelRightOpen`/`PanelRightClose` (which have their divider at x=15).
 *   The open/close pairing also looks swapped: the node named "...open" has
 *   a chevron pointing left (the `PanelLeftClose` shape), and the node named
 *   "...close" has a chevron pointing right (the `PanelLeftOpen` shape).
 *   Both the side (left/right) and the direction (open/close) contradict the
 *   name, which points at a mixup on the Figma side rather than an intentional
 *   rename — kept as `CloseSidebar`/`OpenSidebar`, backed by the
 *   geometry-verified `PanelLeftClose`/`PanelLeftOpen`, pending confirmation.
 */
export type IconName =
  | "CloseSidebar"
  | "OpenSidebar"
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
  CloseSidebar: PanelLeftClose,
  OpenSidebar: PanelLeftOpen,
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
