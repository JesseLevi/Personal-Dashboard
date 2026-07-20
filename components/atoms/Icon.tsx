// figma: node-id=3760:6187
import type { ComponentType } from "react";
import {
  PanelLeftClose,
  PanelLeftOpen,
  ShoppingBasket,
  Lightbulb,
  Clock,
  Loader,
  Broccoli,
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
 * "Icons" frame (node-id 3760:6187). As of 2026-07-20 the Figma layer names
 * were updated to match lucide-react's export names directly (e.g. `Loading`
 * -> `Loader`, `Sort` -> `Arrow-up-down`, `Dots` -> `Ellipsis`, `Trashcan` ->
 * `Trash`, `Basket` -> `Shopping-basket`) — for those, `IconName` is a literal
 * PascalCase of the Figma name and resolves to the identically-named lucide
 * export, so adding a future icon is a direct lookup, no judgment call.
 *
 * Four names remain an intentional exception (verified against the actual
 * rendered SVG paths, not guessed from the name):
 * - `CloseSidebar`/`OpenSidebar`: no single-word lucide match exists; Figma
 *   kept the descriptive name. Backed by `PanelLeftClose`/`PanelLeftOpen`
 *   (verified: same 3-path structure — rounded rect + divider + chevron).
 * - `Cross`: a false friend. lucide's literal `Cross` export is a medical/
 *   plus-sign glyph (single closed path) — visually nothing like Figma's
 *   2-vector diagonal "X" composition. The verified match is lucide's `X`.
 * - `Calendar`: Figma's layer is still misspelled `Calandar` (not renamed);
 *   kept as the established spelling-correction (Architecture §3.1).
 */
export type IconName =
  | "CloseSidebar"
  | "OpenSidebar"
  | "ShoppingBasket"
  | "Lightbulb"
  | "Clock"
  | "Loader"
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
  | "ArrowUpDown"
  | "Sandwich"
  | "Columns"
  | "ChevronDown"
  | "Trash"
  | "Ellipsis"
  | "Calendar"
  | "Cross"
  | "Notebook"
  | "Star"
  | "Check";

// Figma name -> lucide-react component. Verified against lucide-react@1.25.0
// exports (and, for Cross/Trash/sidebar/basket, against actual rendered SVG
// path structure — see the exceptions note above).
const ICONS: Record<IconName, ComponentType<LucideProps>> = {
  CloseSidebar: PanelLeftClose,
  OpenSidebar: PanelLeftOpen,
  ShoppingBasket: ShoppingBasket,
  Lightbulb: Lightbulb,
  Clock: Clock,
  Loader: Loader,
  Broccoli: Broccoli,
  Cake: Cake,
  Infinity: InfinityIcon,
  Croissant: Croissant,
  List: List,
  Plus: Plus,
  Pencil: Pencil,
  Folder: Folder,
  Shirt: Shirt,
  ArrowLeft: ArrowLeft,
  ArrowUpDown: ArrowUpDown,
  Sandwich: Sandwich,
  Columns: Columns2, // Columns is a deprecated alias of Columns2 (identical shape) — import the canonical name.
  ChevronDown: ChevronDown,
  Trash: Trash,
  Ellipsis: Ellipsis,
  Calendar: Calendar,
  Cross: X, // false friend — see exceptions note above.
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
