import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/organisms/PageHeader";
import { isAdmin } from "@/lib/recipes/session";

// Admin-only ingredient management (ADR-0020 §6). Everyone else gets a 404,
// so the route is not discoverable; RLS is the real write boundary. Content
// (Koppelingen, Eigen ingrediënten, Nog te koppelen) lands in #325/#326.
export default async function IngredientAdminPage() {
  if (!(await isAdmin())) notFound();
  const t = await getTranslations("recipes.ingredientAdmin");
  return <PageHeader title={t("title")} />;
}
