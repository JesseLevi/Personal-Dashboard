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
  Astroid,
  CircleCheck,
  StarPlus,
  type LucideProps,
} from "lucide-react";

/**
 * Stable, dashboard-facing icon vocabulary — one entry per icon in the Figma
 * "Icons" frame (node-id 3760:6187). `IconName` is a literal PascalCase of
 * the Figma layer name, kept identical to the matching lucide-react export
 * (spelling-corrected per Figma name, e.g. `Calendar` not `Calandar`), so
 * adding an icon is a direct lookup. Full mapping history, including every
 * name-vs-shape mismatch caught so far: `design/notes/Icon.md`.
 *
 * Every mapping is verified against the actual rendered SVG (element count +
 * path bounding boxes), never assumed from the name alone — same-named
 * lucide exports can still be the wrong glyph.
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
  | "Astroid"
  | "CircleCheck"
  | "StarPlus";

// Figma name -> lucide-react component.
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
  Astroid: Astroid,
  CircleCheck: CircleCheck,
  StarPlus: StarPlus,
};

const ICON_NAMES = new Set<string>(Object.keys(ICONS));

/** Runtime guard for a DB-sourced icon string (e.g. `board_columns.icon`,
 * free-text at the schema layer per lib/boards/schemas.ts) before it's
 * passed to `Icon`. */
export function isIconName(name: string): name is IconName {
  return ICON_NAMES.has(name);
}

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
