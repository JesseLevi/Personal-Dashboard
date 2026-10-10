"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { useEditorState, type Editor } from "@tiptap/react";
import { cn } from "@/lib/ui/cn";
import { Button } from "@/components/atoms/Button";
import type { IconName } from "@/components/atoms/Icon";
import { EditingBarMenu } from "./EditingBarMenu";

// figma: node-id=3978:14138
// design: Claude-designed on request (#329) for the two menu buttons; the rest is Figma.
/**
 * Organism/EditingBar — Figma "EditingBar" (desktop 3978:14138, mobile
 * 3978:14870, detached frames — docs/open-questions.md#notes-editingbar-
 * detached-from-components). Twenty icon-only `Button variant="transparent"`
 * instances (fills=[] on every measured Default node — the only variant
 * whose own Default has no background) in five groups of 2/6/6/2/4,
 * separated by `bg-stroke-lines` dividers. Full command mapping, every
 * measurement and every deviation: design/notes/EditingBar.md. Heading and
 * list are menu buttons (EditingBarMenu), not toggles (#329).
 */
export interface EditingBarProps {
  editor: Editor | null;
  className?: string;
}

interface EditingBarCommand {
  id: string;
  icon: IconName;
  isActive?: (editor: Editor) => boolean;
  run: (editor: Editor, ctx: { promptLinkUrl: () => string | null }) => void;
}

// #329: block type and list type are menu buttons, not toggles. Each option
// has an i18n key under components.editingBar and reads/writes the document
// through the same editor commands the markdown input rules use.
interface EditingBarMenuDef {
  id: "blockType" | "list";
  icon: IconName;
  fallbackKey: string;
  options: {
    id: string;
    isActive: (editor: Editor) => boolean;
    run: (editor: Editor) => void;
  }[];
}

type BarCommand = EditingBarCommand | EditingBarMenuDef;

function isMenu(command: BarCommand): command is EditingBarMenuDef {
  return "options" in command;
}

const BLOCK_TYPE_MENU: EditingBarMenuDef = {
  id: "blockType",
  icon: "Heading",
  fallbackKey: "paragraph",
  options: [
    {
      id: "paragraph",
      isActive: (editor) => !editor.isActive("heading"),
      run: (editor) => editor.chain().focus().setParagraph().run(),
    },
    ...([1, 2, 3] as const).map((level) => ({
      id: `heading${level}`,
      isActive: (editor: Editor) => editor.isActive("heading", { level }),
      run: (editor: Editor) => editor.chain().focus().setHeading({ level }).run(),
    })),
  ],
};

const LIST_MENU: EditingBarMenuDef = {
  id: "list",
  icon: "List",
  fallbackKey: "list",
  options: [
    {
      id: "bulletList",
      isActive: (editor) => editor.isActive("bulletList"),
      run: (editor) => editor.chain().focus().toggleBulletList().run(),
    },
    {
      id: "orderedList",
      isActive: (editor) => editor.isActive("orderedList"),
      run: (editor) => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      id: "taskList",
      isActive: (editor) => editor.isActive("taskList"),
      run: (editor) => editor.chain().focus().toggleTaskList().run(),
    },
  ],
};

// Grouped 2/6/6/2/4 — Figma's own separator split (Line 2-5), identical on
// both breakpoints. Order is the ticket's own left-to-right command list,
// paired 1:1 with the measured glyph order; text-quote/square-code/code-xml
// are resolved by POSITION, not by icon-name judgement — see
// design/notes/EditingBar.md.
const GROUPS: BarCommand[][] = [
  [
    { id: "undo", icon: "Undo2", run: (editor) => editor.chain().focus().undo().run() },
    { id: "redo", icon: "Redo2", run: (editor) => editor.chain().focus().redo().run() },
  ],
  [
    BLOCK_TYPE_MENU,
    LIST_MENU,
    {
      id: "blockquote",
      icon: "TextQuote",
      isActive: (editor) => editor.isActive("blockquote"),
      run: (editor) => editor.chain().focus().toggleBlockquote().run(),
    },
    {
      id: "table",
      icon: "Table",
      run: (editor) => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
    },
    {
      id: "codeBlock",
      icon: "SquareCode",
      isActive: (editor) => editor.isActive("codeBlock"),
      run: (editor) => editor.chain().focus().toggleCodeBlock().run(),
    },
    {
      id: "code",
      icon: "CodeXml",
      isActive: (editor) => editor.isActive("code"),
      run: (editor) => editor.chain().focus().toggleCode().run(),
    },
  ],
  [
    {
      id: "bold",
      icon: "Bold",
      isActive: (editor) => editor.isActive("bold"),
      run: (editor) => editor.chain().focus().toggleBold().run(),
    },
    {
      id: "italic",
      icon: "Italic",
      isActive: (editor) => editor.isActive("italic"),
      run: (editor) => editor.chain().focus().toggleItalic().run(),
    },
    {
      id: "strikethrough",
      icon: "Strikethrough",
      isActive: (editor) => editor.isActive("strike"),
      run: (editor) => editor.chain().focus().toggleStrike().run(),
    },
    {
      id: "underline",
      icon: "Underline",
      isActive: (editor) => editor.isActive("underline"),
      run: (editor) => editor.chain().focus().toggleUnderline().run(),
    },
    {
      id: "highlight",
      icon: "Highlighter",
      isActive: (editor) => editor.isActive("highlight"),
      run: (editor) => editor.chain().focus().toggleHighlight().run(),
    },
    {
      id: "link",
      icon: "Link",
      isActive: (editor) => editor.isActive("link"),
      // No link-input UI exists anywhere in Figma for this file (docs/open-
      // questions.md#notes-editingbar-link-no-url-input-designed) — a native
      // window.prompt is the least-invention stand-in, not a custom dialog.
      run: (editor, { promptLinkUrl }) => {
        if (editor.isActive("link")) {
          editor.chain().focus().unsetLink().run();
          return;
        }
        const url = promptLinkUrl();
        if (!url) return;
        editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
      },
    },
  ],
  [
    {
      id: "superscript",
      icon: "Superscript",
      isActive: (editor) => editor.isActive("superscript"),
      run: (editor) => editor.chain().focus().toggleSuperscript().run(),
    },
    {
      id: "subscript",
      icon: "Subscript",
      isActive: (editor) => editor.isActive("subscript"),
      run: (editor) => editor.chain().focus().toggleSubscript().run(),
    },
  ],
  [
    {
      id: "alignLeft",
      icon: "TextAlignStart",
      isActive: (editor) => editor.isActive({ textAlign: "left" }),
      run: (editor) => editor.chain().focus().setTextAlign("left").run(),
    },
    {
      id: "alignCenter",
      icon: "TextAlignCenter",
      isActive: (editor) => editor.isActive({ textAlign: "center" }),
      run: (editor) => editor.chain().focus().setTextAlign("center").run(),
    },
    {
      id: "alignRight",
      icon: "TextAlignEnd",
      isActive: (editor) => editor.isActive({ textAlign: "right" }),
      run: (editor) => editor.chain().focus().setTextAlign("right").run(),
    },
    {
      id: "alignJustify",
      icon: "TextAlignJustify",
      isActive: (editor) => editor.isActive({ textAlign: "justify" }),
      run: (editor) => editor.chain().focus().setTextAlign("justify").run(),
    },
  ],
];

const ALL_COMMANDS = GROUPS.flat();

// Flattened once at module scope into Figma's own flat child order (buttons
// and separator LINEs alternating as direct siblings, one shared
// itemSpacing) rather than nesting a wrapper div per group — that would add
// a DOM level Figma doesn't have and double the unbound-gap spacing-flag
// for no visual difference. See design/notes/EditingBar.md.
type BarItem =
  | { type: "separator"; key: string }
  | { type: "button"; command: BarCommand; index: number };

const BAR_ITEMS: BarItem[] = GROUPS.reduce<{ items: BarItem[]; index: number }>(
  (acc, group, groupIndex) => {
    if (groupIndex > 0) acc.items.push({ type: "separator", key: `separator-${groupIndex}` });
    for (const command of group) {
      acc.items.push({ type: "button", command, index: acc.index });
      acc.index += 1;
    }
    return acc;
  },
  { items: [], index: 0 },
).items;

// #263: `fixed` anchors to the *layout* viewport, but iOS Safari's software
// keyboard only shrinks the *visual* viewport -- a `fixed bottom-0` bar stays
// put while the keyboard covers it. Reads `visualViewport`'s own geometry to
// derive how far the bar needs to lift; SSR-safe (0 until the effect runs,
// `window.visualViewport` can be undefined) and listens on both `resize` and
// `scroll` (iOS moves the visual viewport's offset on scroll too, not just on
// resize). See design/notes/EditingBar.md.
function useKeyboardInset() {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    function update() {
      const vv = window.visualViewport;
      if (!vv) return;
      setInset(Math.max(0, window.innerHeight - (vv.height + vv.offsetTop)));
    }
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, []);
  return inset;
}

export function EditingBar({ editor, className }: EditingBarProps) {
  const t = useTranslations("components.editingBar");
  const containerRef = useRef<HTMLDivElement>(null);
  const keyboardInset = useKeyboardInset();
  // Roving tabindex (ARIA APG toolbar pattern, see design/notes/EditingBar.md
  // for why this was chosen over a plain button row): one tab stop for the
  // whole bar, Left/Right/Home/End move focus among the 20 buttons.
  const [activeIndex, setActiveIndex] = useState(0);

  const activeState = useEditorState({
    editor,
    selector: ({ editor: current }) => {
      if (!current) return null;
      const state: Record<string, boolean | string> = {};
      for (const command of ALL_COMMANDS) {
        if (isMenu(command)) {
          state[command.id] = command.options.find((option) => option.isActive(current))?.id ?? "";
        } else if (command.isActive) {
          state[command.id] = command.isActive(current);
        }
      }
      return state;
    },
  });

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    const count = ALL_COMMANDS.length;
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (activeIndex + 1) % count;
    else if (event.key === "ArrowLeft") nextIndex = (activeIndex - 1 + count) % count;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = count - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    setActiveIndex(nextIndex);
    const buttons = containerRef.current?.querySelectorAll<HTMLButtonElement>("[data-toolbar-item]");
    buttons?.[nextIndex]?.focus();
  }, [activeIndex]);

  if (!editor) return null;

  return (
    <div
      ref={containerRef}
      role="toolbar"
      aria-label={t("label")}
      aria-orientation="horizontal"
      onKeyDown={handleKeyDown}
      // #263: runtime geometry, not styling (colour/spacing) -- same
      // exception CardContentIngredient.tsx's swipe-offset transform already
      // uses. Kept as a CSS custom property so the breakpoint split stays in
      // Tailwind (`md:translate-y-0`) rather than needing a JS media check.
      style={{ "--keyboard-inset": `${keyboardInset}px` } as CSSProperties}
      className={cn(
        // spacing-flag: py-1 (4px) and gap-2 (8px) — EditingBar's own
        // vertical padding and its itemSpacing between buttons/dividers are
        // both unbound on 3978:14138/3978:14870 (paddingLeft/Right and the
        // corner radius ARE bound, see the token classes below) —
        // design/notes/EditingBar.md
        "flex items-center gap-2 overflow-x-auto rounded-card bg-surface-highlight-white px-component-xs py-1",
        "fixed bottom-[env(safe-area-inset-bottom)] left-page-left right-page-right-equal z-10",
        "translate-y-[calc(var(--keyboard-inset,0px)*-1)] transition-transform duration-[var(--duration-base)] ease-base motion-reduce:transition-none",
        "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        "md:static md:inset-auto md:translate-y-0",
        className,
      )}
    >
      {BAR_ITEMS.map((item) => {
        if (item.type === "separator") {
          return <div key={item.key} aria-hidden="true" className="h-6 w-px shrink-0 bg-stroke-lines" />;
        }
        const { command } = item;
        if (isMenu(command)) {
          const currentId = String(activeState?.[command.id] ?? "") || command.options[0]?.id;
          const current = command.options.find((option) => option.id === currentId);
          const hasActive = command.id === "blockType" || Boolean(activeState?.[command.id]);
          return (
            <EditingBarMenu
              key={command.id}
              icon={command.icon}
              menuLabel={t(`${command.id}Label`)}
              currentLabel={t(`options.${hasActive && current ? current.id : command.fallbackKey}`)}
              options={command.options.map((option) => ({
                id: option.id,
                label: t(`options.${option.id}`),
                active: option.id === activeState?.[command.id],
                onSelect: () => option.run(editor),
              }))}
              onDismiss={() => editor.commands.focus()}
              tabIndex={item.index === activeIndex ? 0 : -1}
              onTriggerFocus={() => setActiveIndex(item.index)}
            />
          );
        }
        return (
          <Button
            key={command.id}
            variant="transparent"
            icon={command.icon}
            data-toolbar-item=""
            aria-label={t(`${command.id}Label`)}
            aria-pressed={command.isActive ? Boolean(activeState?.[command.id]) : undefined}
            tabIndex={item.index === activeIndex ? 0 : -1}
            onFocus={() => setActiveIndex(item.index)}
            onClick={() => command.run(editor, { promptLinkUrl: () => window.prompt(t("linkPromptLabel")) })}
          />
        );
      })}
    </div>
  );
}
