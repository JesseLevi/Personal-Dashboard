import { notFound, redirect } from "next/navigation";
import { getShoppingLists } from "@/lib/shopping/queries";
import { getAuthenticatedUserId } from "@/lib/recipes/session";

// ADR-0035 §10: every basket has its own route, `/winkelmand/[listId]`. The
// bare route sends the user to their default basket, the way `/te-doen`
// falls back to the favourite board. The manifest metadata lives on
// [listId]/page.tsx, the page that actually renders.
export default async function WinkelmandPage() {
  const lists = await getShoppingLists();
  // A shared basket can be its owner's default too: only the user's own counts.
  const userId = await getAuthenticatedUserId();
  const defaultList = lists.find((list) => list.is_default && list.user_id === userId) ?? lists[0];
  if (!defaultList) notFound();
  redirect(`/winkelmand/${defaultList.id}`);
}
