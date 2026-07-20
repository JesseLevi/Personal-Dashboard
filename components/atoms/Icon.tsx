// figma: node-id=3760:6187
import type { ComponentType } from "react";
import {
  PanelLeftClose,
  PanelLeftOpen,
  ShoppingBasket,
  Lightbulb,
  Clock,
  Loader,
  Cake,
  Infinity as InfinityIcon,
  Croissant,
  List,
  Plus,
  Pencil,
  Folder,
  Shirt,
  ArrowLeft,
  ArrowUpDown,
  Sandwich,
  Columns2,
  ChevronDown,
  Trash2,
  Ellipsis,
  Calendar,
  X,
  Notebook,
  Star,
  Check,
  type LucideProps,
} from "lucide-react";

/**
 * Figma "Icons" frame (node-id 3760:6187, 27 icons) has no matching lucide
 * export for the broccoli glyph — verified against the full export list of
 * the installed lucide-react@0.525.0 (no "Broccoli" and no close vegetable
 * equivalent). Drawn by hand at 24x24 with a 2px round-cap/round-join stroke
 * to match the visual weight of the surrounding lucide icons.
 */
function BroccoliIcon({ size = 24, strokeWidth = 2, ...props }: LucideProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M12 13v8" />
      <path d="M9 21h6" />
      <circle cx="7.5" cy="7.5" r="3.5" />
      <circle cx="16.5" cy="7.5" r="3.5" />
      <circle cx="12" cy="5.5" r="3.5" />
    </svg>
  );
}

/**
 * Stable, dashboard-facing icon vocabulary — one entry per icon in the Figma
 * "Icons" frame, spelling corrected (e.g. `Calandar` -> `Calendar`). This is
 * intentionally decoupled from lucide's own naming (see the map below): the
 * app always speaks `IconName`, and only this file knows which lucide export
 * (or custom SVG) currently backs each one.
 */
export type IconName =
  | "CloseSidebar"
  | "OpenSidebar"
  | "Basket"
  | "Lightbulb"
  | "Clock"
  | "Loading"
  | "Broccoli"
  | "Cake"
  | "Infinity"
  | "Croissant"
  | "List"
  | "Plus"
  | "Pencil"
  | "Folder"
  | "Shirt"
  | "ArrowLeft"
  | "Sort"
  | "Sandwich"
  | "Columns"
  | "ChevronDown"
  | "Trashcan"
  | "Dots"
  | "Calendar"
  | "Cross"
  | "Notebook"
  | "Star"
  | "Check";

// Figma name -> lucide-react component (custom SVG for the one gap, above).
const ICONS: Record<IconName, ComponentType<LucideProps>> = {
  CloseSidebar: PanelLeftClose,
  OpenSidebar: PanelLeftOpen,
  Basket: ShoppingBasket,
  Lightbulb: Lightbulb,
  Clock: Clock,
  Loading: Loader,
  Broccoli: BroccoliIcon,
  Cake: Cake,
  Infinity: InfinityIcon,
  Croissant: Croissant,
  List: List,
  Plus: Plus,
  Pencil: Pencil,
  Folder: Folder,
  Shirt: Shirt,
  ArrowLeft: ArrowLeft,
  Sort: ArrowUpDown,
  Sandwich: Sandwich,
  Columns: Columns2,
  ChevronDown: ChevronDown,
  Trashcan: Trash2,
  Dots: Ellipsis,
  Calendar: Calendar,
  Cross: X,
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
