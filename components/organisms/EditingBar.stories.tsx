// figma: node-id=3978:14138
import { useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { Placeholder } from "@tiptap/extensions";
import { EditingBar } from "./EditingBar";
import { noteExtensions } from "@/lib/notes/extensions";
import nl from "../../messages/nl.json";

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
      attributes: { class: "text-base font-semibold text-text-primary focus:outline-none" },
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
function OpenMenuDemo({ menu, content }: { menu: "blockType" | "list"; content: string }) {
  const editor = useEditor({
    extensions: [...noteExtensions, Placeholder.configure({ placeholder })],
    content,
    immediatelyRender: false,
    editorProps: {
      attributes: { class: "text-base font-semibold text-text-primary focus:outline-none" },
    },
    onCreate: ({ editor: created }) => {
      created.commands.focus("end");
    },
  });
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!editor) return;
    const index = menu === "blockType" ? 2 : 3;
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
