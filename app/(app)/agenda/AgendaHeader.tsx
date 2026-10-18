// design: Claude-designed (#486, #529)
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/atoms/Button";
import { ButtonToggle, type ButtonToggleItem } from "@/components/molecules/ButtonToggle";
import { PageHeader } from "@/components/organisms/PageHeader";
import { Toast } from "@/components/organisms/Toast";
import type { AgendaView } from "@/lib/agenda/view";
import type { BasketOption } from "@/lib/shopping/baskets";
import type { ActionResult } from "@/lib/shopping/types";
import { AgendaMoreMenu } from "./AgendaMoreMenu";

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
  /** Whether the plan tray is open; "Plannen" reports it with `aria-pressed`. */
  trayOpen: boolean;
  onTrayToggle: () => void;
  /** "+ Nieuw" (the floating button below `lg`). */
  onNew: () => void;
  /** Opens the calendars panel from the menu; the item is hidden without it. */
  onOpenCalendars?: () => void;
  /** "Week naar mand" in the menu: sends the visible week's unsent meals. Omitted: no item. */
  weekToBasket?: {
    onSend: (listId?: string) => Promise<ActionResult>;
    baskets: BasketOption[];
  };
  /** Story-only: renders with the menu already open. */
  defaultMenuOpen?: boolean;
}

export function AgendaHeader({
  title,
  view,
  onViewChange,
  onPrevious,
  onNext,
  onToday,
  trayOpen,
  onTrayToggle,
  onNew,
  onOpenCalendars,
  weekToBasket,
  defaultMenuOpen,
}: AgendaHeaderProps) {
  const t = useTranslations("components.pageHeader.agenda");
  const [toast, setToast] = useState<string | null>(null);
  const items = VIEW_ITEMS.map((item) => ({ ...item, label: t(`views.${item.value}`) }));

  return (
    <>
      <PageHeader
        title={title}
        className="gap-x-inline-xl max-lg:flex-wrap max-lg:gap-y-stack-md lg:items-start lg:[&>div:first-child]:h-12 [&_h1]:whitespace-nowrap [&>div:first-child]:shrink-0"
        actions={
          <div className="max-lg:contents lg:flex lg:min-w-0 lg:flex-1 lg:flex-wrap lg:items-center lg:justify-end lg:gap-x-inline-xl lg:gap-y-stack-md lg:pt-component-xs">
            <ButtonToggle
              aria-label={t("viewLabel")}
              items={items}
              defaultValue={view}
              size="small"
              iconOnlyBelowLg
              onValueChange={(value) => onViewChange(value as AgendaToggleView)}
              className="max-lg:order-last max-lg:basis-full lg:w-96 lg:max-w-full"
            />
            <div className="flex max-w-full flex-wrap items-center justify-end gap-inline-sm max-lg:ml-auto">
              <Button icon="ArrowLeft" aria-label={t("previousLabel")} onClick={onPrevious} />
              <Button className="max-lg:hidden" onClick={onToday}>
                {t("todayLabel")}
              </Button>
              <Button icon="ArrowRight" aria-label={t("nextLabel")} onClick={onNext} />
              <Button className="max-lg:hidden" icon="PanelRight" aria-pressed={trayOpen} onClick={onTrayToggle}>
                {t("planLabel")}
              </Button>
              <AgendaMoreMenu
                onToday={onToday}
                trayOpen={trayOpen}
                onTrayToggle={onTrayToggle}
                onOpenCalendars={onOpenCalendars}
                weekToBasket={weekToBasket}
                onWeekSent={() => setToast(t("weekToBasketToast"))}
                defaultOpen={defaultMenuOpen}
              />
              <Button className="max-lg:hidden" variant="white" icon="Plus" onClick={onNew}>
                {t("newLabel")}
              </Button>
            </div>
          </div>
        }
      />
      <Button
        variant="white"
        icon="Plus"
        aria-label={t("newLabel")}
        onClick={onNew}
        className="fixed right-component-lg bottom-[calc(1rem+env(safe-area-inset-bottom))] z-20 size-14 border border-stroke-primary shadow-sm lg:hidden"
      />
      <Toast message={toast} onDismiss={() => setToast(null)} />
    </>
  );
}
