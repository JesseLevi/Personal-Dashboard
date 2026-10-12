// figma: node-id=4164:25190 (Skeleton/Mobile) / 4164:25197 (Skeleton/Desktop)
import { useTranslations } from "next-intl";
import { Button } from "@/components/atoms/Button";
import { InputField } from "@/components/atoms/InputField";
import { Tag } from "@/components/atoms/Tag";
import { CardContentNote } from "@/components/molecules/CardContentNote";
import { CardContentRecipe } from "@/components/molecules/CardContentRecipe";
import { CardContentTicket } from "@/components/molecules/CardContentTicket";
import { Card } from "@/components/molecules/Card";
import { CardContainer } from "@/components/organisms/CardContainer";
import { BOARD_COLUMN_WIDTH, Carousel } from "@/components/organisms/Carousel";
import { PageHeader } from "@/components/organisms/PageHeader";
import { LoadingStatus, SKELETON_BREATHE } from "./skeleton-parts";

/**
 * Loading skeleton for the three kanban pages (/recepten, /te-doen, /notities).
 * Mirrors the real page composition with the data hidden (`invisible` = the
 * Figma frames' opacity 0, keeping each element's own height), so nothing
 * jumps when the content arrives. `counts` = cards per real column (from the
 * pages' count loaders); omitted = header only, no guessed columns.
 * Decisions, measurements, the opacity-0 mapping: design/notes/Skeletons.md.
 */
export type BoardSkeletonVariant = "recipes" | "todo" | "notes";

function SkeletonHeader({ variant }: { variant: BoardSkeletonVariant }) {
  const t = useTranslations();
  if (variant === "recipes") {
    return (
      <PageHeader
        title={t("nav.recipes")}
        actions={<Button icon="Plus">{t("components.pageHeader.recipes.addCategoryLabel")}</Button>}
      />
    );
  }
  if (variant === "todo") {
    // The board name is data, so only its (hidden) line height is kept.
    return (
      <PageHeader
        title={t("common.loading")}
        titlePending
        titleAdornments={
          <>
            <Button icon="ChevronDown" aria-label={t("components.pageHeader.todo.boardSwitcherLabel")} />
            <Button icon="StarPlus" aria-label={t("components.pageHeader.todo.favoriteLabel")} />
          </>
        }
        actions={<Button icon="ArrowUpDown" align="left">{t("components.pageHeader.todo.sortLabel")}</Button>}
      />
    );
  }
  return (
    <PageHeader
      title={t("nav.notes")}
      actions={
        <div className="flex items-center gap-inline-sm md:gap-inline-xl">
          <Button icon="ArrowUpDown" aria-label={t("components.pageHeader.notes.sortLabel")} className="md:hidden" />
          <Button icon="ArrowUpDown" align="left" className="hidden md:inline-flex">
            {t("components.pageHeader.notes.sortLabel")}
          </Button>
          <Button icon="Plus">{t("components.pageHeader.notes.addCategoryLabel")}</Button>
          <div className="hidden md:block md:w-60 md:shrink-0">
            <InputField
              readOnly
              placeholder={t("components.pageHeader.notes.searchPlaceholder")}
              leadingIcon="Search"
            />
          </div>
        </div>
      }
    />
  );
}

// The real card-content molecule per page, hidden — it only supplies the
// natural card height.
function HiddenCardContent({ variant }: { variant: BoardSkeletonVariant }) {
  const t = useTranslations("common");
  const filler = t("loading");
  if (variant === "recipes") {
    return <CardContentRecipe className="invisible" name={filler} duration={filler} />;
  }
  if (variant === "todo") {
    return (
      <CardContentTicket className="invisible" title={filler}>
        <Tag variant="neutral">{filler}</Tag>
      </CardContentTicket>
    );
  }
  return <CardContentNote className="invisible" title={filler} timestamp={filler} snippet={filler} />;
}

export function BoardSkeleton({
  variant,
  counts,
}: {
  variant: BoardSkeletonVariant;
  counts?: number[];
}) {
  const t = useTranslations("common");
  const tNotesHeader = useTranslations("components.pageHeader.notes");
  return (
    <>
      <LoadingStatus />
      <div aria-hidden="true" inert className="flex w-full flex-col gap-page-stack">
        <SkeletonHeader variant={variant} />
        {variant === "notes" && (
          <InputField
            readOnly
            className="pr-page-right-equal md:hidden"
            placeholder={tNotesHeader("searchPlaceholder")}
            leadingIcon="Search"
          />
        )}
        {counts && (
          <Carousel columnWidthClassName={BOARD_COLUMN_WIDTH}>
            {counts.map((cardCount, columnIndex) => (
              <CardContainer
                key={columnIndex}
                name=""
                count=""
                addLabel={t("loading")}
                editLabel={t("loading")}
                // Column header (icon, name, count, buttons) is data: hidden, height kept.
                className="[&>:first-child]:invisible"
                emptyState={
                  cardCount === 0 ? (
                    <div className="flex w-full flex-1 items-center justify-center">
                      <Button variant="white" icon="Plus" className="invisible">
                        {t("loading")}
                      </Button>
                    </div>
                  ) : undefined
                }
              >
                <div className="flex w-full flex-col gap-stack-sm">
                  {Array.from({ length: cardCount }, (_, cardIndex) => (
                    <Card
                      key={cardIndex}
                      className={SKELETON_BREATHE}
                      contentClassName="bg-surface-primary"
                    >
                      <HiddenCardContent variant={variant} />
                    </Card>
                  ))}
                </div>
              </CardContainer>
            ))}
          </Carousel>
        )}
      </div>
    </>
  );
}
