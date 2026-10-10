"use client";

import { useId, useState } from "react";
import type { KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/ui/cn";
import { Button } from "@/components/atoms/Button";
import { Dropdown } from "@/components/atoms/Dropdown";
import { MAX_TABLE_SIZE } from "@/lib/notes/table-commands";
import { usePopoverPanel } from "./usePopoverPanel";

// design: Claude-designed on request (#330)
/**
 * EditingBar's "insert table" control: a `Button` trigger that opens a
 * portalled `Dropdown` panel holding a rows x columns grid (up to
 * MAX_TABLE_SIZE each). Hover or arrow keys choose the size, the live label
 * reads "3 x 4", click or Enter inserts. Roles, keyboard contract and why
 * this is not a new atom: design/notes/EditingBar.md (#330).
 */
export interface TableSizePickerProps {
  onInsert: (rows: number, cols: number) => void;
  /** Returns focus to the document (Escape, Tab, outside click). */
  onDismiss: () => void;
  tabIndex: number;
  onTriggerFocus: () => void;
}

const SIZES = Array.from({ length: MAX_TABLE_SIZE }, (_, index) => index + 1);
const DEFAULT_SIZE = { rows: 3, cols: 3 };

export function TableSizePicker({ onInsert, onDismiss, tabIndex, onTriggerFocus }: TableSizePickerProps) {
  const t = useTranslations("components.noteTable");
  const panelId = useId();
  const [size, setSize] = useState(DEFAULT_SIZE);
  const { placement, isOpen, open, close, wrapperRef, panelRef } = usePopoverPanel((panel) => {
    panel.querySelector<HTMLButtonElement>("[tabindex='0']")?.focus();
  });

  const sizeLabel = (rows: number, cols: number) => t("size", { rows, cols });

  function focusCell(rows: number, cols: number) {
    panelRef.current?.querySelector<HTMLButtonElement>(`[data-row='${rows}'][data-col='${cols}']`)?.focus();
  }

  function choose(rows: number, cols: number) {
    close();
    onInsert(rows, cols);
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      event.stopPropagation();
      setSize(DEFAULT_SIZE);
      open();
    }
  }

  function handleGridKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    let { rows, cols } = size;
    if (event.key === "ArrowDown") rows = Math.min(MAX_TABLE_SIZE, rows + 1);
    else if (event.key === "ArrowUp") rows = Math.max(1, rows - 1);
    else if (event.key === "ArrowRight") cols = Math.min(MAX_TABLE_SIZE, cols + 1);
    else if (event.key === "ArrowLeft") cols = Math.max(1, cols - 1);
    else if (event.key === "Home") cols = 1;
    else if (event.key === "End") cols = MAX_TABLE_SIZE;
    else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      event.stopPropagation();
      choose(size.rows, size.cols);
      return;
    } else if (event.key === "Escape" || event.key === "Tab") {
      event.preventDefault();
      event.stopPropagation();
      close();
      onDismiss();
      return;
    } else return;
    event.preventDefault();
    event.stopPropagation();
    setSize({ rows, cols });
    focusCell(rows, cols);
  }

  return (
    <span ref={wrapperRef} className="contents">
      <Button
        variant="transparent"
        icon="Table"
        aria-label={t("insertLabel")}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={isOpen ? panelId : undefined}
        data-toolbar-item=""
        tabIndex={tabIndex}
        onFocus={onTriggerFocus}
        onKeyDown={handleTriggerKeyDown}
        onClick={() => {
          if (isOpen) close();
          else {
            setSize(DEFAULT_SIZE);
            open();
          }
        }}
      />
      {placement &&
        createPortal(
          <div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-label={t("sizeLabel")}
            style={placement.style}
            className={cn(
              "fixed z-20 w-max max-w-[calc(100vw-2rem)]",
              placement.alignRight ? "right-[var(--menu-x)]" : "left-[var(--menu-x)]",
              placement.openUp ? "bottom-[var(--menu-y)] pb-stack-xs" : "top-[var(--menu-y)] pt-stack-xs",
            )}
          >
            <Dropdown className="shadow-sm">
              <div className="flex flex-col gap-stack-sm p-component-xs">
                <div
                  role="grid"
                  aria-label={t("sizeLabel")}
                  aria-rowcount={MAX_TABLE_SIZE}
                  aria-colcount={MAX_TABLE_SIZE}
                  onKeyDown={handleGridKeyDown}
                  className="flex flex-col gap-inline-xs"
                >
                  {SIZES.map((rows) => (
                    <div key={rows} role="row" className="flex gap-inline-xs">
                      {SIZES.map((cols) => {
                        const inRange = rows <= size.rows && cols <= size.cols;
                        const isActive = rows === size.rows && cols === size.cols;
                        return (
                          <button
                            key={cols}
                            type="button"
                            role="gridcell"
                            data-row={rows}
                            data-col={cols}
                            aria-label={sizeLabel(rows, cols)}
                            aria-selected={inRange}
                            tabIndex={isActive ? 0 : -1}
                            onPointerEnter={(event) => {
                              if (event.pointerType === "touch") return;
                              setSize({ rows, cols });
                              focusCell(rows, cols);
                            }}
                            onClick={() => choose(rows, cols)}
                            className={cn(
                              "chrome-touch size-6 rounded-card-inner border border-stroke-primary bg-surface-highlight-white focus:border-stroke-secondary-active",
                              inRange && "border-stroke-primary-hover bg-surface-secondary",
                            )}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
                <p role="status" className="text-center text-base font-semibold text-text-primary">
                  {sizeLabel(size.rows, size.cols)}
                </p>
              </div>
            </Dropdown>
          </div>,
          document.body,
        )}
    </span>
  );
}
