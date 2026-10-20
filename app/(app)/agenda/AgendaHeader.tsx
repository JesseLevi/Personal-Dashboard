// design: Claude-designed (#486, #529)
"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/atoms/Button";
import { ButtonToggle } from "@/components/molecules/ButtonToggle";
import { PageHeader } from "@/components/organisms/PageHeader";
import { Toast } from "@/components/organisms/Toast";
import type { AgendaView } from "@/lib/agenda/view";
import type { BasketOption } from "@/lib/shopping/baskets";
import type { ActionResult } from "@/lib/shopping/types";
import { AgendaDatePicker } from "./AgendaDatePicker";
import { AgendaMoreMenu } from "./AgendaMoreMenu";

// The toggle offers four choices; `threeDay` is only what `week` becomes on a phone.
export type AgendaToggleView = Exclude<AgendaView, "threeDay">;

const VIEW_ITEMS: ReadonlyArray<{ value: AgendaToggleView }> = [{ value: "day" }, { value: "week" }, { value: "month" }, { value: "list" }];

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
  /** "+ Nieuw": opens quick add (ADR-0041). */
  onNew: () => void;
  /** The "+ Nieuw" button in the bar; the quick-add popover (from `lg`) hangs from it. */
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
            <span className="text-sm font-semibold whitespace-nowrap text-text-secondary max-lg:hidden">{t("weekNumber", { number: weekNumber })}</span>
          )
        }
        className="gap-x-inline-sm max-lg:flex-wrap max-lg:gap-y-stack-md lg:gap-x-inline-xl lg:items-start lg:[&>div:first-child]:h-12 [&_h1]:text-2xl [&_h1]:whitespace-nowrap [&>div:first-child]:shrink-0"
        actions={
          <div className="max-lg:contents lg:flex lg:min-w-0 lg:flex-1 lg:flex-wrap lg:items-center lg:justify-end lg:gap-x-inline-xl lg:gap-y-stack-md lg:pt-component-xs">
            <span aria-hidden="true" className="hidden h-0 basis-full max-lg:order-3 max-lg:block" />
            <ButtonToggle
              aria-label={t("viewLabel")}
              items={items}
              defaultValue={view}
              value={view}
              size="small"
              tone="button"
              hugFromLg
              onValueChange={(value) => onViewChange(value as AgendaToggleView)}
              className="max-lg:order-4 max-lg:min-w-0 max-lg:flex-1 lg:w-auto lg:max-w-full lg:shrink-0"
            />
            <div className="flex max-w-full flex-wrap items-center justify-end gap-inline-sm max-lg:contents">
              <Button className="text-sm max-lg:order-5" icon="ArrowLeft" aria-label={t("previousLabel")} onClick={onPrevious} />
              <Button className="text-sm max-lg:hidden" onClick={onToday}>
                {t("todayLabel")}
              </Button>
              <Button className="text-sm max-lg:order-6" icon="ArrowRight" aria-label={t("nextLabel")} onClick={onNext} />
              <Button className="text-sm max-lg:hidden" icon="PanelRight" aria-pressed={trayOpen} onClick={onTrayToggle}>
                {t("planLabel")}
              </Button>
              <span className="inline-flex max-lg:order-1 max-lg:ml-auto">
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
              </span>
              <span ref={newButtonRef} className="inline-flex max-lg:order-2">
                <Button className="text-sm" variant="white" icon="Plus" onClick={onNew}>
                  {t("newLabel")}
                </Button>
              </span>
            </div>
          </div>
        }
      />
      {onGoToDate && date && (
        <AgendaDatePicker open={pickerOpen} anchorRef={titleRef} date={date} onSelect={onGoToDate} onClose={closePicker} />
      )}
      <Toast message={toast} onDismiss={() => setToast(null)} />
    </>
  );
}
