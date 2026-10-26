// figma: node-id=4231:15596 (+4231:15721 switcher open)
import { useState } from "react";
import { WinkelmandHeader, type SortBy } from "./WinkelmandHeader";
import type { ShoppingListOption } from "./ShoppingListPanel";
import { AvatarGroup } from "@/components/molecules/AvatarGroup";
import { Card } from "@/components/molecules/Card";
import { CardContentIngredient } from "@/components/molecules/CardContentIngredient";
import { Button } from "@/components/atoms/Button";
import { Specimen, StoryIntro } from "@/.ladle/story-kit";
import type { StoryDefault } from "@ladle/react";

export default { title: "Winkelmand / Winkelmand header" } satisfies StoryDefault;

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

// Closed, "Leeg mand" confirm and the open switcher side by side.
export const Overview = () => (
  <div>
    <StoryIntro
      what="Header of the shopping basket page: basket name with a switcher, add item, sort and clear all. Clearing asks for a second click."
      note="WinkelmandPage"
    />
    <div className="flex max-w-xl flex-col gap-stack-lg">
      <Specimen label="Closed" hint="Title with chevron, add item, sort, clear all">
        <Header compact />
      </Specimen>
      <Specimen label="Clear all asked" hint="The buttons give way to a two-step confirm">
        <Header confirmClear compact />
      </Specimen>
      <Specimen label="Switcher open" hint="One option per basket, current one filled">
        <div className="min-h-72">
          <Header open compact />
        </div>
      </Specimen>
    </div>
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

// Real header with local state: open the switcher and pick a basket, change the sort, toggle empty.
export const Interactive = () => {
  const [currentListId, setCurrentListId] = useState("list-1");
  const [sortBy, setSortBy] = useState<SortBy>("recipe");
  const [isEmpty, setIsEmpty] = useState(false);
  const [lastAction, setLastAction] = useState("Nothing pressed yet");
  const current = memberLists.find((list) => list.id === currentListId) ?? memberLists[0]!;

  return (
    <div className="flex max-w-md flex-col gap-stack-md">
      <StoryIntro
        what="Open the switcher and pick another basket, change the sort, or press the other buttons. The line below shows what the header reported."
        note="WinkelmandPage"
      />
      <WinkelmandHeader
        title={current.name}
        lists={memberLists}
        currentListId={currentListId}
        sortBy={sortBy}
        onSortChange={(next) => {
          setSortBy(next);
          setLastAction(`Sort by ${next}`);
        }}
        isEmpty={isEmpty}
        onSwitchList={(listId) => {
          setCurrentListId(listId);
          setLastAction(`Switched to ${listId}`);
        }}
        onAddList={() => setLastAction("Add basket")}
        onEditList={(listId) => setLastAction(`Edit settings of ${listId}`)}
        onAddItem={() => setLastAction("Add item")}
        onClearAll={() => {
          setIsEmpty(true);
          setLastAction("Cleared all, sort is now hidden");
        }}
      />
      <p className="text-xs text-text-secondary">{lastAction}</p>
      <div>
        <Button variant="filled" onClick={() => setIsEmpty(false)}>
          Refill basket
        </Button>
      </div>
    </div>
  );
};
