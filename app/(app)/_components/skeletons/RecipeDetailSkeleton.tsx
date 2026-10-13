// figma: node-id=4164:26042 (Recept/Mobile) / 4164:26088 (Recept/Desktop)
import { useTranslations } from "next-intl";
import { Button } from "@/components/atoms/Button";
import { Tag } from "@/components/atoms/Tag";
import { Card } from "@/components/molecules/Card";
import { CardContentIngredient } from "@/components/molecules/CardContentIngredient";
import { CardContentStep } from "@/components/molecules/CardContentStep";
import { cn } from "@/lib/ui/cn";
import { LoadingStatus, SKELETON_BREATHE } from "./skeleton-parts";

/**
 * Loading skeleton for the recipe detail page: the real header row, hero,
 * title block, ingredient and step cards with the data hidden (`invisible` =
 * the frames' opacity 0). Cards bind `surface-secondary` for their content
 * slot (the frames override it). Decisions and measurements:
 * design/notes/Skeletons.md.
 */

// Wet = 4 rows, Dry = 7 rows, as drawn in the frames.
const INGREDIENT_ROWS = [4, 7];

function HiddenIngredientRows({ count }: { count: number }) {
  const t = useTranslations("common");
  return (
    <div className="invisible w-full">
      {Array.from({ length: count }, (_, index) => (
        <CardContentIngredient key={index} name={t("loading")} quantity={t("loading")} divider={index < count - 1} />
      ))}
    </div>
  );
}

export function RecipeDetailSkeleton() {
  const t = useTranslations("components.recipeDetailPage");
  const tCommon = useTranslations("common");
  const filler = tCommon("loading");
  return (
    <>
      <LoadingStatus />
      <div aria-hidden="true" inert className="flex w-full flex-col items-stretch gap-page-stack pr-page-right-equal">
        {/* spacing-flag: Header's itemSpacing (16) has no bound Figma variable — SPACE_BETWEEN layout, same as RecipeDetailPage.tsx — design/notes/Skeletons.md */}
        <div className="flex w-full items-center justify-between gap-4">
          <Button icon="ArrowLeft" aria-label={t("backLabel")} />
          <div className="flex items-center justify-end gap-inline-xl">
            <Button icon="ShoppingBasket">
              <span className="md:hidden">{t("addToBasketShortLabel")}</span>
              <span className="hidden md:inline">{t("addToBasketLabel")}</span>
            </Button>
            <div className="hidden items-center gap-inline-xl md:flex">
              <Button variant="filled" icon="Pencil">
                {t("editLabel")}
              </Button>
              <Button variant="destructive" icon="Trash">
                {t("deleteLabel")}
              </Button>
            </div>
            <Button icon="Ellipsis" aria-label={t("overflowMenuLabel")} className="md:hidden" />
          </div>
        </div>

        {/* spacing-flag: "image 63" rectangle (node 4164:26050 Mobile / 4164:26097 Desktop) has cornerRadius 12 with no bound variable — design/notes/Skeletons.md */}
        <div className={cn("aspect-[2/1] w-full rounded-xl bg-surface-secondary", SKELETON_BREATHE)} />

        {/* spacing-flag: Title frame itemSpacing 24 (node 4164:26051 / 4164:26098) is unbound in Figma — design/notes/Skeletons.md */}
        <div className="flex w-full flex-col items-center gap-6 py-component-lg">
          <h1 className="invisible w-full text-center text-4xl font-semibold text-text-primary">{filler}</h1>
          {/* spacing-flag: "Frame 1" itemSpacing 24 (node 4164:26053 / 4164:26100) is unbound in Figma — design/notes/Skeletons.md */}
          <div className="flex items-center gap-6">
            <Button icon="Minus" aria-label={filler} />
            <span className="invisible text-xl font-semibold">{filler}</span>
            <Button icon="Plus" aria-label={filler} />
          </div>
        </div>

        {/* spacing-flag: ingredient-group wrapper row gap, same as RecipeDetailPage.tsx's own (page-stack stacked, unbound as a row) — design/notes/Skeletons.md */}
        <div className="flex w-full flex-col gap-6 md:flex-row">
          {INGREDIENT_ROWS.map((rows) => (
            <Card
              key={rows}
              className={cn("md:flex-1", SKELETON_BREATHE)}
              contentClassName="bg-surface-secondary"
            >
              <HiddenIngredientRows count={rows} />
            </Card>
          ))}
        </div>

        <div className="flex w-full flex-col gap-page-stack">
          <Card
            step={<span className="invisible">1</span>}
            className={SKELETON_BREATHE}
            contentClassName="bg-surface-secondary"
          >
            <div className="invisible w-full">
              <CardContentStep text={filler} withIngredientTags={false} />
            </div>
          </Card>
          <Card
            step={<span className="invisible">2</span>}
            className={SKELETON_BREATHE}
            contentClassName="bg-surface-secondary"
          >
            <div className="invisible w-full">
              <CardContentStep text={filler}>
                <Tag variant="neutral">{filler}</Tag>
                <Tag variant="neutral">{filler}</Tag>
                <Tag variant="neutral">{filler}</Tag>
              </CardContentStep>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
