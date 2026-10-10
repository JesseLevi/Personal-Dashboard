"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import type { KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import type { Editor } from "@tiptap/react";
import { DragHandle } from "@tiptap/extension-drag-handle-react";
import type { Node as PMNode } from "@tiptap/pm/model";
import { cn } from "@/lib/ui/cn";
import { Button } from "@/components/atoms/Button";
import { Dropdown } from "@/components/atoms/Dropdown";
import {
  blockTypeId,
  canMoveBlock,
  deleteBlock,
  duplicateBlock,
  isConvertibleBlock,
  moveBlock,
  selectBlockStart,
  topLevelBlockAt,
} from "@/lib/notes/block-commands";
import { SLASH_ITEMS } from "@/lib/notes/slash-items";
import { BLOCK_TYPE_MENU, LIST_MENU } from "./EditingBar";
import { measure, type Placement } from "./EditingBarMenu";

// design: Claude-designed on request (#335)
/**
 * Drag handle in the left gutter of the hovered top-level block, plus the
 * block menu it opens (Turn into, Duplicate, Delete, Move up/down). Desktop
 * pointers only. The handle floats outside the text column, so it never
 * shifts the reading width. The menu is the EditingBarMenu panel pattern:
 * portalled `Dropdown role="menu"` of transparent `Button` rows. Rationale and
 * keyboard contract: design/notes/NoteEditor.md (#335).
 */
export interface NoteBlockHandleProps {
  editor: Editor | null;
}

// "Turn into" reuses #329's block-type and list options; quote and code come
// from the slash list. Labels are the slash menu's.
const TURN_INTO_IDS = [
  "paragraph",
  "heading1",
  "heading2",
  "heading3",
  "bulletList",
  "orderedList",
  "taskList",
  "blockquote",
  "codeBlock",
] as const;

const TURN_INTO_RUNNERS = new Map<string, (editor: Editor) => void>([
  ...BLOCK_TYPE_MENU.options.map((option): [string, (editor: Editor) => void] => [option.id, option.run]),
  ...LIST_MENU.options.map((option): [string, (editor: Editor) => void] => [option.id, option.run]),
  ...SLASH_ITEMS.filter((item) => item.run && ["blockquote", "codeBlock"].includes(item.id)).map(
    (item): [string, (editor: Editor) => void] => [item.id, item.run!],
  ),
]);

const FINE_POINTER = "(pointer: fine)";

function subscribeFinePointer(callback: () => void) {
  const query = window.matchMedia(FINE_POINTER);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

interface Target {
  pos: number;
  node: PMNode;
}

export function NoteBlockHandle({ editor }: NoteBlockHandleProps) {
  const t = useTranslations("components.noteBlockMenu");
  const tItems = useTranslations("components.slashMenu.items");
  const finePointer = useSyncExternalStore(
    subscribeFinePointer,
    () => window.matchMedia(FINE_POINTER).matches,
    () => false,
  );
  const hovered = useRef<Target | null>(null);
  const [target, setTarget] = useState<Target | null>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const handleRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const isOpen = placement !== null && target !== null;

  function close() {
    setPlacement(null);
  }

  function rows() {
    return Array.from(panelRef.current?.querySelectorAll<HTMLButtonElement>("[role^=menuitem]:not(:disabled)") ?? []);
  }

  useEffect(() => {
    if (!isOpen) return;
    const list = rows();
    (list.find((row) => row.getAttribute("aria-checked") === "true") ?? list[0])?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function onPointerDown(event: PointerEvent) {
      const node = event.target as Node;
      if (panelRef.current?.contains(node) || handleRef.current?.contains(node)) return;
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

  // Keeps the handle visible while its menu is open (the plugin reads this meta key).
  useEffect(() => {
    if (!editor || editor.isDestroyed || !finePointer) return;
    editor.view.dispatch(editor.state.tr.setMeta("lockDragHandle", isOpen));
  }, [editor, finePointer, isOpen]);

  if (!editor || !finePointer) return null;

  function openMenu() {
    const trigger = handleRef.current?.querySelector("button");
    const current = hovered.current;
    if (!trigger || !current) return;
    if (isOpen) {
      close();
      return;
    }
    setTarget(current);
    setPlacement(measure(trigger));
  }

  function dismiss() {
    close();
    editor?.commands.focus();
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const list = rows();
    const index = list.indexOf(document.activeElement as HTMLButtonElement);
    let next: number | null = null;
    if (event.key === "ArrowDown") next = (index + 1) % list.length;
    else if (event.key === "ArrowUp") next = (index - 1 + list.length) % list.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = list.length - 1;
    else if (event.key === "Escape" || event.key === "Tab") {
      event.preventDefault();
      event.stopPropagation();
      dismiss();
      return;
    }
    if (next === null) return;
    event.preventDefault();
    event.stopPropagation();
    list[next]?.focus();
  }

  // The node may have moved since the menu opened; resolve it fresh.
  const current = target && editor ? topLevelBlockAt(editor.state.doc, target.pos) : null;
  const activeType = current ? blockTypeId(current.node) : null;

  function act(run: () => void) {
    close();
    run();
    editor?.commands.focus();
  }

  const rowClass = "text-text-primary";

  return (
    <>
      <DragHandle
        editor={editor}
        className="pr-inline-xs"
        onNodeChange={({ node, pos }) => {
          hovered.current = node ? { node, pos } : hovered.current;
        }}
      >
        <span ref={handleRef} className="contents">
          <Button
            variant="transparent"
            icon="EllipsisVertical"
            aria-label={t("handleLabel")}
            aria-haspopup="menu"
            aria-expanded={isOpen}
            aria-controls={isOpen ? panelId : undefined}
            className="cursor-grab active:cursor-grabbing"
            onClick={openMenu}
          />
        </span>
      </DragHandle>
      {isOpen &&
        current &&
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
            <Dropdown role="menu" aria-label={t("menuLabel")} className="max-h-[70vh] overflow-y-auto shadow-sm">
              {isConvertibleBlock(current.node) && (
                <div role="group" aria-labelledby={`${panelId}-turn-into`} className="flex flex-col">
                  <span id={`${panelId}-turn-into`} className="px-component-md py-component-xs text-base font-semibold text-text-secondary">
                    {t("turnInto")}
                  </span>
                  {TURN_INTO_IDS.map((id) => (
                    <Button
                      key={id}
                      role="menuitemradio"
                      aria-checked={id === activeType}
                      variant="transparent"
                      align="left"
                      tabIndex={-1}
                      trailingIcon={id === activeType ? "Check" : undefined}
                      className={rowClass}
                      onClick={() =>
                        act(() => {
                          if (id === activeType) return;
                          selectBlockStart(editor, current.from);
                          TURN_INTO_RUNNERS.get(id)?.(editor);
                        })
                      }
                    >
                      {tItems(id)}
                    </Button>
                  ))}
                </div>
              )}
              {isConvertibleBlock(current.node) && <div role="separator" className="border-t border-stroke-lines" />}
              <Button
                role="menuitem"
                variant="transparent"
                align="left"
                tabIndex={-1}
                className={rowClass}
                onClick={() => act(() => duplicateBlock(editor, current.from))}
              >
                {t("duplicate")}
              </Button>
              <Button
                role="menuitem"
                variant="transparent"
                align="left"
                tabIndex={-1}
                disabled={!canMoveBlock(editor, "up", current.from)}
                className={rowClass}
                onClick={() => act(() => moveBlock(editor, "up", current.from))}
              >
                {t("moveUp")}
              </Button>
              <Button
                role="menuitem"
                variant="transparent"
                align="left"
                tabIndex={-1}
                disabled={!canMoveBlock(editor, "down", current.from)}
                className={rowClass}
                onClick={() => act(() => moveBlock(editor, "down", current.from))}
              >
                {t("moveDown")}
              </Button>
              <Button
                role="menuitem"
                variant="transparent"
                align="left"
                tabIndex={-1}
                icon="Trash"
                className="text-text-highlight-red"
                onClick={() => act(() => deleteBlock(editor, current.from))}
              >
                {t("delete")}
              </Button>
            </Dropdown>
          </div>,
          document.body,
        )}
    </>
  );
}
