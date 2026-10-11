"use client";

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { useEditorState, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { TextSelection } from "@tiptap/pm/state";
import { Button } from "@/components/atoms/Button";
import type { IconName } from "@/components/atoms/Icon";
import { requestLinkPopover } from "@/lib/notes/link-popover";
import { BLOCK_TYPE_MENU } from "./EditingBar";
import { EditingBarMenu } from "./EditingBarMenu";

// design: Claude-designed on request (#331)
/**
 * Selection bubble menu of the notes editor: inline marks, link and "Turn
 * into" (the EditingBar's own block-type options) above a non-empty text
 * selection. Desktop pointers only; hidden in code blocks and while the table
 * menu shows. Keyboard contract and rationale: design/notes/NoteEditor.md (#331).
 */
export interface NoteBubbleMenuProps {
  editor: Editor | null;
}

interface MarkDef {
  id: "bold" | "italic" | "underline" | "strikethrough" | "highlight" | "code";
  mark: string;
  icon: IconName;
  toggle: (editor: Editor) => void;
}

const MARKS: MarkDef[] = [
  { id: "bold", mark: "bold", icon: "Bold", toggle: (e) => e.chain().focus().toggleBold().run() },
  { id: "italic", mark: "italic", icon: "Italic", toggle: (e) => e.chain().focus().toggleItalic().run() },
  { id: "underline", mark: "underline", icon: "Underline", toggle: (e) => e.chain().focus().toggleUnderline().run() },
  { id: "strikethrough", mark: "strike", icon: "Strikethrough", toggle: (e) => e.chain().focus().toggleStrike().run() },
  { id: "highlight", mark: "highlight", icon: "Highlighter", toggle: (e) => e.chain().focus().toggleHighlight().run() },
  { id: "code", mark: "code", icon: "CodeXml", toggle: (e) => e.chain().focus().toggleCode().run() },
];

// Marks, link, then the "Turn into" menu: the toolbar's roving-focus order.
const ITEM_COUNT = MARKS.length + 2;

function shouldShowBubble(editor: Editor): boolean {
  const { selection, doc } = editor.state;
  return (
    editor.isEditable &&
    selection instanceof TextSelection &&
    !selection.empty &&
    doc.textBetween(selection.from, selection.to).trim().length > 0 &&
    !editor.isActive("codeBlock") &&
    !editor.isActive("table") &&
    window.matchMedia("(pointer: fine)").matches
  );
}

export function NoteBubbleMenu({ editor }: NoteBubbleMenuProps) {
  const t = useTranslations("components.editingBar");
  const tBubble = useTranslations("components.noteBubbleMenu");
  const barRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => {
      if (!current) return null;
      return {
        marks: MARKS.map((def) => current.isActive(def.mark)),
        link: current.isActive("link"),
        blockType: BLOCK_TYPE_MENU.options.find((option) => option.isActive(current))?.id ?? "paragraph",
      };
    },
  });

  // Alt+F10 in the document moves focus into the menu while it shows.
  useEffect(() => {
    if (!editor) return;
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (!editor || !event.altKey || event.key !== "F10" || !shouldShowBubble(editor)) return;
      const first = barRef.current?.querySelector<HTMLElement>("[data-toolbar-item]");
      if (!first || first.offsetParent === null) return;
      event.preventDefault();
      first.focus();
    }
    const dom = editor.view.dom;
    dom.addEventListener("keydown", onKeyDown);
    return () => dom.removeEventListener("keydown", onKeyDown);
  }, [editor]);

  if (!editor) return null;

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    let next: number | null = null;
    if (event.key === "ArrowRight") next = (activeIndex + 1) % ITEM_COUNT;
    else if (event.key === "ArrowLeft") next = (activeIndex - 1 + ITEM_COUNT) % ITEM_COUNT;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = ITEM_COUNT - 1;
    else if (event.key === "Escape") {
      event.preventDefault();
      editor?.commands.focus();
      return;
    }
    if (next === null) return;
    event.preventDefault();
    setActiveIndex(next);
    barRef.current?.querySelectorAll<HTMLElement>("[data-toolbar-item]")[next]?.focus();
  }

  const blockType = BLOCK_TYPE_MENU.options.find((option) => option.id === state?.blockType);

  return (
    <BubbleMenu
      editor={editor}
      pluginKey="selectionBubbleMenu"
      updateDelay={150}
      shouldShow={({ editor: current }) => shouldShowBubble(current)}
      options={{ placement: "top", offset: 8, flip: true, shift: true }}
    >
      <div
        ref={barRef}
        role="toolbar"
        aria-label={tBubble("label")}
        aria-orientation="horizontal"
        onKeyDown={handleKeyDown}
        className="flex items-center gap-inline-xs rounded-control-outer border border-stroke-primary bg-surface-highlight-white p-component-xs shadow-sm"
      >
        {MARKS.map((def, index) => (
          <Button
            key={def.id}
            variant="transparent"
            icon={def.icon}
            data-toolbar-item=""
            aria-label={t(`${def.id}Label`)}
            aria-pressed={Boolean(state?.marks[index])}
            tabIndex={index === activeIndex ? 0 : -1}
            onFocus={() => setActiveIndex(index)}
            onClick={() => def.toggle(editor)}
          />
        ))}
        <Button
          variant="transparent"
          icon="Link"
          data-toolbar-item=""
          aria-label={t("linkLabel")}
          aria-pressed={Boolean(state?.link)}
          tabIndex={MARKS.length === activeIndex ? 0 : -1}
          onFocus={() => setActiveIndex(MARKS.length)}
          onClick={(event) => requestLinkPopover(editor, event.currentTarget)}
        />
        <EditingBarMenu
          icon={BLOCK_TYPE_MENU.icon}
          menuLabel={tBubble("turnInto")}
          currentLabel={t(`options.${blockType?.id ?? "paragraph"}`)}
          options={BLOCK_TYPE_MENU.options.map((option) => ({
            id: option.id,
            icon: option.icon,
            label: t(`options.${option.id}`),
            active: option.id === state?.blockType,
            onSelect: () => option.run(editor),
          }))}
          onDismiss={() => editor.commands.focus()}
          tabIndex={MARKS.length + 1 === activeIndex ? 0 : -1}
          onTriggerFocus={() => setActiveIndex(MARKS.length + 1)}
        />
      </div>
    </BubbleMenu>
  );
}
