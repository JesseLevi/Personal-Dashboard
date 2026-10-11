"use client";

import { Fragment, useId } from "react";
import type { KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/ui/cn";
import { Button } from "@/components/atoms/Button";
import { Dropdown } from "@/components/atoms/Dropdown";
import type { IconName } from "@/components/atoms/Icon";
import { usePopoverPanel } from "./usePopoverPanel";

// design: Claude-designed on request (#333)
/**
 * EditingBar's "More" overflow: an icon-only `Button` trigger plus a portalled
 * `Dropdown` panel (`role="menu"`) of icon + label rows in separated sections.
 * Toggles are `menuitemcheckbox` (`aria-checked`), plain actions `menuitem`.
 * Placement and dismissal come from `usePopoverPanel`; the keyboard contract
 * and why this is its own part: design/notes/EditingBar.md (#333).
 */
export interface EditingBarOverflowItem {
  id: string;
  icon: IconName;
  label: string;
  /** Present for toggles (renders `menuitemcheckbox`), absent for plain actions. */
  active?: boolean;
  onSelect: () => void;
}

export interface EditingBarOverflowProps {
  /** Accessible name of the trigger and the panel ("More"). */
  menuLabel: string;
  sections: EditingBarOverflowItem[][];
  /** Returns focus to the document (Escape, Tab, outside click, after a choice). */
  onDismiss: () => void;
  tabIndex: number;
  onTriggerFocus: () => void;
}

export function EditingBarOverflow({ menuLabel, sections, onDismiss, tabIndex, onTriggerFocus }: EditingBarOverflowProps) {
  const panelId = useId();
  const { placement, isOpen, open, close, wrapperRef, panelRef } = usePopoverPanel((panel) => {
    const rows = panel.querySelectorAll<HTMLButtonElement>("[role^=menuitem]");
    (Array.from(rows).find((row) => row.getAttribute("aria-checked") === "true") ?? rows[0])?.focus();
  });

  function rows() {
    return Array.from(panelRef.current?.querySelectorAll<HTMLButtonElement>("[role^=menuitem]") ?? []);
  }

  function dismiss() {
    close();
    onDismiss();
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const items = rows();
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    let next: number | null = null;
    if (event.key === "ArrowDown") next = (index + 1) % items.length;
    else if (event.key === "ArrowUp") next = (index - 1 + items.length) % items.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = items.length - 1;
    else if (event.key === "Escape" || event.key === "Tab") {
      event.preventDefault();
      event.stopPropagation();
      dismiss();
      return;
    }
    if (next === null) return;
    event.preventDefault();
    event.stopPropagation();
    items[next]?.focus();
  }

  return (
    <span ref={wrapperRef} className="contents">
      <Button
        variant="transparent"
        icon="Ellipsis"
        aria-label={menuLabel}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? panelId : undefined}
        data-toolbar-item=""
        tabIndex={tabIndex}
        onFocus={onTriggerFocus}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            event.stopPropagation();
            open();
          }
        }}
        onClick={() => (isOpen ? close() : open())}
      />
      {placement &&
        createPortal(
          <div
            ref={panelRef}
            id={panelId}
            style={placement.style}
            onKeyDown={handleMenuKeyDown}
            className={cn(
              "fixed z-20 w-max min-w-48 max-w-[calc(100vw-2rem)] max-h-[calc(100dvh-6rem)] overflow-y-auto",
              placement.alignRight ? "right-[var(--menu-x)]" : "left-[var(--menu-x)]",
              placement.openUp ? "bottom-[var(--menu-y)] pb-stack-xs" : "top-[var(--menu-y)] pt-stack-xs",
            )}
          >
            <Dropdown role="menu" aria-label={menuLabel} className="shadow-sm">
              {sections.map((section, sectionIndex) => (
                <Fragment key={sectionIndex}>
                  {sectionIndex > 0 && <div role="separator" className="-mx-component-xs h-px w-auto shrink-0 bg-stroke-lines" />}
                  {section.map((item) => (
                    <Button
                      key={item.id}
                      role={item.active === undefined ? "menuitem" : "menuitemcheckbox"}
                      aria-checked={item.active}
                      variant="transparent"
                      align="left"
                      icon={item.icon}
                      tabIndex={-1}
                      trailingIcon={item.active ? "Check" : undefined}
                      className={item.active ? "text-text-primary" : undefined}
                      onClick={() => {
                        close();
                        item.onSelect();
                      }}
                    >
                      {item.label}
                    </Button>
                  ))}
                </Fragment>
              ))}
            </Dropdown>
          </div>,
          document.body,
        )}
    </span>
  );
}
