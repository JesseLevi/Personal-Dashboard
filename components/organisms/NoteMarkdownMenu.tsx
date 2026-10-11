"use client";

import { useId } from "react";
import type { KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/ui/cn";
import { Button } from "@/components/atoms/Button";
import { Dropdown } from "@/components/atoms/Dropdown";
import { usePopoverPanel } from "./usePopoverPanel";

// design: Claude-designed on request (#337)
/**
 * Note menu: an Ellipsis button opening a portalled `Dropdown`
 * (`role="menu"`) with "Copy as Markdown", "Export as .md" and, after a
 * separator, the destructive Delete row (#386).
 * Same panel mechanics as TableMenu (usePopoverPanel): arrows/Home/End move,
 * Escape/Tab close and focus returns to the trigger. Record:
 * design/notes/NoteEditor.md (#337).
 */
export interface NoteMarkdownMenuProps {
  onCopy: () => void;
  onExport: () => void;
  /** Starts the note's inline delete confirmation (the caller owns the two-step flow). */
  onDelete: () => void;
  disabled?: boolean;
}

export function NoteMarkdownMenu({ onCopy, onExport, onDelete, disabled }: NoteMarkdownMenuProps) {
  const t = useTranslations("components.noteMarkdownMenu");
  const panelId = useId();
  const { placement, isOpen, open, close, wrapperRef, panelRef } = usePopoverPanel((panel) => {
    panel.querySelector<HTMLButtonElement>("[role=menuitem]")?.focus();
  });

  function rows() {
    return Array.from(panelRef.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]") ?? []);
  }

  function dismiss() {
    close();
    wrapperRef.current?.querySelector("button")?.focus();
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

  function run(action: () => void) {
    dismiss();
    action();
  }

  return (
    <span ref={wrapperRef} className="contents">
      <Button
        icon="Ellipsis"
        aria-label={t("menuLabel")}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? panelId : undefined}
        disabled={disabled}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            open();
          } else if (event.key === "Escape" && isOpen) {
            dismiss();
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
              "fixed z-20 w-max min-w-48 max-w-[calc(100vw-2rem)]",
              placement.alignRight ? "right-[var(--menu-x)]" : "left-[var(--menu-x)]",
              placement.openUp ? "bottom-[var(--menu-y)] pb-stack-xs" : "top-[var(--menu-y)] pt-stack-xs",
            )}
          >
            <Dropdown role="menu" aria-label={t("menuLabel")} className="shadow-sm">
              <Button role="menuitem" variant="transparent" align="left" icon="Copy" tabIndex={-1} onClick={() => run(onCopy)}>
                {t("copy")}
              </Button>
              <Button role="menuitem" variant="transparent" align="left" icon="Download" tabIndex={-1} onClick={() => run(onExport)}>
                {t("export")}
              </Button>
              <div role="separator" className="-mx-component-xs h-px w-auto shrink-0 bg-stroke-lines" />
              <Button
                role="menuitem"
                variant="transparent"
                align="left"
                icon="Trash"
                tabIndex={-1}
                className="text-priority-urgent"
                onClick={() => run(onDelete)}
              >
                {t("delete")}
              </Button>
            </Dropdown>
          </div>,
          document.body,
        )}
    </span>
  );
}
