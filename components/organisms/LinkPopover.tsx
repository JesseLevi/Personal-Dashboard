"use client";

import { useEffect, useId, useReducer, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import type { Editor } from "@tiptap/react";
import { cn } from "@/lib/ui/cn";
import { Button } from "@/components/atoms/Button";
import { Dropdown } from "@/components/atoms/Dropdown";
import { InputField } from "@/components/atoms/InputField";
import { normalizeLinkUrl } from "@/lib/notes/link-url";
import { OPEN_LINK_POPOVER_EVENT, type OpenLinkPopoverDetail } from "@/lib/notes/link-popover";
import { measure } from "./EditingBarMenu";

// design: Claude-designed on request (#331)
/**
 * The one link popover of the notes editor: URL field with apply/remove, or,
 * on an existing link, the URL with open (new tab), edit and remove. Opened by
 * `requestLinkPopover` (bubble menu, EditingBar) and by Mod-K in the document;
 * anchored to the element that asked (the EditingBar button, or the whole bar
 * on mobile) or to the selection. Escape closes and returns focus to the
 * editor. Contract and rationale: design/notes/NoteEditor.md (#331).
 */
export interface LinkPopoverProps {
  editor: Editor | null;
}

type Rect = Pick<DOMRect, "left" | "right" | "top" | "bottom">;

interface Session {
  anchor: HTMLElement | null;
  rect: Rect;
  /** The href under the cursor, when it is on a link. */
  href: string | null;
  editing: boolean;
  draft: string;
  invalid: boolean;
}

function selectionRect(editor: Editor): Rect {
  const { from, to } = editor.state.selection;
  const start = editor.view.coordsAtPos(from);
  const end = editor.view.coordsAtPos(to);
  return {
    left: Math.min(start.left, end.left),
    right: Math.max(start.right, end.right),
    top: Math.min(start.top, end.top),
    bottom: Math.max(start.bottom, end.bottom),
  };
}

export function LinkPopover({ editor }: LinkPopoverProps) {
  const t = useTranslations("components.noteLink");
  const [session, setSession] = useState<Session | null>(null);
  const [, remeasure] = useReducer((count: number) => count + 1, 0);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputId = useId();
  const errorId = useId();
  const isOpen = session !== null;
  const editing = session?.editing ?? false;

  function close(returnFocus = true) {
    setSession(null);
    if (returnFocus) editor?.commands.focus();
  }

  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom;
    function open(anchor: HTMLElement | null) {
      if (!editor || !editor.isEditable) return;
      const href: string | null = editor.isActive("link")
        ? ((editor.getAttributes("link").href as string | undefined) ?? null)
        : null;
      setSession({
        anchor,
        rect: selectionRect(editor),
        href,
        editing: href === null,
        draft: href ?? "",
        invalid: false,
      });
    }
    function onRequest(event: Event) {
      open((event as CustomEvent<OpenLinkPopoverDetail>).detail.anchor);
    }
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.shiftKey || event.altKey || event.key.toLowerCase() !== "k") return;
      event.preventDefault();
      open(null);
    }
    dom.addEventListener(OPEN_LINK_POPOVER_EVENT, onRequest);
    dom.addEventListener("keydown", onKeyDown);
    return () => {
      dom.removeEventListener(OPEN_LINK_POPOVER_EVENT, onRequest);
      dom.removeEventListener("keydown", onKeyDown);
    };
  }, [editor]);

  // Focus the field when editing, else the first action, once the panel is mounted.
  useEffect(() => {
    if (!isOpen) return;
    const panel = panelRef.current;
    (panel?.querySelector<HTMLElement>("input") ?? panel?.querySelector<HTMLElement>("button"))?.focus();
  }, [isOpen, editing]);

  useEffect(() => {
    if (!isOpen) return;
    function onPointerDown(event: PointerEvent) {
      if (!panelRef.current?.contains(event.target as Node)) setSession(null);
    }
    function onScroll(event: Event) {
      if (panelRef.current?.contains(event.target as Node)) return;
      remeasure();
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("resize", remeasure);
    window.addEventListener("scroll", onScroll, true);
    // The software keyboard resizes only the visual viewport and lifts the bar.
    window.visualViewport?.addEventListener("resize", remeasure);
    window.visualViewport?.addEventListener("scroll", remeasure);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("resize", remeasure);
      window.removeEventListener("scroll", onScroll, true);
      window.visualViewport?.removeEventListener("resize", remeasure);
      window.visualViewport?.removeEventListener("scroll", remeasure);
    };
  }, [isOpen]);

  if (!editor || !session) return null;
  const current = session;

  function apply(event: FormEvent) {
    event.preventDefault();
    const href = normalizeLinkUrl(current.draft);
    if (!href || !editor) {
      setSession({ ...current, invalid: true });
      return;
    }
    const chain = editor.chain().focus();
    if (editor.isActive("link")) chain.extendMarkRange("link").setLink({ href }).run();
    else if (editor.state.selection.empty) {
      chain.insertContent({ type: "text", text: href, marks: [{ type: "link", attrs: { href } }] }).run();
    } else chain.setLink({ href }).run();
    setSession(null);
  }

  function remove() {
    editor?.chain().focus().extendMarkRange("link").unsetLink().run();
    setSession(null);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === "Tab") {
      const focusable = Array.from(panelRef.current?.querySelectorAll<HTMLElement>("input, button") ?? []);
      const index = focusable.indexOf(document.activeElement as HTMLElement);
      const next = focusable[(index + (event.shiftKey ? -1 : 1) + focusable.length) % focusable.length];
      event.preventDefault();
      next?.focus();
    }
  }

  const placement = measure({ getBoundingClientRect: () => current.anchor?.getBoundingClientRect() ?? current.rect });

  return createPortal(
    <div
      ref={panelRef}
      style={placement.style}
      onKeyDown={handleKeyDown}
      className={cn(
        "fixed z-20 w-[28rem] max-w-[calc(100vw-2rem)]",
        placement.alignRight ? "right-[var(--menu-x)]" : "left-[var(--menu-x)]",
        placement.openUp ? "bottom-[var(--menu-y)] pb-stack-xs" : "top-[var(--menu-y)] pt-stack-xs",
      )}
    >
      <Dropdown role="dialog" aria-label={t("label")} className="shadow-sm">
        {current.editing ? (
          <form onSubmit={apply} className="flex flex-col gap-stack-sm">
            <InputField
              id={inputId}
              type="text"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="off"
              leadingIcon="Link"
              label={t("urlLabel")}
              placeholder={t("urlPlaceholder")}
              value={current.draft}
              aria-invalid={current.invalid}
              aria-describedby={current.invalid ? errorId : undefined}
              onChange={(event) => setSession({ ...current, draft: event.target.value, invalid: false })}
            />
            {current.invalid && (
              <p id={errorId} role="alert" className="text-base font-semibold text-priority-urgent">
                {t("invalid")}
              </p>
            )}
            <div className="flex flex-row justify-end gap-inline-xs">
              {current.href !== null && (
                <Button variant="transparent" icon="Trash" onClick={remove}>
                  {t("remove")}
                </Button>
              )}
              <Button type="submit" variant="filled" icon="Check">
                {t("apply")}
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col gap-stack-sm">
            <p className="truncate px-component-sm pt-component-sm text-base font-semibold text-text-primary" title={current.href ?? undefined}>
              {current.href}
            </p>
            <div className="flex flex-row flex-wrap gap-inline-xs">
              <Button
                variant="transparent"
                icon="Link"
                onClick={() => {
                  if (current.href) window.open(current.href, "_blank", "noopener,noreferrer");
                  close();
                }}
              >
                {t("open")}
              </Button>
              <Button variant="transparent" icon="Pencil" onClick={() => setSession({ ...current, editing: true })}>
                {t("edit")}
              </Button>
              <Button variant="transparent" icon="Trash" onClick={remove}>
                {t("remove")}
              </Button>
            </div>
          </div>
        )}
      </Dropdown>
    </div>,
    document.body,
  );
}
