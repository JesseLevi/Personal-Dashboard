"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import type { CSSProperties } from "react";
import { cn } from "@/lib/ui/cn";
import { Button } from "@/components/atoms/Button";
import { Dropdown } from "@/components/atoms/Dropdown";
import type { IconName } from "@/components/atoms/Icon";

// design: Claude-designed on request (#329)
/**
 * EditingBar's menu button (block type, list type): a `Button` trigger plus an
 * unlabelled `Dropdown` panel carrying `role="menu"` and `menuitemradio`
 * rows. Portalled and positioned from the trigger's rect because the bar
 * scrolls horizontally (an in-bar panel would be clipped). Why this is not a
 * new atom, the keyboard contract and the placement rules:
 * design/notes/EditingBar.md.
 */
export interface EditingBarMenuOption {
  id: string;
  label: string;
  active: boolean;
  onSelect: () => void;
}

export interface EditingBarMenuProps {
  icon: IconName;
  /** Visible trigger text: the current selection. */
  currentLabel: string;
  /** Accessible name of the trigger and the panel (e.g. "Block type"). */
  menuLabel: string;
  options: EditingBarMenuOption[];
  /** Returns focus to the document (Escape, Tab, outside click). */
  onDismiss: () => void;
  tabIndex: number;
  onTriggerFocus: () => void;
}

export interface Placement {
  openUp: boolean;
  alignRight: boolean;
  style: CSSProperties;
}

// Runtime geometry only (same exception as EditingBar's keyboard inset):
// handed to Tailwind as custom properties so no colour/spacing is inline.
export function measure(trigger: HTMLElement): Placement {
  const rect = trigger.getBoundingClientRect();
  const openUp = rect.top > window.innerHeight / 2;
  const alignRight = rect.left > window.innerWidth / 2;
  return {
    openUp,
    alignRight,
    style: {
      "--menu-x": `${alignRight ? window.innerWidth - rect.right : rect.left}px`,
      "--menu-y": `${openUp ? window.innerHeight - rect.top : rect.bottom}px`,
    } as CSSProperties,
  };
}

export function EditingBarMenu({
  icon,
  currentLabel,
  menuLabel,
  options,
  onDismiss,
  tabIndex,
  onTriggerFocus,
}: EditingBarMenuProps) {
  const [placement, setPlacement] = useState<Placement | null>(null);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const triggerEl = () => wrapperRef.current?.querySelector("button") ?? null;
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const isOpen = placement !== null;

  function close() {
    setPlacement(null);
  }

  function items() {
    return Array.from(panelRef.current?.querySelectorAll<HTMLButtonElement>("[role=menuitemradio]") ?? []);
  }

  // Focus the active row (else the first) once the panel is mounted.
  useEffect(() => {
    if (!isOpen) return;
    const rows = items();
    (rows.find((row) => row.getAttribute("aria-checked") === "true") ?? rows[0])?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || wrapperRef.current?.contains(target)) return;
      close();
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [isOpen]);

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      event.stopPropagation();
      const el = triggerEl();
      if (el) setPlacement(measure(el));
    }
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const rows = items();
    const index = rows.indexOf(document.activeElement as HTMLButtonElement);
    let next: number | null = null;
    if (event.key === "ArrowDown") next = (index + 1) % rows.length;
    else if (event.key === "ArrowUp") next = (index - 1 + rows.length) % rows.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = rows.length - 1;
    else if (event.key === "Escape" || event.key === "Tab") {
      event.preventDefault();
      event.stopPropagation();
      close();
      onDismiss();
      return;
    }
    if (next === null) return;
    event.preventDefault();
    event.stopPropagation();
    rows[next]?.focus();
  }

  return (
    <span ref={wrapperRef} className="contents">
      <Button
        variant="transparent"
        icon={icon}
        trailingIcon="ChevronDown"
        aria-label={`${menuLabel}: ${currentLabel}`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? panelId : undefined}
        data-toolbar-item=""
        tabIndex={tabIndex}
        onFocus={onTriggerFocus}
        onKeyDown={handleTriggerKeyDown}
        onClick={() => {
          const el = triggerEl();
          if (isOpen) close();
          else if (el) setPlacement(measure(el));
        }}
      >
        {currentLabel}
      </Button>
      {placement &&
        createPortal(
          <div
            ref={panelRef}
            id={panelId}
            style={placement.style}
            onKeyDown={handleMenuKeyDown}
            className={cn(
              "fixed z-20 w-max min-w-48 max-w-[calc(100vw-2rem)]",
              placement.alignRight ? "right-[var(--menu-x)]" : "left-[var(--menu-x)]",
              placement.openUp ? "bottom-[var(--menu-y)] pb-stack-xs" : "top-[var(--menu-y)] pt-stack-xs",
            )}
          >
            <Dropdown role="menu" aria-label={menuLabel} className="shadow-sm">
              {options.map((option) => (
                <Button
                  key={option.id}
                  role="menuitemradio"
                  aria-checked={option.active}
                  variant="transparent"
                  align="left"
                  tabIndex={-1}
                  trailingIcon={option.active ? "Check" : undefined}
                  className={option.active ? "text-text-primary" : undefined}
                  onClick={() => {
                    close();
                    option.onSelect();
                  }}
                >
                  {option.label}
                </Button>
              ))}
            </Dropdown>
          </div>,
          document.body,
        )}
    </span>
  );
}
