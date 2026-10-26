// figma: node-id=4231:16736
import { ShoppingListPanel, type ShoppingListOption } from "./ShoppingListPanel";
import type { ActionResult, ShoppingListRow } from "@/lib/shopping/types";
import type { ActionResult as SharingActionResult, ListShare, MemberProfile, MemberSearchResult } from "@/lib/sharing/types";
import type { StoryDefault } from "@ladle/react";

export default { title: "Winkelmand / Shopping list panel" } satisfies StoryDefault;

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

async function mockSearchMembers(input: unknown): Promise<SharingActionResult<MemberSearchResult[]>> {
  console.log("searchMembers", input);
  return { success: true, data: [] };
}
async function mockShareAction(input: unknown): Promise<SharingActionResult> {
  console.log("share action", input);
  return { success: true, data: undefined };
}

const sampleList: ShoppingListOption = { id: "list-2", name: "Gedeelde mand", isDefault: false, isOwner: true, shared: false };
const defaultList: ShoppingListOption = { id: "list-1", name: "Mijn mand", isDefault: true, isOwner: true, shared: false };
const memberList: ShoppingListOption = { ...sampleList, isOwner: false, shared: true };

const member = {
  id: "member-1",
  displayName: "Jesse",
  lastName: "Kamps",
  hasAvatar: false,
  updatedAt: "2026-10-12T10:00:00Z",
};
const pendingShare: ListShare = { member, status: "pending" };
const acceptedShare: ListShare = { member, status: "accepted" };

// `min-h-screen` wrapper: SidePanel is `position: fixed`, so without it the
// baseline collapses to a sliver (see BoardPanel.stories.tsx). Harness-only.
const Harness = ({
  target,
  share = null,
  owner = null,
}: {
  target: Parameters<typeof ShoppingListPanel>[0]["target"];
  share?: ListShare | null;
  owner?: MemberProfile | null;
}) => (
  <div className="min-h-screen">
    <ShoppingListPanel
      open
      onClose={() => {}}
      target={target}
      onCreateList={mockCreateList}
      onRenameList={mockRenameList}
      onDeleteList={mockDeleteList}
      onSearchMembers={mockSearchMembers}
      onInviteMember={mockShareAction}
      onRevokeShare={mockShareAction}
      onLeaveList={mockShareAction}
      owner={owner}
      share={share}
      onCreated={() => {}}
      onRenamed={() => {}}
      onDeleted={() => {}}
    />
  </div>
);

// Create mode: empty Naam, Opslaan disabled until something is typed.
export const CreateList = () => <Harness target={{ mode: "create" }} />;

// Edit mode on a non-default basket (Figma 03): Naam prefilled, "Delen met
// persoon" with the "Kies" placeholder, "Verwijder mand" + Opslaan.
export const EditList = () => <Harness target={{ mode: "edit", list: sampleList }} />;

// Edit mode on the default basket: no delete button.
export const EditDefaultList = () => <Harness target={{ mode: "edit", list: defaultList }} />;

// Figma 07: the invitee has not accepted yet -- name plus the yellow Tag.
export const EditListSharedPending = () => (
  <Harness target={{ mode: "edit", list: sampleList }} share={pendingShare} />
);

// Accepted: name only, no Tag.
export const EditListSharedAccepted = () => (
  <Harness target={{ mode: "edit", list: sampleList }} share={acceptedShare} />
);

// A member (not the owner): name and owner read-only, no sharing field, "Verlaat mand" instead of delete.
export const EditListAsMember = () => (
  <Harness target={{ mode: "edit", list: memberList }} owner={{ ...member, displayName: "Youri", lastName: "Tukker", id: "owner-1" }} />
);
