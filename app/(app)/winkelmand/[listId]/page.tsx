import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { getAcceptedShareListIds, getShoppingListItems, getShoppingLists } from "@/lib/shopping/queries";
import { getAuthenticatedUserId } from "@/lib/recipes/session";
import { getShoppingListPeople, getShoppingListShare } from "@/lib/sharing/queries";
import { pendingInvites } from "@/lib/sharing/actions";
import { memberFullName, toAvatarGroupMembers } from "@/lib/sharing/member";
import { WinkelmandList, type WinkelmandListOption } from "../WinkelmandList";

// #177: Winkelmand page UI, on top of #175/#176's schema + data layer. Same
// Server/Client split as app/(app)/recepten/page.tsx -> ReceptenBoard.tsx:
// this stays a thin Server Component that only fetches serialisable
// ShoppingListItemRow[] and translated strings, and hands them to
// WinkelmandList.tsx ("use client"), which owns row interactions. See
// design/notes/WinkelmandPage.md.
//
// #424: one route per basket. A malformed id, or one that is not among the
// baskets RLS lets this user read, is a 404 (unlike /te-doen, which falls
// back to the favourite board).
//
// #223 follow-up: links this route's own Web App Manifest, same mechanism
// as app/(app)/te-doen/page.tsx — see design/notes/AppShell.md.
export const metadata: Metadata = {
  manifest: "/winkelmand/manifest.webmanifest",
};

export default async function WinkelmandListPage({
  params,
}: {
  params: Promise<{ listId: string }>;
}) {
  const { listId } = await params;
  if (!z.uuid().safeParse(listId).success) notFound();

  const t = await getTranslations();
  const lists = await getShoppingLists();
  if (!lists.some((row) => row.id === listId)) notFound();

  // Only the owner sees and edits the share (#426); RLS also hides it from members.
  const userId = await getAuthenticatedUserId();
  const current = lists.find((row) => row.id === listId);
  const isOwnerOfCurrent = current?.user_id === userId;
  const [items, share, sharedListIds, invitesResult] = await Promise.all([
    getShoppingListItems(listId),
    isOwnerOfCurrent ? getShoppingListShare(listId) : Promise.resolve(null),
    getAcceptedShareListIds(),
    pendingInvites(),
  ]);
  const options: WinkelmandListOption[] = lists.map((row) => ({
    id: row.id,
    name: row.name ?? t("shopping.lists.defaultName"),
    isDefault: row.is_default,
    isOwner: row.user_id === userId,
    shared: row.user_id !== userId || sharedListIds.has(row.id),
  }));

  // #427: the owner first, then the member; empty until someone accepted.
  const { owner, people } = await getShoppingListPeople({
    ownerId: current?.user_id ?? "",
    isOwner: isOwnerOfCurrent,
    share,
    accepted: sharedListIds.has(listId),
  });
  const unnamed = t("components.memberSearchPanel.unnamedLabel");
  const invites = (invitesResult.success ? invitesResult.data : []).map((invite) => ({
    listId: invite.resourceId,
    inviterName: memberFullName(invite.inviter, unnamed),
  }));

  return (
    <WinkelmandList
      key={listId}
      listId={listId}
      lists={options}
      items={items}
      share={share}
      owner={owner}
      people={toAvatarGroupMembers(people, unnamed)}
      invites={invites}
    />
  );
}
