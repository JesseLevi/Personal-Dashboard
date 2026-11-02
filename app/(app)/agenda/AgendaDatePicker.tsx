// design: Claude-designed (#533, #744)
"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
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

// "Naar datum": a popover under the header title with a date field. Picking a date goes there at once; typing
// waits for Enter or leaving the field, because a native date field fires `change` for every complete value.
export function AgendaDatePicker({ open, anchorRef, date, onSelect, onClose }: AgendaDatePickerProps) {
  const t = useTranslations("components.pageHeader.agenda");
  const popoverRef = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState(date);
  const keyDown = useRef(false);
  const typed = useRef(false);
  const popover = usePopoverPosition(anchorRef, popoverRef, { open, anchor: "left", prefer: "below", strategy: "fixed" });
  const placed = popover.style.visibility !== "hidden";

  useOutsidePress([anchorRef, popoverRef], () => {
    if (open) onClose(false);
  });

  // Each opening starts on the date that is shown.
  useEffect(() => {
    if (!open) return;
    setValue(date);
    typed.current = false;
  }, [open, date]);

  useEffect(() => {
    if (open && placed) popoverRef.current?.querySelector("input")?.focus();
  }, [open, placed]);

  function go(next: string, restoreFocus: boolean) {
    if (!DATE.test(next)) return;
    typed.current = false;
    onSelect(next);
    onClose(restoreFocus);
  }

  function handleChange(next: string) {
    setValue(next);
    if (keyDown.current) typed.current = true;
    else go(next, true);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose(true);
    }
  }

  function handleFieldKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      go(event.currentTarget.value, true);
    } else if (event.key !== "Escape") keyDown.current = true;
  }

  if (!open) return null;
  return createPortal(
    <div ref={popoverRef} className="z-[999] w-72" style={popover.style} onKeyDown={handleKeyDown}>
      <Dropdown className="shadow-sm" role="dialog" aria-label={t("goToDateLabel")}>
        <InputField
          id="agenda-go-to-date"
          type="date"
          label={t("goToDateLabel")}
          leadingIcon="Calendar"
          value={value}
          onChange={(event) => handleChange(event.target.value)}
          onKeyDown={handleFieldKeyDown}
          onKeyUp={() => (keyDown.current = false)}
          onBlur={(event) => {
            keyDown.current = false;
            if (typed.current) go(event.currentTarget.value, false);
          }}
        />
      </Dropdown>
    </div>,
    document.body,
  );
}
