"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
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
  moveBlockToIndex,
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

const DRAG_THRESHOLD = 4;

/**
 * Press-and-slide a top-level block: the handle follows the pointer on the
 * vertical axis only, the block moves with it at reduced opacity and the
 * blocks it passes slide aside to open its new place (the Te-Doen board's
 * drag feel). Releasing commits one `moveBlockToIndex`; Escape cancels.
 */
function slideBlock(editor: Editor, pos: number, handle: HTMLElement, startY: number, onDragged: () => void) {
  const view = editor.view;
  const block = topLevelBlockAt(view.state.doc, pos);
  if (!block) return;
  const doc = view.state.doc;
  const els: HTMLElement[] = [];
  let at = 0;
  for (let i = 0; i < doc.childCount; i += 1) {
    const dom = view.nodeDOM(at);
    if (!(dom instanceof HTMLElement)) return;
    els.push(dom);
    at += doc.child(i).nodeSize;
  }
  const from = block.index;
  const rects = els.map((el) => el.getBoundingClientRect());
  const size = rects[from].height;
  const neighbour = from < els.length - 1 ? rects[from + 1].top - rects[from].bottom : from > 0 ? rects[from].top - rects[from - 1].bottom : 0;
  const shift = size + neighbour;
  const minDy = rects[0].top - rects[from].top;
  const maxDy = rects[els.length - 1].bottom - rects[from].bottom;
  let active = false;
  let target = from;
  let dy = 0;

  function apply() {
    els.forEach((el, i) => {
      if (i === from) {
        el.style.transform = `translateY(${dy}px)`;
        return;
      }
      const offset = i > from && i <= target ? -shift : i < from && i >= target ? shift : 0;
      el.style.transform = offset ? `translateY(${offset}px)` : "";
    });
    handle.style.transform = `translateY(${dy}px)`;
  }

  function start() {
    active = true;
    onDragged();
    editor.view.dispatch(editor.state.tr.setMeta("lockDragHandle", true));
    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
    els.forEach((el, i) => {
      el.style.willChange = "transform";
      if (i === from) {
        el.style.position = "relative";
        el.style.zIndex = "5";
        el.style.opacity = "0.4";
        el.style.pointerEvents = "none";
      } else {
        el.style.transition = "transform var(--duration-base) var(--ease-base)";
      }
    });
  }

  function onMove(event: PointerEvent) {
    const raw = event.clientY - startY;
    if (!active) {
      if (Math.abs(raw) < DRAG_THRESHOLD) return;
      start();
    }
    dy = Math.min(Math.max(raw, minDy), maxDy);
    const center = rects[from].top + dy + size / 2;
    let next = 0;
    rects.forEach((rect, i) => {
      if (i !== from && rect.top + rect.height / 2 < center) next += 1;
    });
    target = next;
    apply();
  }

  function cleanup() {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onCancel);
    window.removeEventListener("keydown", onKey, true);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    els.forEach((el) => {
      el.style.transform = "";
      el.style.transition = "";
      el.style.willChange = "";
      el.style.position = "";
      el.style.zIndex = "";
      el.style.opacity = "";
      el.style.pointerEvents = "";
    });
    handle.style.transform = "";
    if (active && !editor.isDestroyed) editor.view.dispatch(editor.state.tr.setMeta("lockDragHandle", false));
  }

  function onUp() {
    const commit = active && target !== from;
    cleanup();
    if (!commit) return;
    moveBlockToIndex(editor, target, block!.from);
    editor.commands.focus();
  }
  function onCancel() {
    cleanup();
  }
  function onKey(event: globalThis.KeyboardEvent) {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    cleanup();
  }

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onCancel);
  window.addEventListener("keydown", onKey, true);
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
  const suppressClick = useRef(false);
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

  // The handle is a vertical slider, not a free native drag: the browser's drag
  // image would follow the pointer anywhere. Native drag is cancelled and the
  // block is moved with pointer events instead (see slideBlock below).
  useEffect(() => {
    if (!editor || editor.isDestroyed || !finePointer) return;
    function cancelNativeDrag(event: DragEvent) {
      const handle = handleRef.current?.parentElement;
      if (handle && event.target instanceof Node && handle.contains(event.target)) {
        event.preventDefault();
        event.stopPropagation();
      }
    }
    document.addEventListener("dragstart", cancelNativeDrag, true);
    return () => document.removeEventListener("dragstart", cancelNativeDrag, true);
  }, [editor, finePointer]);

  function onHandlePointerDown(event: ReactPointerEvent<HTMLElement>) {
    const current = hovered.current;
    const button = (event.target as Element).closest("button");
    if (!editor || event.button !== 0 || !button || !current) return;
    if (isOpen) return;
    slideBlock(editor, current.pos, button, event.clientY, () => {
      suppressClick.current = true;
    });
  }

  if (!editor || !finePointer) return null;

  function openMenu() {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
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
        computePositionConfig={{ placement: "left", strategy: "absolute" }}
        onNodeChange={({ node, pos }) => {
          hovered.current = node ? { node, pos } : hovered.current;
        }}
      >
        <span ref={handleRef} className="contents" onPointerDown={onHandlePointerDown}>
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
            <Dropdown role="menu" aria-label={t("menuLabel")} className="max-h-[calc(100vh-var(--menu-y)-1rem)] overflow-y-auto shadow-sm">
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
