"use client";

import { useEffect, useId } from "react";
import type { KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { useEditorState, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { cn } from "@/lib/ui/cn";
import { Button } from "@/components/atoms/Button";
import { Dropdown } from "@/components/atoms/Dropdown";
import { TABLE_COMMANDS } from "@/lib/notes/table-commands";
import { usePopoverPanel } from "./usePopoverPanel";

// design: Claude-designed on request (#330)
/**
 * Contextual table menu: a floating "Table" button anchored to the top-left
 * of the table the cursor is in (TipTap `BubbleMenu`, desktop pointers only;
 * mobile reaches the same TABLE_COMMANDS through the EditingBar in #333). It
 * opens a portalled `Dropdown` (`role="menu"`) with one row per command;
 * rows that do not apply are `aria-disabled`. Keyboard contract, Alt+F10 from
 * the document and the design rationale: design/notes/NoteEditor.md (#330).
 */
export interface TableMenuProps {
  editor: Editor | null;
}

function tableWrapperAt(editor: Editor): HTMLElement | null {
  const node = editor.view.domAtPos(editor.state.selection.from).node;
  const element = node instanceof Element ? node : node.parentElement;
  return element?.closest<HTMLElement>(".tableWrapper") ?? element?.closest<HTMLElement>("table") ?? null;
}

const TABLE_MENU_GAP = 16;

// Keeps the trigger clear of the in-flow desktop EditingBar: when the spot
// above the table would sit under the bar (table is the first block) it goes
// below the table, or just under the bar when the table's end is off-screen.
function triggerOffset(editor: Editor, floating: { width: number; height: number }) {
  const wrapper = tableWrapperAt(editor);
  const bar = document.querySelector("[data-editing-bar]");
  if (!wrapper || !bar) return TABLE_MENU_GAP;
  const table = wrapper.getBoundingClientRect();
  const barRect = bar.getBoundingClientRect();
  const top = table.top - TABLE_MENU_GAP - floating.height;
  const covered =
    top < barRect.bottom && top + floating.height > barRect.top && table.left < barRect.right && table.left + floating.width > barRect.left;
  if (!covered) return TABLE_MENU_GAP;
  if (table.bottom + TABLE_MENU_GAP + floating.height <= window.innerHeight) return -(table.height + TABLE_MENU_GAP + floating.height);
  return table.top - floating.height - (barRect.bottom + TABLE_MENU_GAP / 4);
}

export function TableMenu({ editor }: TableMenuProps) {
  const t = useTranslations("components.noteTable");
  const panelId = useId();
  const { placement, isOpen, open, close, wrapperRef, panelRef } = usePopoverPanel((panel) => {
    const rows = panel.querySelectorAll<HTMLButtonElement>("[role=menuitem]");
    (Array.from(rows).find((row) => row.getAttribute("aria-disabled") !== "true") ?? rows[0])?.focus();
  });

  // Re-evaluated on every transaction so a row's enabled state follows the selection.
  const enabled = useEditorState({
    editor,
    selector: ({ editor: current }) =>
      current ? TABLE_COMMANDS.filter((command) => command.isEnabled(current)).map((command) => command.id) : [],
  });

  useEffect(() => {
    if (!editor) return;
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (!editor || !event.altKey || event.key !== "F10" || !editor.isActive("table")) return;
      event.preventDefault();
      wrapperRef.current?.querySelector("button")?.focus();
    }
    const dom = editor.view.dom;
    dom.addEventListener("keydown", onKeyDown);
    return () => dom.removeEventListener("keydown", onKeyDown);
  }, [editor, wrapperRef]);

  if (!editor) return null;

  function rows() {
    return Array.from(panelRef.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]") ?? []);
  }

  function dismiss() {
    close();
    editor?.commands.focus();
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
    <BubbleMenu
      editor={editor}
      pluginKey="tableMenu"
      updateDelay={0}
      shouldShow={({ editor: current }) =>
        current.isEditable && current.isActive("table") && window.matchMedia("(pointer: fine)").matches
      }
      getReferencedVirtualElement={() => {
        const target = tableWrapperAt(editor);
        return target ? { getBoundingClientRect: () => target.getBoundingClientRect() } : null;
      }}
      options={{ placement: "top-start", offset: ({ rects }) => triggerOffset(editor, rects.floating), flip: true, shift: true }}
    >
      <span ref={wrapperRef} className="contents">
        <Button
          variant="white"
          icon="Table"
          trailingIcon="ChevronDown"
          aria-label={t("menuLabel")}
          aria-haspopup="menu"
          aria-expanded={isOpen}
          aria-controls={isOpen ? panelId : undefined}
          className="shadow-sm"
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              open();
            } else if (event.key === "Escape") {
              dismiss();
            }
          }}
          onClick={() => (isOpen ? close() : open())}
        >
          {t("menuLabel")}
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
              <Dropdown role="menu" aria-label={t("menuLabel")} className="shadow-sm">
                {TABLE_COMMANDS.map((command) => {
                  const isEnabled = enabled?.includes(command.id) ?? false;
                  return (
                    <Button
                      key={command.id}
                      role="menuitem"
                      variant="transparent"
                      align="left"
                      icon={command.icon}
                      tabIndex={-1}
                      aria-disabled={!isEnabled}
                      className={cn(command.destructive && "text-priority-urgent", "aria-disabled:cursor-not-allowed aria-disabled:opacity-40 aria-disabled:hover:bg-transparent aria-disabled:active:bg-transparent")}
                      onClick={() => {
                        if (!isEnabled) return;
                        close();
                        command.run(editor);
                      }}
                    >
                      {t(`commands.${command.id}`)}
                    </Button>
                  );
                })}
              </Dropdown>
            </div>,
            document.body,
          )}
      </span>
    </BubbleMenu>
  );
}
