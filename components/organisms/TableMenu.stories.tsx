// design: Claude-designed on request (#330)
import { useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { noteExtensions } from "@/lib/notes/extensions";
import { TableMenu } from "./TableMenu";

const content = `
<p>Boodschappen deze week.</p>
<table><tbody>
<tr><th><p>Product</p></th><th><p>Aantal</p></th></tr>
<tr><td><p>Melk</p></td><td><p>2</p></td></tr>
<tr><td><p>Brood</p></td><td><p>1</p></td></tr>
</tbody></table>`;

// The cursor sits in a body cell so the floating trigger shows; `open` also
// clicks it so the panel is part of the baseline.
function TableMenuDemo({ open }: { open: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const editor = useEditor({
    extensions: noteExtensions,
    content,
    immediatelyRender: false,
    editorProps: {
      attributes: { class: "text-base font-semibold text-text-primary focus:outline-none" },
    },
    onCreate: ({ editor: created }) => {
      created.commands.focus();
      created.commands.setTextSelection(created.state.doc.content.size - 6);
    },
  });
  useEffect(() => {
    if (!open || !editor) return;
    let frame = 0;
    // The bubble appears a tick after the cursor lands in the table: poll.
    const click = () => {
      const trigger = ref.current?.querySelector<HTMLButtonElement>("[aria-haspopup=menu]");
      if (trigger) trigger.click();
      else frame = requestAnimationFrame(click);
    };
    frame = requestAnimationFrame(click);
    return () => cancelAnimationFrame(frame);
  }, [editor, open]);
  return (
    <div ref={ref} className={`relative w-full pt-16 ${open ? "min-h-[40rem]" : "min-h-64"}`}>
      <EditorContent editor={editor} />
      <TableMenu editor={editor} />
    </div>
  );
}

export const TriggerVisible = () => <TableMenuDemo open={false} />;
export const MenuOpen = () => <TableMenuDemo open />;
