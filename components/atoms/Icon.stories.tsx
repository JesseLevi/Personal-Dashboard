// figma: node-id=3760:6187
import { Icon, type IconName } from "./Icon";

// Dev-only demo labels for the Ladle workbench — not user-facing (no i18n needed).
// Pre-existing gap, not touched here: this list was already missing `Save`,
// `Coffee`, `Soup`, `Pizza`, `Cookie` before 2026-08-01's 66-icon addition —
// out of scope for this change, only the new food-beverage icons are added.
const ICON_NAMES: IconName[] = [
  "PanelLeftClose",
  "PanelLeftOpen",
  "ShoppingBasket",
  "Lightbulb",
  "AlarmClockCheck",
  "Loader",
  "Broccoli",
  "CakeSlice",
  "Infinity",
  "Croissant",
  "Scroll",
  "Plus",
  "Pencil",
  "FolderClosed",
  "Shirt",
  "ArrowLeft",
  "ArrowUpDown",
  "Sandwich",
  "Columns3",
  "ChevronDown",
  "Trash",
  "Ellipsis",
  "Calendar",
  "X",
  "Notebook",
  "Star",
  "Check",
  "Timer",
  "Astroid",
  "CircleCheck",
  "StarPlus",
  "WeightTilde",
  "AArrowDown",
  "Search",
  "ArrowRightLeft",
  "Minus",
  "Amphora",
  "Apple",
  "Banana",
  "Barrel",
  "Bean",
  "BeanOff",
  "Beef",
  "BeefOff",
  "Beer",
  "BeerOff",
  "Blender",
  "BottleWine",
  "Cake",
  "Candy",
  "CandyCane",
  "CandyOff",
  "Carrot",
  "ChefHat",
  "Cherry",
  "Citrus",
  "CookingPot",
  "Cuboid",
  "CupSoda",
  "Dessert",
  "DnaOff",
  "Donut",
  "Drumstick",
  "Egg",
  "EggFried",
  "EggOff",
  "Fish",
  "FishOff",
  "FishSymbol",
  "GlassWater",
  "Grape",
  "Ham",
  "Hamburger",
  "HandPlatter",
  "Hop",
  "HopOff",
  "IceCreamBowl",
  "IceCreamCone",
  "LeafyGreen",
  "Lollipop",
  "Martini",
  "Microwave",
  "Milk",
  "MilkOff",
  "Nut",
  "NutOff",
  "PaperBag",
  "Popcorn",
  "Popsicle",
  "Refrigerator",
  "Salad",
  "Shell",
  "Snail",
  "Torus",
  "Tractor",
  "Utensils",
  "UtensilsCrossed",
  "Vegan",
  "Wheat",
  "WheatOff",
  "Wine",
  "WineOff",
];

export const AllIcons = () => (
  <div className="grid grid-cols-4 gap-4 bg-surface p-6 sm:grid-cols-6">
    {ICON_NAMES.map((name) => (
      <div
        key={name}
        className="flex flex-col items-center gap-2 rounded-md border border-border-muted p-3 text-text"
      >
        <Icon name={name} />
        <span className="text-xs text-text-muted">{name}</span>
      </div>
    ))}
  </div>
);

export const Sizes = () => (
  <div className="flex items-end gap-4 bg-surface p-6 text-accent">
    <Icon name="Star" size={16} />
    <Icon name="Star" size={24} />
    <Icon name="Star" size={32} />
    <Icon name="Star" size={48} strokeWidth={1.5} />
  </div>
);
