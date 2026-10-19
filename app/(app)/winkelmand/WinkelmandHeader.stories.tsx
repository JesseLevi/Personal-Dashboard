// figma: node-id=4231:15596 (+4231:15721 switcher open)
import { WinkelmandHeader } from "./WinkelmandHeader";
import type { ShoppingListOption } from "./ShoppingListPanel";
import { AvatarGroup } from "@/components/molecules/AvatarGroup";
import { Card } from "@/components/molecules/Card";
import { CardContentIngredient } from "@/components/molecules/CardContentIngredient";

const lists: ShoppingListOption[] = [
  { id: "list-1", name: "Mijn mand", isDefault: true, isOwner: true, shared: false },
  { id: "list-2", name: "Gedeelde mand", isDefault: false, isOwner: true, shared: true },
];

const noop = () => {};

const Header = ({ open = false, ownerLists = lists, compact = false, confirmClear = false }: { open?: boolean; ownerLists?: ShoppingListOption[]; compact?: boolean; confirmClear?: boolean }) => (
  // Room below the header so the open switcher is part of the baseline crop.
  <div className={compact ? undefined : "-mx-4 min-h-[360px]"}>
    <WinkelmandHeader
      title="Mijn mand"
      lists={ownerLists}
      currentListId="list-1"
      sortBy="recipe"
      onSortChange={noop}
      isEmpty={false}
      onSwitchList={noop}
      onAddList={noop}
      onEditList={noop}
      onAddItem={noop}
      onClearAll={noop}
      defaultListMenuOpen={open}
      defaultClearConfirming={confirmClear}
    />
  </div>
);

// Closed: title, chevron, and "+ Item", Sorteer, Leeg mand.
export const Default = () => <Header />;

// "Leeg mand" asked: the buttons give way to the two-step confirm row.
export const ClearAllConfirm = () => <Header confirmClear compact />;

// Switcher open: one option per basket (`User` icon, trailing `Settings` button), the current one filled, plus "Toevoegen".
export const SwitcherOpen = () => <Header open />;

// A basket someone else owns: the member sees it with `Users` in the switcher.
const memberLists: ShoppingListOption[] = [
  lists[0]!,
  { id: "list-3", name: "Feestje van Sam", isDefault: false, isOwner: false, shared: true },
];
export const SwitcherOpenAsMember = () => <Header open ownerLists={memberLists} />;

// Figma Winkelmand/09: the AvatarGroup sits between the header and the first group.
export const SharedBasket = () => (
  <div className="flex flex-col gap-6">
    <Header compact />
    <AvatarGroup
      members={[
        { id: "owner", name: "Jesse Kamps" },
        { id: "lid", name: "Youri Tukker" },
      ]}
    />
    <Card title="Overig">
      <CardContentIngredient name="Bananen" quantity="3" divider onCheckedToggle={noop} />
      <CardContentIngredient name="Melk" quantity="1 l" onCheckedToggle={noop} />
    </Card>
  </div>
);
