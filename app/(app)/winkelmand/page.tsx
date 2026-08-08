import { getTranslations } from "next-intl/server";
import { getShoppingListItems } from "@/lib/shopping/queries";
import { WinkelmandList } from "./WinkelmandList";

// #177: Winkelmand page UI, on top of #175/#176's schema + data layer. Same
// Server/Client split as app/(app)/recepten/page.tsx -> ReceptenBoard.tsx:
// this stays a thin Server Component that only fetches serialisable
// ShoppingListItemRow[] (getShoppingListItems() already returns [] signed-
// out, same convention as getRecipeCategoriesWithRecipes) and translated
// strings, and hands them to WinkelmandList.tsx ("use client"), which owns
// row interactions. See design/notes/WinkelmandPage.md.
export default async function WinkelmandPage() {
  const t = await getTranslations();
  const items = await getShoppingListItems();

  return (
    <WinkelmandList
      items={items}
      title={t("nav.shopping")}
      clearAllLabel={t("shopping.page.clearAllLabel")}
      emptyStateText={t("shopping.page.emptyStateText")}
    />
  );
}
