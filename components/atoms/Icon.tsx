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

// `NL`/`UK` have no lucide equivalent — real flag artwork lives in
// public/flags/*.svg (exported from Figma nodes 4160:34392/4160:34393) and
// is rendered through a plain <img>, not the lucide lookup table below.
const FLAG_ICONS = {
  NL: "/flags/nl.svg",
  UK: "/flags/uk.svg",
} as const satisfies Record<string, string>;

// Figma name -> lucide-react component. NL/UK are excluded — they're flags,
// not lucide exports — see FLAG_ICONS above and Icon() below. This table and
// FLAG_ICONS are the single source of `IconName`: add an icon here only.
const ICONS = {
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
} as const satisfies Record<string, ComponentType<LucideProps>>;

/**
 * Stable, dashboard-facing icon vocabulary — one entry per icon in the Figma
 * "Icons" frame (node-id 3760:6187), derived from `ICONS` + `FLAG_ICONS` so
 * the union, the runtime guard and the story can't drift. Keys are the
 * PascalCase Figma layer name, identical to the lucide-react export. Mapping
 * history and name-vs-shape mismatches: `design/notes/Icon.md`.
 */
export type IconName = keyof typeof ICONS | keyof typeof FLAG_ICONS;

/** Every `IconName` (lucide first, then flags) — the Ladle story renders this. */
export const ALL_ICON_NAMES = [...Object.keys(ICONS), ...Object.keys(FLAG_ICONS)] as IconName[];

const ICON_NAMES = new Set<string>(ALL_ICON_NAMES);

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
  if (name in FLAG_ICONS) {
    const flagSrc = FLAG_ICONS[name as keyof typeof FLAG_ICONS];
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
  const IconComponent = ICONS[name as keyof typeof ICONS];
  return <IconComponent size={size} strokeWidth={strokeWidth} className={className} aria-hidden="true" />;
}
