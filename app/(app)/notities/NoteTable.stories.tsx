// design: Claude-designed on request (#330) -- editable table with stored column widths, and a pre-#330 table without any.
import { useEditor, EditorContent } from "@tiptap/react";
import { noteExtensions } from "@/lib/notes/extensions";
import { Specimen, StoryIntro } from "@/.ladle/story-kit";
import type { StoryDefault } from "@ladle/react";

export default { title: "Notities / Blokken / Note table" } satisfies StoryDefault;

const sized = `
<table><tbody>
<tr><th colwidth="96"><p>Product</p></th><th colwidth="240"><p>Opmerking</p></th><th colwidth="128"><p>Aantal</p></th></tr>
<tr><td colwidth="96"><p>Melk</p></td><td colwidth="240"><p>Halfvol, twee pakken</p></td><td colwidth="128"><p>2</p></td></tr>
<tr><td colwidth="96"><p>Brood</p></td><td colwidth="240"><p>Volkoren</p></td><td colwidth="128"><p>1</p></td></tr>
<tr><td colwidth="96"><p>Kaas</p></td><td colwidth="240"><p>Jong belegen</p></td><td colwidth="128"><p>1</p></td></tr>
</tbody></table>`;

const legacy = `
<table><tbody>
<tr><th><p>Kolom A</p></th><th><p>Kolom B</p></th><th><p>Kolom C</p></th></tr>
<tr><td><p>Cel 1</p></td><td><p>Cel 2</p></td><td><p>Cel 3</p></td></tr>
<tr><td><p>Cel 4</p></td><td><p>Cel 5</p></td><td><p>Cel 6</p></td></tr>
</tbody></table>`;

function TableDemo({ content }: { content: string }) {
  const editor = useEditor({
    extensions: noteExtensions,
    content,
    immediatelyRender: false,
    editorProps: {
      attributes: { class: "text-base font-medium text-text-primary focus:outline-none" },
    },
  });
  return (
    <div className="w-full" data-testid="note-table">
      <EditorContent editor={editor} />
    </div>
  );
}

export const WithColumnWidths = () => <TableDemo content={sized} />;
export const WithoutStoredWidths = () => <TableDemo content={legacy} />;

export const Overview = () => (
  <div className="flex max-w-prose flex-col gap-stack-lg">
    <StoryIntro what="Editable table in a note, with draggable column widths." note="NoteEditor" />
    <Specimen label="With column widths" hint="Widths stored on the cells">
      <WithColumnWidths />
    </Specimen>
    <Specimen label="Without stored widths" hint="A table from before column widths existed">
      <WithoutStoredWidths />
    </Specimen>
  </div>
);
