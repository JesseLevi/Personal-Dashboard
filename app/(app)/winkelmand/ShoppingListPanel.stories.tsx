// figma: node-id=4231:16736
import { ShoppingListPanel, type ShoppingListOption } from "./ShoppingListPanel";
import type { ActionResult, ShoppingListRow } from "@/lib/shopping/types";

// Dev-only mock actions, same approach as BoardPanel.stories.tsx: the panel
// takes its actions as props and never imports the "use server" module.
async function mockCreateList(input: unknown): Promise<ActionResult<ShoppingListRow>> {
  console.log("createShoppingList", input);
  return { success: true, data: input as unknown as ShoppingListRow };
}
async function mockRenameList(input: unknown): Promise<ActionResult> {
  console.log("renameShoppingList", input);
  return { success: true, data: undefined };
}
async function mockDeleteList(input: unknown): Promise<ActionResult> {
  console.log("deleteShoppingList", input);
  return { success: true, data: undefined };
}

const sampleList: ShoppingListOption = { id: "list-2", name: "Gedeelde mand", isDefault: false };
const defaultList: ShoppingListOption = { id: "list-1", name: "Mijn mand", isDefault: true };

// `min-h-screen` wrapper: SidePanel is `position: fixed`, so without it the
// baseline collapses to a sliver (see BoardPanel.stories.tsx). Harness-only.
const Harness = ({ target }: { target: Parameters<typeof ShoppingListPanel>[0]["target"] }) => (
  <div className="min-h-screen">
    <ShoppingListPanel
      open
      onClose={() => {}}
      target={target}
      onCreateList={mockCreateList}
      onRenameList={mockRenameList}
      onDeleteList={mockDeleteList}
      onCreated={() => {}}
      onRenamed={() => {}}
      onDeleted={() => {}}
    />
  </div>
);

// Create mode: empty Naam, Opslaan disabled until something is typed.
export const CreateList = () => <Harness target={{ mode: "create" }} />;

// Edit mode on a non-default basket: Naam prefilled, "Verwijder mand" + Opslaan.
export const EditList = () => <Harness target={{ mode: "edit", list: sampleList }} />;

// Edit mode on the default basket: no delete button.
export const EditDefaultList = () => <Harness target={{ mode: "edit", list: defaultList }} />;
