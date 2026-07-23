import { getTranslations } from "next-intl/server";
import { Button } from "@/components/atoms/Button";
import { PageHeader } from "@/components/organisms/PageHeader";

// Board/category content lands in a later ticket (#28); this route only
// proves the shell + header render. Unlike Te-Doen, Recepten has no board
// switcher, so its title is a fixed page label rather than board data — the
// one case where PageHeader.title IS translated (see design/notes/
// PageHeader.md).
export default async function ReceptenPage() {
  const t = await getTranslations();

  return (
    <PageHeader
      title={t("nav.recipes")}
      actions={
        <Button icon="Plus">
          {t("components.pageHeader.recipes.addCategoryLabel")}
        </Button>
      }
    />
  );
}
