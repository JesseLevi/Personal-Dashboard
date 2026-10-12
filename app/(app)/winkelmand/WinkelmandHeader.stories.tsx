// figma: node-id=4231:15596 (+4231:15721 switcher open)
import { WinkelmandHeader } from "./WinkelmandHeader";
import type { ShoppingListOption } from "./ShoppingListPanel";

const lists: ShoppingListOption[] = [
  { id: "list-1", name: "Mijn mand", isDefault: true },
  { id: "list-2", name: "Gedeelde mand", isDefault: false },
];

const noop = () => {};

const Header = ({ open = false }: { open?: boolean }) => (
  // Room below the header so the open switcher is part of the baseline crop.
  <div className="-mx-4 min-h-[360px]">
    <WinkelmandHeader
      title="Mijn mand"
      lists={lists}
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
    />
  </div>
);

// Closed: title, chevron, and "+ Item", Sorteer, Instellingen, Leeg mand.
export const Default = () => <Header />;

// Switcher open: one option per basket (`User` icon), the current one filled, plus "Toevoegen".
export const SwitcherOpen = () => <Header open />;
