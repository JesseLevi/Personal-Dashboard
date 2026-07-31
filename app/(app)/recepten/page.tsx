import { getTranslations } from "next-intl/server";
import { Button } from "@/components/atoms/Button";
import { PageHeader } from "@/components/organisms/PageHeader";
import { getRecipeCategoriesWithRecipes } from "@/lib/recipes/queries";
import { ReceptenBoard } from "./ReceptenBoard";

// #124: real categorie-kanban, replacing the #28 stub. `BoardView`'s
// `renderItem` can't cross the Server->Client boundary, so this stays a thin
// Server Component that fetches `CategoryWithRecipes[]` (lib/recipes/
// queries.ts, #122) and hands it to `ReceptenBoard.tsx` ("use client") — same
// split as app/(app)/te-doen/page.tsx -> TeDoenBoard.tsx. Unlike Te-Doen,
// Recepten has no board switcher, so its title is a fixed page label rather
// than board data — the one case where PageHeader.title IS translated (see
// design/notes/PageHeader.md). The "Categorie" button stays exactly as the
// stub built it (no onClick) — see design/notes/ReceptenBoard.md for why
// wiring it is left to #125.
export default async function ReceptenPage() {
  const t = await getTranslations();
  const categories = await getRecipeCategoriesWithRecipes();

  return (
    <>
      <PageHeader
        title={t("nav.recipes")}
        actions={
          <Button icon="Plus">
            {t("components.pageHeader.recipes.addCategoryLabel")}
          </Button>
        }
      />
      <ReceptenBoard categories={categories} />
    </>
  );
}
