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
 * `Astroid` added for ticket #25 (Organism/Sidebar, node-id 3674:5664, the
 * Assistant/AI-agent nav item's icon, Figma layer "Icon/Astroid", vector node
 * 3726:2493). History: an earlier pass matched the downloaded vector
 * (`M12.6389 21.7716C12.8184 21.6225…`) to lucide's `Sparkle` by leading
 * numeric coefficients alone (11.017/2.814/1.966) and, on the mistaken belief
 * lucide had no `Astroid` export, briefly vendored the Figma path as a custom
 * SVG under that name — wrong on both counts. lucide-react@1.25.0 does ship
 * a literal `Astroid` export (confirmed via Context7 docs, initially missed
 * by a `/asteroid/i` name search — lucide spells it without the middle "e");
 * rendering it side by side against the Figma vector at 1:1 scale shows the
 * same symmetric four-point diamond, whereas `Sparkle` is a visibly different
 * asymmetric twinkle — the shared leading coefficients were a coincidence of
 * the shared 24x24/radius-2 construction, not proof of a shape match.
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
  | "Astroid";

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
  Astroid: Astroid,
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
