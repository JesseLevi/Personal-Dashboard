// design: Claude-designed on request (#335)
import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { noteExtensions } from "@/lib/notes/extensions";
import { NoteBlockHandle } from "./NoteBlockHandle";

const content = `
<h2>Weekplanning</h2>
<p>Boodschappen doen en het recept voor zondag uitzoeken.</p>
<ul><li><p>Groente</p></li><li><p>Brood</p></li></ul>
`;

// Hovers the second block (a synthetic mousemove at its coordinates, exactly
// what the drag-handle plugin listens for) and optionally opens the menu.
function HandleDemo({ openMenu = false }: { openMenu?: boolean }) {
  const editor = useEditor({
    extensions: noteExtensions,
    content,
    immediatelyRender: false,
    editorProps: {
      attributes: { class: "text-base font-semibold text-text-primary focus:outline-none" },
    },
  });
  useEffect(() => {
    if (!editor) return;
    let frame = 0;
    let tries = 0;
    const hover = () => {
      const block = editor.view.dom.children[1] as HTMLElement | undefined;
      const rect = block?.getBoundingClientRect();
      if (!rect || rect.width === 0) {
        frame = requestAnimationFrame(hover);
        return;
      }
      editor.view.dom.dispatchEvent(
        new MouseEvent("mousemove", { bubbles: true, clientX: rect.left + 8, clientY: rect.top + rect.height / 2 }),
      );
      if (!openMenu || document.querySelector("[role=menu]")) return;
      // Opens once the plugin has reported the hovered block; retries until the menu shows.
      document.querySelector<HTMLButtonElement>("[aria-haspopup=menu]")?.click();
      if (tries++ < 60) frame = requestAnimationFrame(hover);
    };
    frame = requestAnimationFrame(hover);
    return () => cancelAnimationFrame(frame);
  }, [editor, openMenu]);
  return (
    <div className={`relative w-full pl-16 pt-4 ${openMenu ? "min-h-[46rem]" : "min-h-48"}`}>
      <EditorContent editor={editor} />
      <NoteBlockHandle editor={editor} />
    </div>
  );
}

export const HandleVisible = () => <HandleDemo />;
export const MenuOpen = () => <HandleDemo openMenu />;
