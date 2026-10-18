// design: Claude-designed (#533)
"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type RefObject } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { Button } from "@/components/atoms/Button";
import { Dropdown } from "@/components/atoms/Dropdown";
import { InputField } from "@/components/atoms/InputField";
import { useOutsidePress } from "@/lib/dom/use-outside-press";
import { usePopoverPosition } from "@/lib/dom/use-popover-position";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface AgendaDatePickerProps {
  open: boolean;
  /** The title button the popover hangs from. */
  anchorRef: RefObject<HTMLElement | null>;
  /** The date shown now, `YYYY-MM-DD`; the field starts on it. */
  date: string;
  onSelect: (date: string) => void;
  onClose: (restoreFocus: boolean) => void;
}

// "Naar datum": a popover under the header title with a date field and a confirm button.
export function AgendaDatePicker({ open, anchorRef, date, onSelect, onClose }: AgendaDatePickerProps) {
  const t = useTranslations("components.pageHeader.agenda");
  const popoverRef = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState(date);
  const popover = usePopoverPosition(anchorRef, popoverRef, { open, anchor: "left", prefer: "below", strategy: "fixed" });
  const placed = popover.style.visibility !== "hidden";

  useOutsidePress([anchorRef, popoverRef], () => {
    if (open) onClose(false);
  });

  // Each opening starts on the date that is shown.
  useEffect(() => {
    if (open) setValue(date);
  }, [open, date]);

  useEffect(() => {
    if (open && placed) popoverRef.current?.querySelector("input")?.focus();
  }, [open, placed]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Escape") return;
    event.stopPropagation();
    onClose(true);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!DATE.test(value)) return;
    onSelect(value);
    onClose(true);
  }

  if (!open) return null;
  return createPortal(
    <div ref={popoverRef} className="z-[999] w-72" style={popover.style} onKeyDown={handleKeyDown}>
      <Dropdown className="shadow-sm" role="dialog" aria-label={t("goToDateLabel")}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-stack-sm">
          <InputField
            id="agenda-go-to-date"
            type="date"
            label={t("goToDateLabel")}
            leadingIcon="Calendar"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
          <Button type="submit" variant="filled" icon="Check" disabled={!DATE.test(value)}>
            {t("goToDateConfirm")}
          </Button>
        </form>
      </Dropdown>
    </div>,
    document.body,
  );
}
