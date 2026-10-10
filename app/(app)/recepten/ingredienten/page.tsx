import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getIngredientAdminData } from "@/lib/recipes/ingredient-admin";
import { isAdmin } from "@/lib/recipes/session";
import { searchIngredients } from "../actions";
import {
  createAlias,
  createEigenIngredient,
  deleteAlias,
  deleteEigenIngredient,
  updateAlias,
  updateEigenIngredient,
} from "./actions";
import { IngredientAdmin } from "./IngredientAdmin";

// Admin-only ingredient management (ADR-0020 §6): Koppelingen + Eigen
// ingrediënten (#325, #350). Everyone else gets a 404, so the route is not
// discoverable; RLS is the real write boundary. "Nog te koppelen" lands in
// #326. design/notes/IngredientAdminPage.md.
export default async function IngredientAdminPage() {
  if (!(await isAdmin())) notFound();
  const t = await getTranslations("recipes.ingredientAdmin");
  const { aliases, eigen } = await getIngredientAdminData();
  return (
    <IngredientAdmin
      title={t("title")}
      aliases={aliases}
      eigen={eigen}
      onSearch={searchIngredients}
      onCreateAlias={createAlias}
      onUpdateAlias={updateAlias}
      onDeleteAlias={deleteAlias}
      onCreateEigen={createEigenIngredient}
      onUpdateEigen={updateEigenIngredient}
      onDeleteEigen={deleteEigenIngredient}
    />
  );
}
