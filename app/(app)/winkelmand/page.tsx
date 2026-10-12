import { notFound, redirect } from "next/navigation";
import { getShoppingLists } from "@/lib/shopping/queries";

// ADR-0035 §10: every basket has its own route, `/winkelmand/[listId]`. The
// bare route sends the user to their default basket, the way `/te-doen`
// falls back to the favourite board. The manifest metadata lives on
// [listId]/page.tsx, the page that actually renders.
export default async function WinkelmandPage() {
  const lists = await getShoppingLists();
  const defaultList = lists.find((list) => list.is_default) ?? lists[0];
  if (!defaultList) notFound();
  redirect(`/winkelmand/${defaultList.id}`);
}
