// design: Claude-designed (#744)
"use client";

import { useEffect, useRef, type KeyboardEvent, type RefObject } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { Button } from "@/components/atoms/Button";
import { Dropdown } from "@/components/atoms/Dropdown";
import { useOutsidePress } from "@/lib/dom/use-outside-press";
import { usePopoverPosition } from "@/lib/dom/use-popover-position";

export interface AgendaTitleMenuProps {
  open: boolean;
  /** The title button the menu hangs from. */
  anchorRef: RefObject<HTMLElement | null>;
  onToday: () => void;
  onGoToDate: () => void;
  onClose: (restoreFocus: boolean) => void;
}

// The menu of the header title: Vandaag, or pick a date. Same look as the "⋯" menu (`AgendaMoreMenu`).
export function AgendaTitleMenu({ open, anchorRef, onToday, onGoToDate, onClose }: AgendaTitleMenuProps) {
  const t = useTranslations("components.pageHeader.agenda");
  const popoverRef = useRef<HTMLDivElement>(null);
  const popover = usePopoverPosition(anchorRef, popoverRef, { open, anchor: "left", prefer: "below", strategy: "fixed" });
  const placed = popover.style.visibility !== "hidden";

  useOutsidePress([anchorRef, popoverRef], () => {
    if (open) onClose(false);
  });

  useEffect(() => {
    if (open && placed) popoverRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [open, placed]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose(true);
      return;
    }
    if (event.key === "Tab") {
      onClose(false);
      return;
    }
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'));
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

  if (!open) return null;
  return createPortal(
    <div ref={popoverRef} className="z-[999] w-max" style={popover.style} onKeyDown={handleKeyDown}>
      <Dropdown className="shadow-sm" role="menu" aria-label={t("titleMenuLabel")}>
        <Button role="menuitem" variant="white" align="left" icon="Sun" onClick={onToday}>
          {t("todayLabel")}
        </Button>
        <Button role="menuitem" variant="white" align="left" icon="Calendar" onClick={onGoToDate}>
          {t("goToDateItem")}
        </Button>
      </Dropdown>
    </div>,
    document.body,
  );
}
