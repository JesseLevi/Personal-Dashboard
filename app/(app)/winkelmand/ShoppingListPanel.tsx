"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { SidePanel } from "@/components/organisms/SidePanel";
import { InputField } from "@/components/atoms/InputField";
import { Button } from "@/components/atoms/Button";
import { Tag } from "@/components/atoms/Tag";
import { MemberSearchPanel } from "@/components/organisms/MemberSearchPanel";
import { DeleteConfirm, useDeleteConfirm } from "@/app/(app)/_components/DeleteConfirm";
import type { ActionResult, ShoppingListRow } from "@/lib/shopping/types";
import { memberFullName } from "@/lib/sharing/member";
import type {
  ActionResult as SharingActionResult,
  ListShare,
  MemberProfile,
  MemberSearchResult,
} from "@/lib/sharing/types";

// design: Claude-designed (#424), from Figma "Winkelmand/03" (4231:16736).
// Add/edit-basket SidePanel content: page-level composition of SidePanel +
// InputField + Button, same precedent as BoardPanel.tsx / CategoryPanel.tsx
// (not in design/figma-map.json). Naam plus, for the owner, the "Delen met
// persoon" field (#426, Figma 4231:16736 / 4233:17612) that opens the generic
// MemberSearchPanel. Never imports "use server" code: the composer passes
// the actions as props so Ladle can mock them.
// Contract: design/notes/ShoppingListPanel.md.

/** A basket as the UI needs it: `name` is already the translated default for a null DB name. */
export interface ShoppingListOption {
  id: string;
  name: string;
  isDefault: boolean;
  /** Only the owner can share (and unshare) a basket; members never see the field. */
  isOwner: boolean;
  /** At least one accepted share, or the caller is not the owner (shows `Users` in the switcher). */
  shared: boolean;
}

export type ShoppingListPanelTarget =
  | { mode: "create" }
  | { mode: "edit"; list: ShoppingListOption };

export interface ShoppingListPanelProps {
  open: boolean;
  onClose: () => void;
  target: ShoppingListPanelTarget;
  onCreateList: (input: unknown) => Promise<ActionResult<ShoppingListRow>>;
  onRenameList: (input: unknown) => Promise<ActionResult>;
  onDeleteList: (input: unknown) => Promise<ActionResult>;
  /** Searches members by name (or exact e-mail). Pass a stable reference. */
  onSearchMembers: (input: unknown) => Promise<SharingActionResult<MemberSearchResult[]>>;
  onInviteMember: (input: unknown) => Promise<SharingActionResult>;
  onRevokeShare: (input: unknown) => Promise<SharingActionResult>;
  /** A member leaves the basket (`leaveShare`). */
  onLeaveList: (input: unknown) => Promise<SharingActionResult>;
  /** The basket owner, shown read-only to a member. */
  owner?: MemberProfile | null;
  /** The owner's current share on the basket being edited (v1: one member). Null/omitted = not shared. */
  share?: ListShare | null;
  /** Fired after a successful create with the new basket (the caller navigates to it). */
  onCreated: (list: ShoppingListRow) => void;
  onRenamed: () => void;
  /** Fired after a successful delete or leave (the caller navigates to the default basket). */
  onDeleted: () => void;
}

export function ShoppingListPanel({
  open,
  onClose,
  target,
  onCreateList,
  onRenameList,
  onDeleteList,
  onSearchMembers,
  onInviteMember,
  onRevokeShare,
  onLeaveList,
  owner = null,
  share = null,
  onCreated,
  onRenamed,
  onDeleted,
}: ShoppingListPanelProps) {
  const t = useTranslations("components.shoppingListPanel");
  const tSidePanel = useTranslations("components.sidePanel");
  const tErrors = useTranslations("shopping.errors");
  const tSharingErrors = useTranslations("sharing.errors");
  const tMember = useTranslations("components.memberSearchPanel");

  const list = target.mode === "edit" ? target.list : null;
  const [name, setName] = useState(list?.name ?? "");
  const { confirming: deleteConfirming, ask: askDelete, cancel: cancelDelete } = useDeleteConfirm();
  const [member, setMember] = useState<MemberProfile | null>(share?.member ?? null);
  const [memberPanelOpen, setMemberPanelOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Reset on open (CategoryPanel's #105 pattern, not a `key` remount, which
  // would destroy the already-painted closed frame the open transition needs).
  const targetKey = target.mode === "edit" ? `edit-${target.list.id}` : "create";
  const [prevOpen, setPrevOpen] = useState(open);
  const [prevTargetKey, setPrevTargetKey] = useState(targetKey);
  if (prevOpen !== open || prevTargetKey !== targetKey) {
    const shouldReset = open && (!prevOpen || targetKey !== prevTargetKey);
    setPrevOpen(open);
    setPrevTargetKey(targetKey);
    if (shouldReset) {
      setName(list?.name ?? "");
      setMember(share?.member ?? null);
      setMemberPanelOpen(false);
      cancelDelete();
      setError(null);
    }
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const trimmed = name.trim();
      if (target.mode === "create") {
        const result = await onCreateList({ name: trimmed });
        if (!result.success) {
          setError(tErrors(result.error));
          return;
        }
        onCreated(result.data);
      } else {
        const result = await onRenameList({ listId: target.list.id, name: trimmed });
        if (!result.success) {
          setError(tErrors(result.error));
          return;
        }
        const shareError = canShare ? await saveShare(target.list.id) : null;
        // The rename (and maybe the revoke) did land: refresh so the page shows it.
        onRenamed();
        if (shareError) {
          setError(shareError);
          return;
        }
      }
      onClose();
    });
  }

  // Brings the stored share in line with the field: revoke the old person,
  // invite the new one (v1: one member per basket). Returns an error message,
  // or null on success. Never reports success when a call failed.
  async function saveShare(listId: string): Promise<string | null> {
    const currentId = share?.member.id ?? null;
    const wantedId = member?.id ?? null;
    if (currentId === wantedId) return null;
    if (currentId) {
      const revoked = await onRevokeShare({ resource: "shopping_list", id: listId, memberId: currentId });
      // not-found: the share is already gone (declined meanwhile), which is what we want.
      if (!revoked.success && revoked.error !== "not-found") return tSharingErrors(revoked.error);
    }
    if (wantedId) {
      const invited = await onInviteMember({ resource: "shopping_list", id: listId, memberId: wantedId });
      if (!invited.success) return tSharingErrors(invited.error);
    }
    return null;
  }

  function handleDelete() {
    if (!list) return;
    setError(null);
    startTransition(async () => {
      const result = await onDeleteList({ listId: list.id });
      if (!result.success) {
        setError(tErrors(result.error));
        cancelDelete();
        return;
      }
      onDeleted();
      onClose();
    });
  }

  function handleLeave() {
    if (!list) return;
    setError(null);
    startTransition(async () => {
      const result = await onLeaveList({ resource: "shopping_list", id: list.id });
      if (!result.success) {
        setError(tSharingErrors(result.error));
        cancelDelete();
        return;
      }
      onDeleted();
      onClose();
    });
  }

  // A member manages nothing: name read-only, "Verlaat mand" instead of delete.
  const isMember = target.mode === "edit" && !target.list.isOwner;
  // Delete is hidden for the default basket (it cannot be deleted, ADR-0035).
  const canDelete = target.mode === "edit" && target.list.isOwner && !target.list.isDefault;
  // Sharing needs an existing basket, so only the edit panel of an owned one.
  const canShare = target.mode === "edit" && target.list.isOwner;
  // A person picked in this panel is always a fresh (pending) invite; the
  // stored status only applies to the person already shared with.
  const pending = member !== null && (member.id !== share?.member.id || share.status === "pending");
  const memberName = member ? memberFullName(member, tMember("unnamedLabel")) : "";

  const footer = isMember ? (
    deleteConfirming ? (
      <DeleteConfirm
        layout="stacked"
        isPending={isPending}
        onCancel={cancelDelete}
        onConfirm={handleLeave}
        labels={{
          prompt: t("leaveConfirmLabel"),
          cancel: t("cancelLabel"),
          confirm: t("leaveConfirmButtonLabel"),
          deleting: t("leavingLabel"),
        }}
      />
    ) : (
      <Button variant="destructive" icon="LogOut" className="w-full" onClick={() => askDelete()} disabled={isPending}>
        {t("leaveLabel")}
      </Button>
    )
  ) : canDelete && deleteConfirming ? (
      <DeleteConfirm
        layout="stacked"
        isPending={isPending}
        onCancel={cancelDelete}
        onConfirm={handleDelete}
        labels={{
          prompt: t("deleteConfirmLabel"),
          cancel: t("cancelLabel"),
          confirm: t("deleteConfirmButtonLabel"),
          deleting: t("deletingLabel"),
        }}
      />
    ) : (
      <div className="flex gap-inline-sm">
        {canDelete && (
          <Button
            variant="destructive"
            icon="Trash"
            className="grow basis-0"
            onClick={() => askDelete()}
            disabled={isPending}
          >
            {t("deleteLabel")}
          </Button>
        )}
        <Button
          variant="filled"
          icon="Save"
          className="grow basis-0"
          onClick={handleSave}
          disabled={isPending || name.trim() === ""}
        >
          {isPending ? t("savingLabel") : t("saveLabel")}
        </Button>
      </div>
    );

  return (
    <>
    <SidePanel
      open={open}
      onClose={onClose}
      title={target.mode === "create" ? t("addTitle") : t("editTitle")}
      closeLabel={tSidePanel("closeLabel")}
      footer={footer}
    >
      <InputField
        label={t("fields.nameLabel")}
        id="shopping-list-panel-name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        readOnly={isMember}
        required
      />
      {isMember && (
        <InputField
          label={t("ownerLabel")}
          id="shopping-list-panel-owner"
          readOnly
          leadingIcon="User"
          value={owner ? memberFullName(owner, tMember("unnamedLabel")) : ""}
        />
      )}
      {canShare && (
        <>
          {/* Read-only field that opens the member search; the trailing X
              (deliberate addition, not in Figma) removes the person on Opslaan. */}
          <InputField
            label={t("fields.shareLabel")}
            id="shopping-list-panel-share"
            readOnly
            leadingIcon="User"
            placeholder={t("fields.sharePlaceholder")}
            value={memberName}
            onClick={() => setMemberPanelOpen(true)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setMemberPanelOpen(true);
              }
            }}
            {...(member
              ? {
                  trailingIcon: "X" as const,
                  onTrailingIconClick: () => setMember(null),
                  trailingIconLabel: t("fields.shareClearLabel", { name: memberName }),
                }
              : { trailingIcon: "Pencil" as const })}
          />
          {pending && (
            <Tag variant="highlight" className="self-start">
              {t("sharePendingTag")}
            </Tag>
          )}
        </>
      )}
      {error && <p className="text-base font-semibold text-priority-urgent">{error}</p>}
    </SidePanel>
    {canShare && (
      <MemberSearchPanel
        open={memberPanelOpen}
        onClose={() => setMemberPanelOpen(false)}
        onSearch={onSearchMembers}
        selectedId={member?.id ?? null}
        // The e-mail is only for telling people apart in the results; not kept.
        onSelect={(picked) =>
          setMember({
            id: picked.id,
            displayName: picked.displayName,
            lastName: picked.lastName,
            hasAvatar: picked.hasAvatar,
            updatedAt: picked.updatedAt,
          })
        }
      />
    )}
    </>
  );
}
