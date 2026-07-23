import { getTranslations } from "next-intl/server";
import { Button } from "@/components/atoms/Button";
import { PageHeader } from "@/components/organisms/PageHeader";

// Board content (Carousel + Card-container columns) lands in a later ticket
// (#90 BoardView); this route only proves the shell + header render and the
// auth guard redirects. Title is a placeholder for the active board's real
// name, deliberately NOT an i18n key — PageHeader.title is board data, not
// UI chrome (see design/notes/PageHeader.md). The seeded default board is
// literally named "Te doen" regardless of locale (supabase/migrations'
// seed_default_board()), the same word as the sidebar's own translated nav
// label purely by coincidence.
export default async function TeDoenPage() {
  const t = await getTranslations("components.pageHeader.todo");

  return (
    <PageHeader
      title="Te doen"
      titleAdornments={
        <>
          <Button icon="ChevronDown" aria-label={t("boardSwitcherLabel")} />
          <Button icon="Star" aria-label={t("favoriteLabel")} />
        </>
      }
      actions={<Button icon="ArrowUpDown">{t("sortLabel")}</Button>}
    />
  );
}
