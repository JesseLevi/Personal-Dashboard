import clsx from "clsx";
import { getTranslations } from "next-intl/server";
import { CardContainer } from "@/components/organisms/CardContainer";
import { Carousel } from "@/components/organisms/Carousel";
import { Card } from "@/components/molecules/Card";

// #170: no Figma node exists for a loading skeleton (docs/open-questions.md
// #loading-skeleton-undesigned), so this reuses the real CardContainer/Card
// shells rather than inventing a new look — only the leaf content inside
// each Card is a plain token-coloured placeholder bar, the smallest addition
// that still fills the required `children` slot. Server Components (no
// interactivity), used both as route `loading.tsx` fallbacks and as the
// explicit <Suspense> fallback around the data-dependent page body, so the
// app shell (Sidebar/AppShellNav) never waits on board/recipe data to paint.
// `aria-hidden` on the visual skeleton + a single sr-only `role="status"`
// text is the standard accessible-skeleton pattern, not a designed element.

function LoadingStatus({ label }: { label: string }) {
  return (
    <span role="status" className="sr-only">
      {label}
    </span>
  );
}

function PlaceholderBar({ className }: { className: string }) {
  return <div aria-hidden="true" className={clsx("animate-pulse rounded bg-border", className)} />;
}

const SKELETON_COLUMNS = 3;
const SKELETON_CARDS_PER_COLUMN = 2;

/** Kanban-column skeleton — te-doen and recepten both render a `Carousel` of
 * `CardContainer` columns holding `Card`s (BoardView.tsx), so one shared
 * shape covers both. */
export async function BoardSkeleton() {
  const t = await getTranslations("common");
  return (
    <div className="flex w-full flex-col gap-6">
      <LoadingStatus label={t("loading")} />
      <div aria-hidden="true">
        <Carousel columnWidthClassName="w-74 md:w-80">
          {Array.from({ length: SKELETON_COLUMNS }, (_, columnIndex) => (
            <CardContainer key={columnIndex} name="" count="" addLabel={t("loading")} editLabel={t("loading")}>
              <div className="flex w-full flex-col gap-2">
                {Array.from({ length: SKELETON_CARDS_PER_COLUMN }, (_, cardIndex) => (
                  <Card key={cardIndex}>
                    <div className="flex w-full flex-col gap-2 py-1">
                      <PlaceholderBar className="h-4 w-3/4" />
                      <PlaceholderBar className="h-4 w-1/2" />
                    </div>
                  </Card>
                ))}
              </div>
            </CardContainer>
          ))}
        </Carousel>
      </div>
    </div>
  );
}

const SKELETON_DETAIL_CARDS = 3;

/** Recipe-detail skeleton — stacked `Card`s standing in for the ingredient/
 * step list; no hero-image placeholder shape is added since no Figma frame
 * defines one either (same "don't invent" reasoning as the board skeleton). */
export async function RecipeDetailSkeleton() {
  const t = await getTranslations("common");
  return (
    <div className="flex w-full flex-col gap-6">
      <LoadingStatus label={t("loading")} />
      <div aria-hidden="true" className="flex w-full flex-col gap-2">
        {Array.from({ length: SKELETON_DETAIL_CARDS }, (_, index) => (
          <Card key={index}>
            <div className="flex w-full flex-col gap-2 py-1">
              <PlaceholderBar className="h-4 w-2/3" />
              <PlaceholderBar className="h-4 w-1/3" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
