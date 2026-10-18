// design: Claude-designed (#486)
"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/atoms/Button";
import { AnimatedAddToBasketButton } from "@/components/molecules/AnimatedAddToBasketButton";
import { ButtonToggle, type ButtonToggleItem } from "@/components/molecules/ButtonToggle";
import { PageHeader } from "@/components/organisms/PageHeader";
import type { AgendaView } from "@/lib/agenda/view";
import type { BasketOption } from "@/lib/shopping/baskets";
import type { ActionResult } from "@/lib/shopping/types";

// The toggle offers four choices; `threeDay` is only what `week` becomes on a phone.
export type AgendaToggleView = Exclude<AgendaView, "threeDay">;

const VIEW_ITEMS: ReadonlyArray<{ value: AgendaToggleView; icon: ButtonToggleItem["icon"] }> = [
  { value: "day", icon: "Calendar" },
  { value: "week", icon: "Columns3" },
  { value: "month", icon: "Table" },
  { value: "list", icon: "List" },
];

export function toToggleView(view: AgendaView): AgendaToggleView {
  return view === "threeDay" ? "week" : view;
}

export interface AgendaHeaderProps {
  /** The visible period, e.g. "13–19 okt". */
  title: string;
  /** Initially selected view; the toggle owns its state after that. */
  view: AgendaToggleView;
  onViewChange: (view: AgendaToggleView) => void;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  /** Opens the calendars panel; the settings button is hidden without it. */
  onOpenCalendars?: () => void;
  /** "Week naar mand": sends the visible week's unsent meals. Omitted: no button. */
  weekToBasket?: {
    onSend: (listId?: string) => Promise<ActionResult>;
    baskets: BasketOption[];
  };
}

export function AgendaHeader({
  title,
  view,
  onViewChange,
  onPrevious,
  onNext,
  onToday,
  onOpenCalendars,
  weekToBasket,
}: AgendaHeaderProps) {
  const t = useTranslations("components.pageHeader.agenda");
  const items = VIEW_ITEMS.map((item) => ({ ...item, label: t(`views.${item.value}`) }));

  return (
    <PageHeader
      title={title}
      className="gap-x-inline-xl max-lg:flex-wrap max-lg:gap-y-stack-md lg:items-start lg:[&>div:first-child]:h-12 [&_h1]:whitespace-nowrap [&>div:first-child]:shrink-0"
      actions={
        <div className="max-lg:contents lg:flex lg:min-w-0 lg:flex-1 lg:flex-wrap lg:items-center lg:justify-end lg:gap-x-inline-xl lg:gap-y-stack-md">
          <ButtonToggle
            aria-label={t("viewLabel")}
            items={items}
            defaultValue={view}
            iconOnlyBelowLg
            onValueChange={(value) => onViewChange(value as AgendaToggleView)}
            className="max-lg:order-last max-lg:basis-full lg:w-96 lg:max-w-full"
          />
          <div className="flex max-w-full flex-wrap items-center justify-end gap-inline-sm max-lg:ml-auto">
            {weekToBasket && (
              <AnimatedAddToBasketButton
                label={t("weekToBasketLabel")}
                shortLabel={t("weekToBasketShortLabel")}
                shortLabelBelow="lg"
                addedLabel={t("weekToBasketAddedLabel")}
                onAddToBasket={weekToBasket.onSend}
                baskets={weekToBasket.baskets}
                chooseBasketLabel={t("chooseBasketLabel")}
              />
            )}
            <Button onClick={onToday}>{t("todayLabel")}</Button>
            <Button icon="ArrowLeft" aria-label={t("previousLabel")} onClick={onPrevious} />
            <Button icon="ArrowRight" aria-label={t("nextLabel")} onClick={onNext} />
            {onOpenCalendars && <Button icon="Settings" aria-label={t("calendarsLabel")} onClick={onOpenCalendars} />}
          </div>
        </div>
      }
    />
  );
}
