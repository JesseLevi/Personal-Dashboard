// figma: node-id=3978:14138
import { useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { Placeholder } from "@tiptap/extensions";
import { EditingBar } from "./EditingBar";
import { noteExtensions } from "@/lib/notes/extensions";
import nl from "../../messages/nl.json";
import type { StoryDefault } from "@ladle/react";

export default { title: "Notities / Editor / Editing bar" } satisfies StoryDefault;

const placeholder = nl.components.noteEditor.placeholder;

// Same useEditor() shape as NoteEditor.tsx (design/notes/NoteEditor.md's
// "Performance isolation" section) -- `noteExtensions` is the same fixed
// whitelist the real page uses, so this story exercises the real command
// wiring, not a stand-in editor. `activateBold` deterministically produces
// the "active button" story: selecting all, toggling bold, then collapsing
// the cursor to the end applies the mark and reads `editor.isActive('bold')`
// as true at first paint (the collapsed cursor inherits the preceding text's
// mark) without leaving a distracting text-selection highlight in the
// screenshot.
function useDemoEditor(activateBold: boolean) {
  return useEditor({
    extensions: [...noteExtensions, Placeholder.configure({ placeholder })],
    content: "<p>Voorbeeldtekst in de notitie-editor.</p>",
    immediatelyRender: false,
    editorProps: {
      attributes: { class: "text-base font-medium text-text-primary focus:outline-none" },
    },
    onCreate: ({ editor }) => {
      if (activateBold) {
        editor.chain().focus().selectAll().toggleBold().run();
        editor.commands.setTextSelection(editor.state.doc.content.size);
      }
    },
  });
}

function EditingBarDemo({ activateBold = false }: { activateBold?: boolean }) {
  const editor = useDemoEditor(activateBold);
  return (
    <div className="flex w-full flex-col gap-page-stack">
      <EditingBar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}

export const AtRest = () => <EditingBarDemo />;
export const WithActiveButton = () => <EditingBarDemo activateBold />;

// #329: menus open at first paint (a click on the trigger once mounted) so the
// baseline shows the panel; `content` seeds the cursor block so the trigger
// reads the current type.
function OpenMenuDemo({ menu, content }: { menu: "blockType" | "list" | "align" | "overflow"; content: string }) {
  const editor = useEditor({
    extensions: [...noteExtensions, Placeholder.configure({ placeholder })],
    content,
    immediatelyRender: false,
    editorProps: {
      attributes: { class: "text-base font-medium text-text-primary focus:outline-none" },
    },
    onCreate: ({ editor: created }) => {
      created.commands.focus("end");
    },
  });
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!editor) return;
    const index = { blockType: 2, list: 3, align: 8, overflow: 10 }[menu];
    const timer = requestAnimationFrame(() => {
      ref.current?.querySelectorAll<HTMLButtonElement>("[data-toolbar-item]")[index]?.click();
    });
    return () => cancelAnimationFrame(timer);
  }, [editor, menu]);
  return (
    <div ref={ref} className="flex min-h-72 w-full flex-col gap-page-stack">
      <EditingBar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}

export const BlockTypeMenuOpen = () => (
  <OpenMenuDemo menu="blockType" content="<h2>Weekplanning</h2>" />
);
export const ListMenuOpen = () => (
  <OpenMenuDemo
    menu="list"
    content={'<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>Boodschappen doen</p></li></ul>'}
  />
);

// #333: the slim bar. Desktop is AtRest; the overflow opens at first paint; the
// mobile stories force the mobile behaviour in a phone-width frame.
export const OverflowOpen = () => (
  <OpenMenuDemo menu="overflow" content="<p>Voorbeeldtekst in de notitie-editor.</p>" />
);

// #386: the icon-only alignment dropdown; centred text so the trigger shows a non-default icon.
export const AlignMenuOpen = () => (
  <OpenMenuDemo menu="align" content={'<p style="text-align: center">Voorbeeldtekst in de notitie-editor.</p>'} />
);

const TABLE_CONTENT =
  "<p>Voorbeeldtekst.</p><table><tbody><tr><th><p>Product</p></th><th><p>Prijs</p></th></tr><tr><td><p>Appel</p></td><td><p>1,20</p></td></tr></tbody></table>";

function MobileDemo({ content }: { content: string }) {
  const editor = useEditor({
    extensions: [...noteExtensions, Placeholder.configure({ placeholder })],
    content,
    immediatelyRender: false,
    editorProps: {
      attributes: { class: "text-base font-medium text-text-primary focus:outline-none" },
    },
    onCreate: ({ editor: created }) => {
      created.commands.focus("end");
    },
  });
  return (
    <div className="flex w-96 max-w-full flex-col gap-page-stack">
      <EditingBar editor={editor} mobile />
      <EditorContent editor={editor} />
    </div>
  );
}

export const Mobile = () => <MobileDemo content="<p>Voorbeeldtekst in de notitie-editor.</p>" />;
export const MobileInTable = () => <MobileDemo content={TABLE_CONTENT} />;
