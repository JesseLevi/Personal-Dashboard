// figma: node-id=4231:16736
import { ShoppingListPanel, type ShoppingListOption } from "./ShoppingListPanel";
import type { ActionResult, ShoppingListRow } from "@/lib/shopping/types";
import type { ActionResult as SharingActionResult, ListShare, MemberProfile, MemberSearchResult } from "@/lib/sharing/types";
import { useState } from "react";
import { Button } from "@/components/atoms/Button";
import { StoryIntro } from "@/.ladle/story-kit";
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

// Most representative state: a shared basket with a pending invitation. The panel is
// `position: fixed`, so the intro sits in the dimmed area beside it.
export const Overview = () => (
  <div className="min-h-screen">
    <StoryIntro
      what="Side panel to create, rename, share or delete a shopping basket. Owners invite members; a member can only leave."
      note="ShoppingListPanel"
    />
    <Harness target={{ mode: "edit", list: sampleList }} share={pendingShare} />
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

// Real panel, local state: open it for a new basket or one of the existing ones, type, save,
// delete or leave. The line below shows what the panel would have sent.
export const Interactive = () => {
  const [target, setTarget] = useState<Parameters<typeof ShoppingListPanel>[0]["target"] | null>(null);
  const [lastAction, setLastAction] = useState("Nothing sent yet");
  const report = (name: string, input: unknown) => setLastAction(`${name}: ${JSON.stringify(input)}`);

  return (
    <div className="flex max-w-prose flex-col gap-stack-md">
      <StoryIntro
        what="Open the panel for a new basket or an existing one, edit it and save, delete or leave. The line below shows what each action would send."
        note="ShoppingListPanel"
      />
      <div className="flex flex-wrap gap-inline-sm">
        <Button variant="filled" onClick={() => setTarget({ mode: "create" })}>
          New basket
        </Button>
        <Button variant="filled" onClick={() => setTarget({ mode: "edit", list: sampleList })}>
          Edit shared basket
        </Button>
        <Button variant="filled" onClick={() => setTarget({ mode: "edit", list: defaultList })}>
          Edit default basket
        </Button>
        <Button variant="filled" onClick={() => setTarget({ mode: "edit", list: memberList })}>
          Open as member
        </Button>
      </div>
      <p className="break-words text-xs text-text-secondary">{lastAction}</p>
      <ShoppingListPanel
        open={target !== null}
        onClose={() => setTarget(null)}
        target={target ?? { mode: "create" }}
        onCreateList={async (input) => {
          report("createShoppingList", input);
          return mockCreateList(input);
        }}
        onRenameList={async (input) => {
          report("renameShoppingList", input);
          return mockRenameList(input);
        }}
        onDeleteList={async (input) => {
          report("deleteShoppingList", input);
          return mockDeleteList(input);
        }}
        onSearchMembers={mockSearchMembers}
        onInviteMember={async (input) => {
          report("inviteMember", input);
          return mockShareAction(input);
        }}
        onRevokeShare={mockShareAction}
        onLeaveList={async (input) => {
          report("leaveList", input);
          return mockShareAction(input);
        }}
        owner={target?.mode === "edit" && !target.list.isOwner ? { ...member, displayName: "Youri", lastName: "Tukker", id: "owner-1" } : null}
        share={null}
        onCreated={() => setTarget(null)}
        onRenamed={() => setTarget(null)}
        onDeleted={() => setTarget(null)}
      />
    </div>
  );
};
