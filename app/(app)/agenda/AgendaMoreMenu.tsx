// design: Claude-designed (#529)
"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { Button } from "@/components/atoms/Button";
import { Dropdown } from "@/components/atoms/Dropdown";
import { useOutsidePress } from "@/lib/dom/use-outside-press";
import { usePopoverPosition } from "@/lib/dom/use-popover-position";
import { needsBasketChoice, type BasketOption } from "@/lib/shopping/baskets";
import type { ActionResult } from "@/lib/shopping/types";

// Items hidden by a breakpoint (`lg:hidden`) have no layout box and cannot take focus.
function visibleItems(root: HTMLElement | null): HTMLElement[] {
  return Array.from(root?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []).filter((item) => item.offsetParent !== null);
}

export interface AgendaMoreMenuProps {
  onToday: () => void;
  trayOpen: boolean;
  onTrayToggle: () => void;
  /** Omitted: no "Agenda's en categorieën" item. */
  onOpenCalendars?: () => void;
  /** Omitted: no "Week naar mand" item. */
  weekToBasket?: {
    onSend: (listId?: string) => Promise<ActionResult>;
    baskets: BasketOption[];
  };
  /** Called after the week was sent; the header confirms it. */
  onWeekSent: () => void;
  /** Story-only: renders with the menu already open. */
  defaultOpen?: boolean;
}

// The menu of the header's "⋯" button. Below `lg` it also holds what the header drops: Vandaag and the tray toggle.
export function AgendaMoreMenu({
  onToday,
  trayOpen,
  onTrayToggle,
  onOpenCalendars,
  weekToBasket,
  onWeekSent,
  defaultOpen = false,
}: AgendaMoreMenuProps) {
  const t = useTranslations("components.pageHeader.agenda");
  const [open, setOpen] = useState(defaultOpen);
  const [step, setStep] = useState<"menu" | "baskets">("menu");
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const popover = usePopoverPosition(wrapperRef, popoverRef, {
    open,
    anchor: "right",
    prefer: "below",
    strategy: "fixed",
  });
  const placed = popover.style.visibility !== "hidden";

  function close(restoreFocus = true) {
    setOpen(false);
    setStep("menu");
    if (restoreFocus) wrapperRef.current?.querySelector("button")?.focus();
  }

  useOutsidePress([wrapperRef, popoverRef], () => {
    if (open) close(false);
  });

  // Focus moves into the menu once it is placed, and again when the basket choice replaces the items.
  useEffect(() => {
    if (!open || !placed) return;
    visibleItems(popoverRef.current)[0]?.focus();
  }, [open, placed, step]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      close();
      return;
    }
    if (event.key === "Tab") {
      close(false);
      return;
    }
    const items = visibleItems(event.currentTarget);
    const index = items.indexOf(document.activeElement as HTMLElement);
    let next: number;
    switch (event.key) {
      case "ArrowDown":
        next = (index + 1) % items.length;
        break;
      case "ArrowUp":
        next = (index - 1 + items.length) % items.length;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = items.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    items[next]?.focus();
  }

  function choose(action: () => void) {
    close();
    action();
  }

  async function sendWeek(listId?: string) {
    close();
    const result = await weekToBasket?.onSend(listId);
    if (result?.success) onWeekSent();
  }

  return (
    <span ref={wrapperRef} className="inline-flex">
      <Button
        icon="Ellipsis"
        aria-label={t("moreLabel")}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
      />
      {open &&
        createPortal(
          <div ref={popoverRef} className="z-[999] w-72" style={popover.style} onKeyDown={handleKeyDown}>
            <Dropdown className="shadow-sm" role="menu" aria-label={step === "baskets" ? t("chooseBasketLabel") : t("moreLabel")}>
              {step === "menu" ? (
                <>
                  <Button role="menuitem" variant="white" align="left" icon="Calendar" className="lg:hidden" onClick={() => choose(onToday)}>
                    {t("todayLabel")}
                  </Button>
                  <Button role="menuitem" variant="white" align="left" icon="PanelRight" className="lg:hidden" onClick={() => choose(onTrayToggle)}>
                    {trayOpen ? t("trayHideLabel") : t("trayShowLabel")}
                  </Button>
                  {weekToBasket && (
                    <Button
                      role="menuitem"
                      variant="white"
                      align="left"
                      icon="ShoppingBasket"
                      onClick={() => (needsBasketChoice(weekToBasket.baskets) ? setStep("baskets") : void sendWeek())}
                    >
                      {t("weekToBasketLabel")}
                    </Button>
                  )}
                  {onOpenCalendars && (
                    <Button role="menuitem" variant="white" align="left" icon="Settings" onClick={() => choose(onOpenCalendars)}>
                      {t("calendarsLabel")}
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <Button role="menuitem" variant="white" align="left" icon="ArrowLeft" onClick={() => setStep("menu")}>
                    {t("backLabel")}
                  </Button>
                  {(weekToBasket?.baskets ?? []).map((basket) => (
                    <Button
                      key={basket.id}
                      role="menuitem"
                      variant="white"
                      align="left"
                      icon={basket.shared ? "Users" : "User"}
                      onClick={() => void sendWeek(basket.id)}
                    >
                      {basket.name}
                    </Button>
                  ))}
                </>
              )}
            </Dropdown>
          </div>,
          document.body,
        )}
    </span>
  );
}
