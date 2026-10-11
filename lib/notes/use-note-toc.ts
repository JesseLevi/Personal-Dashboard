"use client";

import { useCallback, useEffect, useState } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import { pickActiveId, type TocItem } from "./toc";

// #342: the open note's table of contents. Items come from the TableOfContents
// extension's storage (lib/notes/extensions.ts); the active heading is tracked
// here from the window scroll position. Rationale: design/notes/NoteEditor.md (#342).

/** A heading counts as reached once it is within the top quarter of the viewport. */
const ACTIVE_VIEWPORT_FRACTION = 0.25;

function sameItems(a: TocItem[] | null, b: TocItem[] | null): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  return a.every((item, i) => item.id === b[i].id && item.level === b[i].level && item.text === b[i].text);
}

function headingElement(editor: Editor, id: string): HTMLElement | null {
  return editor.view.dom.querySelector<HTMLElement>(`[id="${CSS.escape(id)}"]`);
}

const NO_ITEMS: TocItem[] = [];

export function useNoteToc(editor: Editor | null) {
  const items =
    useEditorState({
      editor,
      selector: ({ editor: current }): TocItem[] =>
        (current?.storage.tableOfContents?.content ?? [])
          .filter((entry: { id?: string | null }) => Boolean(entry.id))
          .map((entry: { id: string; originalLevel: number; textContent: string }) => ({
            id: entry.id,
            level: entry.originalLevel,
            text: entry.textContent,
          })),
      equalityFn: sameItems,
    }) ?? NO_ITEMS;

  const [scrolledId, setScrolledId] = useState<string | null>(null);
  const [clickedId, setClickedId] = useState<string | null>(null);

  useEffect(() => {
    if (!editor || items.length === 0) return;
    let frame = 0;
    function update() {
      frame = 0;
      if (!editor || editor.isDestroyed) return;
      const tops = items.flatMap((item) => {
        const element = headingElement(editor, item.id);
        return element ? [{ id: item.id, top: element.getBoundingClientRect().top }] : [];
      });
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      setScrolledId(pickActiveId(tops, window.innerHeight * ACTIVE_VIEWPORT_FRACTION, atBottom && window.scrollY > 0));
    }
    function schedule() {
      if (!frame) frame = requestAnimationFrame(update);
    }
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [editor, items]);

  // A click selects its item at once; the next scroll hands control back to the scroll position.
  useEffect(() => {
    if (!clickedId) return;
    const clear = () => setClickedId(null);
    const timer = setTimeout(() => window.addEventListener("scroll", clear, { once: true, passive: true }), 800);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", clear);
    };
  }, [clickedId]);

  const select = useCallback(
    (id: string) => {
      if (!editor || editor.isDestroyed) return;
      let position: number | null = null;
      editor.state.doc.descendants((node, pos) => {
        if (position !== null) return false;
        if (node.type.name === "heading" && node.attrs.id === id) position = pos;
        return position === null;
      });
      if (position === null) return;
      // The caret goes into the heading (keyboard users continue from there); scrolling is ours.
      editor.commands.focus(position + 1, { scrollIntoView: false });
      const element = headingElement(editor, id);
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      element?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      setClickedId(id);
    },
    [editor],
  );

  const activeId = clickedId && items.some((item) => item.id === clickedId) ? clickedId : scrolledId;
  return { items, activeId, select };
}
