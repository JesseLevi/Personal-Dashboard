// design: Claude-designed on request (#336) -- collapsible sections, collapsed and open (the stored `open` attribute).
import { useEditor, EditorContent } from "@tiptap/react";
import { noteExtensions } from "@/lib/notes/extensions";
import { setDetailsToggleLabels } from "@/lib/notes/details-labels";

const content = `
<p>Tekst boven de secties.</p>
<details><summary>Ingeklapt: boodschappen</summary><div data-type="detailsContent"><p>Melk, brood en kaas.</p></div></details>
<details open><summary>Uitgeklapt: planning</summary><div data-type="detailsContent"><p>Maandag koken, dinsdag restjes.</p><ul><li><p>Soep</p></li><li><p>Brood</p></li></ul></div></details>
`;

function DetailsDemo() {
  setDetailsToggleLabels({ open: "Sectie uitklappen", close: "Sectie inklappen" });
  const editor = useEditor({
    extensions: noteExtensions,
    content,
    immediatelyRender: false,
    editorProps: {
      attributes: { class: "text-base font-semibold text-text-primary focus:outline-none" },
    },
  });
  return (
    <div className="w-full">
      <EditorContent editor={editor} />
    </div>
  );
}

export const CollapsedAndOpen = () => <DetailsDemo />;
