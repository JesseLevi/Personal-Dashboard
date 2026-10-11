// design: Claude-designed on request (#387)
import { useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { noteExtensions } from "@/lib/notes/extensions";
import { EditingBar } from "./EditingBar";
import { NoteTableHandles } from "./NoteTableHandles";
import { TableMenu } from "./TableMenu";

const table = `
<table><tbody>
<tr><th><p>Product</p></th><th><p>Aantal</p></th><th><p>Prijs</p></th></tr>
<tr><td><p>Melk</p></td><td><p>2</p></td><td><p>1,20</p></td></tr>
<tr><td><p>Brood</p></td><td><p>1</p></td><td><p>2,40</p></td></tr>
</tbody></table>`;

// Hover is simulated: the handles appear on a pointermove over the table.
function HandlesDemo({ content, withBar }: { content: string; withBar?: boolean }) {
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
    let frame = 0;
    const hover = () => {
      const cell = ref.current?.querySelector("td");
      if (cell) cell.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, pointerType: "mouse" }));
      else frame = requestAnimationFrame(hover);
    };
    frame = requestAnimationFrame(hover);
    return () => cancelAnimationFrame(frame);
  }, [editor]);
  return (
    <div ref={ref} className="relative flex min-h-64 w-full flex-col gap-page-stack px-8 pt-8">
      {withBar && <EditingBar editor={editor} />}
      <div>
        <EditorContent editor={editor} />
      </div>
      <TableMenu editor={editor} />
      <NoteTableHandles editor={editor} />
    </div>
  );
}

export const HandlesVisible = () => <HandlesDemo content={`<p>Boodschappen deze week.</p>${table}`} />;
export const FirstBlockUnderBar = () => <HandlesDemo content={table} withBar />;
