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
  Image,
  Pencil,
  FolderClosed,
  Shirt,
  ArrowLeft,
  ArrowRight,
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
  Save,
  WeightTilde,
  AArrowDown,
  Search,
  ArrowRightLeft,
  Minus,
  Coffee,
  Soup,
  Pizza,
  Cookie,
  Flame,
  BicepsFlexed,
  Droplet,
  User,
  Settings2,
  Amphora,
  Apple,
  Banana,
  Barrel,
  Bean,
  BeanOff,
  Beef,
  BeefOff,
  Beer,
  BeerOff,
  Blender,
  BottleWine,
  Cake,
  Candy,
  CandyCane,
  CandyOff,
  Carrot,
  ChefHat,
  Cherry,
  Citrus,
  CookingPot,
  Cuboid,
  CupSoda,
  Dessert,
  DnaOff,
  Donut,
  Drumstick,
  Egg,
  EggFried,
  EggOff,
  Fish,
  FishOff,
  FishSymbol,
  GlassWater,
  Grape,
  Ham,
  Hamburger,
  HandPlatter,
  Hop,
  HopOff,
  IceCreamBowl,
  IceCreamCone,
  LeafyGreen,
  Lollipop,
  Martini,
  Microwave,
  Milk,
  MilkOff,
  Nut,
  NutOff,
  PaperBag,
  Popcorn,
  Popsicle,
  Refrigerator,
  Salad,
  Shell,
  Snail,
  Torus,
  Tractor,
  Utensils,
  UtensilsCrossed,
  Vegan,
  Wheat,
  WheatOff,
  Wine,
  WineOff,
  Undo2,
  Redo2,
  Heading,
  List,
  TextQuote,
  Table,
  SquareCode,
  CodeXml,
  Bold,
  Italic,
  Strikethrough,
  Underline,
  Highlighter,
  Link,
  Superscript,
  Subscript,
  TextAlignStart,
  TextAlignCenter,
  TextAlignEnd,
  TextAlignJustify,
  Settings,
  LogOut,
  Sun,
  Moon,
  SunMoon,
  EllipsisVertical,
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
  | "Image"
  | "Pencil"
  | "FolderClosed"
  | "Shirt"
  | "ArrowLeft"
  | "ArrowRight"
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
  | "StarPlus"
  | "Save"
  | "WeightTilde"
  | "AArrowDown"
  | "Search"
  | "ArrowRightLeft"
  | "Minus"
  | "Coffee"
  | "Soup"
  | "Pizza"
  | "Cookie"
  // Recept/Mobile+Desktop's NutritionalData row (#160, node 3997:15948/
  // 3997:15543): Flame/BicepsFlexed/Droplet/User verified path-for-path
  // against the fetched Icon/Flame|Biceps-flexed|Droplet|User vectors
  // (3997:15930/3997:15932/3997:15931/3997:25587); Settings2 (Icon/
  // Settings-2, 3997:16080, the Pas-aan trigger) likewise. See design/notes/Icon.md.
  | "Flame"
  | "BicepsFlexed"
  | "Droplet"
  | "User"
  | "Settings2"
  // The 66 below are lucide's full "Food & beverage" category (74 total
  // with the 8 above), added on direct user instruction (2026-08-01) for
  // CategoryPanel's icon picker (#125 follow-up) — not sourced from a
  // Figma frame like every entry above. Names/count verified against
  // lucide-icons/lucide's own per-icon `categories` metadata (GitHub API),
  // never guessed from lucide.dev's page text, which doesn't render the
  // list server-side. Full reasoning: design/notes/Icon.md.
  | "Amphora"
  | "Apple"
  | "Banana"
  | "Barrel"
  | "Bean"
  | "BeanOff"
  | "Beef"
  | "BeefOff"
  | "Beer"
  | "BeerOff"
  | "Blender"
  | "BottleWine"
  | "Cake"
  | "Candy"
  | "CandyCane"
  | "CandyOff"
  | "Carrot"
  | "ChefHat"
  | "Cherry"
  | "Citrus"
  | "CookingPot"
  | "Cuboid"
  | "CupSoda"
  | "Dessert"
  | "DnaOff"
  | "Donut"
  | "Drumstick"
  | "Egg"
  | "EggFried"
  | "EggOff"
  | "Fish"
  | "FishOff"
  | "FishSymbol"
  | "GlassWater"
  | "Grape"
  | "Ham"
  | "Hamburger"
  | "HandPlatter"
  | "Hop"
  | "HopOff"
  | "IceCreamBowl"
  | "IceCreamCone"
  | "LeafyGreen"
  | "Lollipop"
  | "Martini"
  | "Microwave"
  | "Milk"
  | "MilkOff"
  | "Nut"
  | "NutOff"
  | "PaperBag"
  | "Popcorn"
  | "Popsicle"
  | "Refrigerator"
  | "Salad"
  | "Shell"
  | "Snail"
  | "Torus"
  | "Tractor"
  | "Utensils"
  | "UtensilsCrossed"
  | "Vegan"
  | "Wheat"
  | "WheatOff"
  | "Wine"
  | "WineOff"
  // EditingBar toolbar (#227), desktop node 3978:14138 / mobile 3978:14870 —
  // detached FRAMEs, not Icon/* instances (docs/open-questions.md#notes-editingbar-detached-from-components),
  // so verified by lucide-react export presence only, same class as the
  // food-beverage additions above. See design/notes/Icon.md.
  | "Undo2"
  | "Redo2"
  | "Heading"
  | "List"
  | "TextQuote"
  | "Table"
  | "SquareCode"
  | "CodeXml"
  | "Bold"
  | "Italic"
  | "Strikethrough"
  | "Underline"
  | "Highlighter"
  | "Link"
  | "Superscript"
  | "Subscript"
  | "TextAlignStart"
  | "TextAlignCenter"
  | "TextAlignEnd"
  | "TextAlignJustify"
  // #265 Settings/account menu (node 4159:28770/71/72, 4160:33397/98/99):
  // all five shape-verified path-for-path against the installed
  // lucide-react@1.25.0 exports (Figma's C-curve export vs. lucide's `a`/`t`
  // arc notation — same non-difference class as prior entries in this file).
  // Settings' gear is the smooth-scallop redesign, NOT `Cog`/`Settings2` —
  // both were rendered and ruled out. See design/notes/Icon.md.
  | "Settings"
  | "LogOut"
  | "Sun"
  | "Moon"
  | "SunMoon"
  | "EllipsisVertical"
  // #265 Taal field (node 4160:34392/93): flags, not lucide exports — the
  // first non-lucide entries in this union. Rendered via a separate
  // `public/flags/*.svg` branch in the Icon atom below, never inlined here
  // (their brand hex would fail check:server-only). See design/notes/Icon.md.
  | "NL"
  | "UK";

// `NL`/`UK` have no lucide equivalent — real flag artwork lives in
// public/flags/*.svg (exported from Figma nodes 4160:34392/4160:34393) and
// is rendered through a plain <img>, not the lucide lookup table below.
const FLAG_ICONS: Partial<Record<IconName, string>> = {
  NL: "/flags/nl.svg",
  UK: "/flags/uk.svg",
};

// Figma name -> lucide-react component. NL/UK are excluded — they're flags,
// not lucide exports — see FLAG_ICONS above and Icon() below.
const ICONS: Record<Exclude<IconName, "NL" | "UK">, ComponentType<LucideProps>> = {
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
  Image: Image,
  Pencil: Pencil,
  FolderClosed: FolderClosed,
  Shirt: Shirt,
  ArrowLeft: ArrowLeft,
  ArrowRight: ArrowRight,
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
  Save: Save,
  WeightTilde: WeightTilde,
  AArrowDown: AArrowDown,
  Search: Search,
  ArrowRightLeft: ArrowRightLeft,
  Minus: Minus,
  Coffee: Coffee,
  Soup: Soup,
  Pizza: Pizza,
  Cookie: Cookie,
  Flame: Flame,
  BicepsFlexed: BicepsFlexed,
  Droplet: Droplet,
  User: User,
  Settings2: Settings2,
  Amphora: Amphora,
  Apple: Apple,
  Banana: Banana,
  Barrel: Barrel,
  Bean: Bean,
  BeanOff: BeanOff,
  Beef: Beef,
  BeefOff: BeefOff,
  Beer: Beer,
  BeerOff: BeerOff,
  Blender: Blender,
  BottleWine: BottleWine,
  Cake: Cake,
  Candy: Candy,
  CandyCane: CandyCane,
  CandyOff: CandyOff,
  Carrot: Carrot,
  ChefHat: ChefHat,
  Cherry: Cherry,
  Citrus: Citrus,
  CookingPot: CookingPot,
  Cuboid: Cuboid,
  CupSoda: CupSoda,
  Dessert: Dessert,
  DnaOff: DnaOff,
  Donut: Donut,
  Drumstick: Drumstick,
  Egg: Egg,
  EggFried: EggFried,
  EggOff: EggOff,
  Fish: Fish,
  FishOff: FishOff,
  FishSymbol: FishSymbol,
  GlassWater: GlassWater,
  Grape: Grape,
  Ham: Ham,
  Hamburger: Hamburger,
  HandPlatter: HandPlatter,
  Hop: Hop,
  HopOff: HopOff,
  IceCreamBowl: IceCreamBowl,
  IceCreamCone: IceCreamCone,
  LeafyGreen: LeafyGreen,
  Lollipop: Lollipop,
  Martini: Martini,
  Microwave: Microwave,
  Milk: Milk,
  MilkOff: MilkOff,
  Nut: Nut,
  NutOff: NutOff,
  PaperBag: PaperBag,
  Popcorn: Popcorn,
  Popsicle: Popsicle,
  Refrigerator: Refrigerator,
  Salad: Salad,
  Shell: Shell,
  Snail: Snail,
  Torus: Torus,
  Tractor: Tractor,
  Utensils: Utensils,
  UtensilsCrossed: UtensilsCrossed,
  Vegan: Vegan,
  Wheat: Wheat,
  WheatOff: WheatOff,
  Wine: Wine,
  WineOff: WineOff,
  Undo2: Undo2,
  Redo2: Redo2,
  Heading: Heading,
  List: List,
  TextQuote: TextQuote,
  Table: Table,
  SquareCode: SquareCode,
  CodeXml: CodeXml,
  Bold: Bold,
  Italic: Italic,
  Strikethrough: Strikethrough,
  Underline: Underline,
  Highlighter: Highlighter,
  Link: Link,
  Superscript: Superscript,
  Subscript: Subscript,
  TextAlignStart: TextAlignStart,
  TextAlignCenter: TextAlignCenter,
  TextAlignEnd: TextAlignEnd,
  TextAlignJustify: TextAlignJustify,
  Settings: Settings,
  LogOut: LogOut,
  Sun: Sun,
  Moon: Moon,
  SunMoon: SunMoon,
  EllipsisVertical: EllipsisVertical,
};

// ICON_NAMES/isIconName cover the FLAG_ICONS entries too — Icon.tsx's own
// union is the vocabulary, not just this lucide lookup table.
const ICON_NAMES = new Set<string>([...Object.keys(ICONS), ...Object.keys(FLAG_ICONS)]);

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
  /** Forwarded to the underlying SVG — use a text-color token (e.g. `text-text-secondary`) to set color via `currentColor`. */
  className?: string;
}

/**
 * Single wrapper atom around lucide-react (see `design/figma-map.json` ->
 * `Icon/*`). NL/UK are the one exception — real flag artwork (brand hex, so
 * it can't live inline in a `components/` file per check:server-only) served
 * from `public/flags/*.svg` via a plain `<img>`, not lucide. `strokeWidth`
 * has no effect on a flag (filled artwork, no stroke); every caller passes a
 * lucide name in that case anyway, so this is a silent no-op, not a trap.
 */
export function Icon({ name, size = 24, strokeWidth = 2, className }: IconProps) {
  const flagSrc = FLAG_ICONS[name];
  if (flagSrc) {
    return (
      <img
        src={flagSrc}
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        className={className}
      />
    );
  }
  // Safe: the flagSrc branch above already returned for the only two
  // IconName members ICONS doesn't cover (NL/UK).
  const IconComponent = ICONS[name as Exclude<IconName, "NL" | "UK">];
  return <IconComponent size={size} strokeWidth={strokeWidth} className={className} aria-hidden="true" />;
}
