"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { useEditorState, type Editor } from "@tiptap/react";
import { cn } from "@/lib/ui/cn";
import { Button } from "@/components/atoms/Button";
import type { IconName } from "@/components/atoms/Icon";
import { openImagePicker } from "@/lib/notes/image-upload";
import { requestLinkPopover } from "@/lib/notes/link-popover";
import { SLASH_ITEMS } from "@/lib/notes/slash-items";
import { insertTable, TABLE_COMMANDS } from "@/lib/notes/table-commands";
import { EditingBarMenu } from "./EditingBarMenu";
import { EditingBarOverflow } from "./EditingBarOverflow";
import { TableSizePicker } from "./TableSizePicker";

// figma: node-id=3978:14138
// design: Claude-designed on request (#329 menus, #330 table picker, #333 slim bar); deliberately departs from Figma.
/**
 * Organism/EditingBar — started from Figma "EditingBar" (desktop 3978:14138,
 * mobile 3978:14870, detached frames — docs/open-questions.md#notes-editingbar-
 * detached-from-components), slimmed in #333: nine essentials (undo/redo,
 * block type, list, table, bold, italic, link) plus a "More" overflow; on
 * mobile the bar swaps to table actions while the cursor is in a table.
 * Command map, grouping reasoning and every measurement:
 * design/notes/EditingBar.md.
 */
export interface EditingBarProps {
  editor: Editor | null;
  className?: string;
  /** Forces the mobile behaviour (table-actions swap) regardless of viewport; for stories. */
  mobile?: boolean;
}

interface EditingBarCommand {
  id: string;
  icon: IconName;
  isActive?: (editor: Editor) => boolean;
  run: (editor: Editor, ctx: { openLink: () => void }) => void;
}

// #329: block type and list type are menu buttons, not toggles. Each option
// has an i18n key under components.editingBar and reads/writes the document
// through the same editor commands the markdown input rules use.
export interface EditingBarMenuDef {
  id: "blockType" | "list" | "align";
  icon: IconName;
  fallbackKey: string;
  /** Icon-only trigger showing the current option's icon (#386). */
  iconOnly?: boolean;
  options: {
    id: string;
    icon: IconName;
    isActive: (editor: Editor) => boolean;
    run: (editor: Editor) => void;
  }[];
}

// #330: the table button opens a size picker (TableSizePicker), not a command.
interface EditingBarPickerDef {
  id: "table";
  icon: IconName;
  picker: true;
}

// #339/#386: the "Afbeelding" button, always on the bar: labelled on mobile
// (Figma 3978:15082), icon-only on desktop.
interface EditingBarImageDef {
  id: "image";
  icon: IconName;
  imageButton: true;
}

// #333: the "More" overflow (EditingBarOverflow).
interface EditingBarOverflowDef {
  id: "overflow";
  icon: IconName;
  overflow: true;
}

type BarCommand = EditingBarCommand | EditingBarMenuDef | EditingBarPickerDef | EditingBarOverflowDef | EditingBarImageDef;

function isPicker(command: BarCommand): command is EditingBarPickerDef {
  return "picker" in command;
}

function isMenu(command: BarCommand): command is EditingBarMenuDef {
  return "options" in command;
}

function isImageButton(command: BarCommand): command is EditingBarImageDef {
  return "imageButton" in command;
}

function isOverflow(command: BarCommand): command is EditingBarOverflowDef {
  return "overflow" in command;
}

// Also the bubble menu's "Turn into" list (NoteBubbleMenu.tsx).
export const BLOCK_TYPE_MENU: EditingBarMenuDef = {
  id: "blockType",
  icon: "Heading",
  fallbackKey: "paragraph",
  options: [
    {
      id: "paragraph",
      icon: "Pilcrow",
      isActive: (editor) => !editor.isActive("heading"),
      run: (editor) => editor.chain().focus().setParagraph().run(),
    },
    ...([1, 2, 3] as const).map((level) => ({
      id: `heading${level}`,
      icon: (["Heading1", "Heading2", "Heading3"] as const)[level - 1],
      isActive: (editor: Editor) => editor.isActive("heading", { level }),
      run: (editor: Editor) => editor.chain().focus().setHeading({ level }).run(),
    })),
  ],
};

export const LIST_MENU: EditingBarMenuDef = {
  id: "list",
  icon: "List",
  fallbackKey: "list",
  options: [
    {
      id: "bulletList",
      icon: "List",
      isActive: (editor) => editor.isActive("bulletList"),
      run: (editor) => editor.chain().focus().toggleBulletList().run(),
    },
    {
      id: "orderedList",
      icon: "ListOrdered",
      isActive: (editor) => editor.isActive("orderedList"),
      run: (editor) => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      id: "taskList",
      icon: "ListTodo",
      isActive: (editor) => editor.isActive("taskList"),
      run: (editor) => editor.chain().focus().toggleTaskList().run(),
    },
  ],
};

// "More": inline formats not on the bar (the desktop bubble menu has them too,
// but mobile has no bubble).
const FORMAT_COMMANDS: EditingBarCommand[] = [
  {
    id: "underline",
    icon: "Underline",
    isActive: (editor) => editor.isActive("underline"),
    run: (editor) => editor.chain().focus().toggleUnderline().run(),
  },
  {
    id: "strikethrough",
    icon: "Strikethrough",
    isActive: (editor) => editor.isActive("strike"),
    run: (editor) => editor.chain().focus().toggleStrike().run(),
  },
  {
    id: "highlight",
    icon: "Highlighter",
    isActive: (editor) => editor.isActive("highlight"),
    run: (editor) => editor.chain().focus().toggleHighlight().run(),
  },
  {
    id: "code",
    icon: "CodeXml",
    isActive: (editor) => editor.isActive("code"),
    run: (editor) => editor.chain().focus().toggleCode().run(),
  },
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
];

// #386: its own icon-only dropdown on the bar (the trigger shows the current alignment).
export const ALIGN_MENU: EditingBarMenuDef = {
  id: "align",
  icon: "TextAlignStart",
  fallbackKey: "alignLeft",
  iconOnly: true,
  options: (
    [
      ["alignLeft", "TextAlignStart", "left"],
      ["alignCenter", "TextAlignCenter", "center"],
      ["alignRight", "TextAlignEnd", "right"],
      ["alignJustify", "TextAlignJustify", "justify"],
    ] as const
  ).map(([id, icon, textAlign]) => ({
    id,
    icon,
    isActive: (editor: Editor) => editor.isActive({ textAlign }),
    run: (editor: Editor) => editor.chain().focus().setTextAlign(textAlign).run(),
  })),
};

// Block inserts in "More" come from the slash menu's own list (#332), so a new
// block type there needs no second edit here.
const INSERT_ITEMS = SLASH_ITEMS.filter((item) => ["blockquote", "codeBlock", "divider"].includes(item.id));

// 2 | 3 | 3 | align | image | More. Reasoning and the old-command map: design/notes/EditingBar.md.
const GROUPS: BarCommand[][] = [
  [
    { id: "undo", icon: "Undo2", run: (editor) => editor.chain().focus().undo().run() },
    { id: "redo", icon: "Redo2", run: (editor) => editor.chain().focus().redo().run() },
  ],
  [BLOCK_TYPE_MENU, LIST_MENU, { id: "table", icon: "Table", picker: true }],
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
      id: "link",
      icon: "Link",
      isActive: (editor) => editor.isActive("link"),
      // Opens the shared LinkPopover (#331); no window.prompt.
      run: (_editor, { openLink }) => openLink(),
    },
  ],
  [ALIGN_MENU],
  [{ id: "image", icon: "Image", imageButton: true }],
  [{ id: "overflow", icon: "Ellipsis", overflow: true }],
];

/** Ids of the bar's own buttons and of every overflow row (reachability test). */
export const BAR_COMMAND_IDS = GROUPS.flat().map((command) => command.id);
export const OVERFLOW_COMMAND_IDS = [
  ...INSERT_ITEMS.map((item) => item.id),
  ...FORMAT_COMMANDS.map((command) => command.id),
];

const ALL_COMMANDS = [...GROUPS.flat(), ...FORMAT_COMMANDS];

// Flattened once at module scope (buttons and separators as direct siblings,
// one shared gap) rather than a wrapper div per group.
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

// Below the `md` breakpoint (48rem), where the bar is the fixed bottom bar.
const DESKTOP_QUERY = "(min-width: 48rem)";

function subscribeViewport(onChange: () => void) {
  const query = window.matchMedia(DESKTOP_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function useIsMobileViewport() {
  return useSyncExternalStore(
    subscribeViewport,
    () => !window.matchMedia(DESKTOP_QUERY).matches,
    () => false,
  );
}

// #331: on the mobile bar (fixed to the bottom) the popover anchors to the
// whole bar, whose link button may be scrolled out of view; on desktop to the button.
function linkAnchor(button: HTMLElement, bar: HTMLElement | null) {
  return window.matchMedia(DESKTOP_QUERY).matches ? button : (bar ?? button);
}

export function EditingBar({ editor, className, mobile }: EditingBarProps) {
  const t = useTranslations("components.editingBar");
  const tTable = useTranslations("components.noteTable");
  const tSlash = useTranslations("components.slashMenu.items");
  const containerRef = useRef<HTMLDivElement>(null);
  const keyboardInset = useKeyboardInset();
  const viewportIsMobile = useIsMobileViewport();
  const isMobile = mobile ?? viewportIsMobile;
  // Roving tabindex (ARIA APG toolbar pattern, see design/notes/EditingBar.md
  // for why this was chosen over a plain button row): one tab stop for the
  // whole bar, Left/Right/Home/End move focus among its buttons.
  const [activeIndex, setActiveIndex] = useState(0);
  // Mobile in a table: the user went "back" to the default bar for now.
  const [tableDismissed, setTableDismissed] = useState(false);
  const focusFirstAfterSwap = useRef(false);

  const activeState = useEditorState({
    editor,
    selector: ({ editor: current }) => {
      if (!current) return null;
      const state: Record<string, boolean | string> = { inTable: current.isActive("table") };
      for (const command of ALL_COMMANDS) {
        if (isPicker(command) || isOverflow(command) || isImageButton(command)) continue;
        if (isMenu(command)) {
          state[command.id] = command.options.find((option) => option.isActive(current))?.id ?? "";
        } else if (command.isActive) {
          state[command.id] = command.isActive(current);
        }
      }
      state.blockquote = current.isActive("blockquote");
      state.codeBlock = current.isActive("codeBlock");
      state.tableEnabled = TABLE_COMMANDS.filter((command) => command.isEnabled(current))
        .map((command) => command.id)
        .join(",");
      return state;
    },
  });

  const inTable = Boolean(activeState?.inTable);
  const tableMode = isMobile && inTable && !tableDismissed;

  useEffect(() => {
    if (!inTable) setTableDismissed(false);
  }, [inTable]);

  // The two bars have different button counts: restart the roving stop.
  useEffect(() => {
    setActiveIndex(0);
    if (!focusFirstAfterSwap.current) return;
    focusFirstAfterSwap.current = false;
    containerRef.current?.querySelector<HTMLElement>("[data-toolbar-item]")?.focus();
  }, [tableMode]);

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    const buttons = containerRef.current?.querySelectorAll<HTMLButtonElement>("[data-toolbar-item]");
    const count = buttons?.length ?? 0;
    if (count === 0) return;
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (activeIndex + 1) % count;
    else if (event.key === "ArrowLeft") nextIndex = (activeIndex - 1 + count) % count;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = count - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    setActiveIndex(nextIndex);
    buttons?.[nextIndex]?.focus();
  }, [activeIndex]);

  if (!editor) return null;

  function overflowSections() {
    const current = editor;
    if (!current) return [];
    const toggle = (command: EditingBarCommand) => ({
      id: command.id,
      icon: command.icon,
      label: t(`${command.id}Label`),
      active: Boolean(activeState?.[command.id]),
      onSelect: () => command.run(current, { openLink: () => {} }),
    });
    return [
      INSERT_ITEMS.map((item) => ({
        id: item.id,
        icon: item.icon,
        label: tSlash(item.id),
        active: item.id === "divider" ? undefined : Boolean(activeState?.[item.id]),
        onSelect: () => item.run?.(current),
      })),
      FORMAT_COMMANDS.map(toggle),
    ];
  }

  function renderDefaultItems(current: Editor) {
    return BAR_ITEMS.map((item) => {
      if (item.type === "separator") {
        return <div key={item.key} aria-hidden="true" className="h-6 w-px shrink-0 bg-stroke-lines" />;
      }
      const { command } = item;
      const tabIndex = item.index === activeIndex ? 0 : -1;
      if (isImageButton(command)) {
        const imageProps = {
          variant: "transparent",
          icon: command.icon,
          "data-toolbar-item": "",
          tabIndex,
          onFocus: () => setActiveIndex(item.index),
          onClick: () => openImagePicker(current),
        } as const;
        return isMobile ? (
          <Button key={command.id} {...imageProps}>
            {t("imageLabel")}
          </Button>
        ) : (
          <Button key={command.id} {...imageProps} aria-label={t("imageLabel")} />
        );
      }
      if (isOverflow(command)) {
        return (
          <EditingBarOverflow
            key={command.id}
            menuLabel={t("moreLabel")}
            sections={overflowSections()}
            onDismiss={() => current.commands.focus()}
            tabIndex={tabIndex}
            onTriggerFocus={() => setActiveIndex(item.index)}
          />
        );
      }
      if (isPicker(command)) {
        // Mobile with the cursor in a table: this slot reopens the table actions.
        if (isMobile && inTable) {
          return (
            <Button
              key={command.id}
              variant="transparent"
              icon={command.icon}
              data-toolbar-item=""
              aria-label={t("tableActionsLabel")}
              tabIndex={tabIndex}
              onFocus={() => setActiveIndex(item.index)}
              onClick={() => {
                focusFirstAfterSwap.current = true;
                setTableDismissed(false);
              }}
            />
          );
        }
        return (
          <TableSizePicker
            key={command.id}
            onInsert={(rows, cols) => insertTable(current, rows, cols)}
            onDismiss={() => current.commands.focus()}
            tabIndex={tabIndex}
            onTriggerFocus={() => setActiveIndex(item.index)}
          />
        );
      }
      if (isMenu(command)) {
        const currentId = String(activeState?.[command.id] ?? "") || command.options[0]?.id;
        const selected = command.options.find((option) => option.id === currentId);
        const hasActive = command.id === "blockType" || Boolean(activeState?.[command.id]);
        return (
          <EditingBarMenu
            key={command.id}
            icon={selected?.icon ?? command.icon}
            iconOnly={command.iconOnly}
            menuLabel={t(`${command.id}Label`)}
            currentLabel={t(`options.${hasActive && selected ? selected.id : command.fallbackKey}`)}
            options={command.options.map((option) => ({
              id: option.id,
              icon: option.icon,
              label: t(`options.${option.id}`),
              active: option.id === activeState?.[command.id],
              onSelect: () => option.run(current),
            }))}
            onDismiss={() => current.commands.focus()}
            tabIndex={tabIndex}
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
          tabIndex={tabIndex}
          onFocus={() => setActiveIndex(item.index)}
          onClick={(event) =>
            command.run(current, {
              openLink: () => requestLinkPopover(current, linkAnchor(event.currentTarget, containerRef.current)),
            })
          }
        />
      );
    });
  }

  function renderTableItems(current: Editor) {
    const enabled = String(activeState?.tableEnabled ?? "").split(",");
    return (
      <>
        <Button
          variant="transparent"
          icon="ArrowLeft"
          data-toolbar-item=""
          aria-label={t("backLabel")}
          tabIndex={activeIndex === 0 ? 0 : -1}
          onFocus={() => setActiveIndex(0)}
          onClick={() => {
            setTableDismissed(true);
            current.commands.focus();
          }}
        />
        <div aria-hidden="true" className="h-6 w-px shrink-0 bg-stroke-lines" />
        {TABLE_COMMANDS.map((command, index) => {
          const isEnabled = enabled.includes(command.id);
          return (
            <Button
              key={command.id}
              variant="transparent"
              icon={command.icon}
              data-toolbar-item=""
              aria-disabled={!isEnabled}
              tabIndex={activeIndex === index + 1 ? 0 : -1}
              onFocus={() => setActiveIndex(index + 1)}
              className={cn(
                command.destructive && "text-priority-urgent",
                "aria-disabled:cursor-not-allowed aria-disabled:opacity-40 aria-disabled:hover:bg-transparent aria-disabled:active:bg-transparent",
              )}
              onClick={() => {
                if (isEnabled) command.run(current);
              }}
            >
              {tTable(`commands.${command.id}`)}
            </Button>
          );
        })}
      </>
    );
  }

  return (
    <div
      ref={containerRef}
      role="toolbar"
      aria-label={tableMode ? t("tableActionsBarLabel") : t("label")}
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
        "flex items-center gap-2 overflow-x-auto md:mx-auto md:w-fit md:max-w-full rounded-card bg-surface-highlight-white px-component-xs py-1",
        "fixed bottom-[env(safe-area-inset-bottom)] left-page-left right-page-right-equal z-10",
        "translate-y-[calc(var(--keyboard-inset,0px)*-1)] transition-transform duration-[var(--duration-base)] ease-base motion-reduce:transition-none",
        "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        "md:static md:inset-auto md:translate-y-0",
        className,
      )}
    >
      {tableMode ? renderTableItems(editor) : renderDefaultItems(editor)}
    </div>
  );
}
