// design: Claude-designed (#486, #529)
"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/atoms/Button";
import { ButtonToggle, type ButtonToggleItem } from "@/components/molecules/ButtonToggle";
import { PageHeader } from "@/components/organisms/PageHeader";
import { Toast } from "@/components/organisms/Toast";
import type { AgendaView } from "@/lib/agenda/view";
import type { BasketOption } from "@/lib/shopping/baskets";
import type { ActionResult } from "@/lib/shopping/types";
import { AgendaDatePicker } from "./AgendaDatePicker";
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
  /** The selected view; a shortcut can change it without a click on the toggle. */
  view: AgendaToggleView;
  /** The ISO week number shown next to the title (week, three-day and list views). Omitted: none. */
  weekNumber?: number;
  /** The date the calendar shows, `YYYY-MM-DD`; the date picker starts on it. */
  date?: string;
  /** The date picker's choice. Omitted: the title is plain text (the loading skeleton). */
  onGoToDate?: (date: string) => void;
  /** Reports whether a popover of the header (menu or date picker) is open; the page leaves its shortcuts alone then. */
  onOverlayChange?: (open: boolean) => void;
  onViewChange: (view: AgendaToggleView) => void;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  /** Whether the plan tray is open; "Plannen" reports it with `aria-pressed`. */
  trayOpen: boolean;
  onTrayToggle: () => void;
  /** "+ Nieuw" and the floating button below `lg`: opens quick add (ADR-0041). */
  onNew: () => void;
  /** The "+ Nieuw" button in the bar (from `lg`); the quick-add popover hangs from it. */
  newButtonRef?: RefObject<HTMLElement | null>;
  /** Opens the calendars panel from the menu; the item is hidden without it. */
  onOpenCalendars?: () => void;
  /** "Week naar mand" in the menu: sends the visible week's unsent meals. Omitted: no item. */
  weekToBasket?: {
    onSend: (listId?: string) => Promise<ActionResult>;
    baskets: BasketOption[];
  };
  /** Story-only: renders with the menu already open, on this step. */
  defaultMenuOpen?: boolean;
  defaultMenuStep?: "menu" | "shortcuts";
  /** Story-only: renders with the date picker already open. */
  defaultPickerOpen?: boolean;
}

export function AgendaHeader({
  title,
  view,
  weekNumber,
  date,
  onGoToDate,
  onOverlayChange,
  onViewChange,
  onPrevious,
  onNext,
  onToday,
  trayOpen,
  onTrayToggle,
  onNew,
  newButtonRef,
  onOpenCalendars,
  weekToBasket,
  defaultMenuOpen,
  defaultMenuStep,
  defaultPickerOpen = false,
}: AgendaHeaderProps) {
  const t = useTranslations("components.pageHeader.agenda");
  const [toast, setToast] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(defaultPickerOpen);
  const [menuOpen, setMenuOpen] = useState(false);
  const titleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => onOverlayChange?.(pickerOpen || menuOpen), [pickerOpen, menuOpen, onOverlayChange]);

  function closePicker(restoreFocus: boolean) {
    setPickerOpen(false);
    if (restoreFocus) titleRef.current?.focus();
  }

  const items = VIEW_ITEMS.map((item) => ({ ...item, label: t(`views.${item.value}`) }));

  return (
    <>
      <PageHeader
        title={title}
        titleTrigger={
          onGoToDate && { onClick: () => setPickerOpen((open) => !open), expanded: pickerOpen, buttonRef: titleRef }
        }
        titleAdornments={
          weekNumber !== undefined && (
            <span className="text-base font-semibold whitespace-nowrap text-text-secondary">{t("weekNumber", { number: weekNumber })}</span>
          )
        }
        className="gap-x-inline-xl max-lg:flex-wrap max-lg:gap-y-stack-md lg:items-start lg:[&>div:first-child]:h-12 [&_h1]:whitespace-nowrap [&>div:first-child]:shrink-0"
        actions={
          <div className="max-lg:contents lg:flex lg:min-w-0 lg:flex-1 lg:flex-wrap lg:items-center lg:justify-end lg:gap-x-inline-xl lg:gap-y-stack-md lg:pt-component-xs">
            <ButtonToggle
              aria-label={t("viewLabel")}
              items={items}
              defaultValue={view}
              value={view}
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
                onOpenChange={setMenuOpen}
                defaultOpen={defaultMenuOpen}
                defaultStep={defaultMenuStep}
              />
              <span ref={newButtonRef} className="inline-flex max-lg:hidden">
                <Button variant="white" icon="Plus" onClick={onNew}>
                  {t("newLabel")}
                </Button>
              </span>
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
      {onGoToDate && date && (
        <AgendaDatePicker open={pickerOpen} anchorRef={titleRef} date={date} onSelect={onGoToDate} onClose={closePicker} />
      )}
      <Toast message={toast} onDismiss={() => setToast(null)} />
    </>
  );
}
