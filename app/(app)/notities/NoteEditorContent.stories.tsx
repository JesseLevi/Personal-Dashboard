// Prose sample, every block type: .tiptap CSS is Claude-designed on request (#329, design/notes/NoteEditor.md); table styling since #330 (design/notes/NoteEditor.md).
import { useEditor, EditorContent } from "@tiptap/react";
import { noteExtensions } from "@/lib/notes/extensions";

// Fixture content, not app UI. Same extension set and editor root class as NoteEditor.tsx.
const content = `
<h1>Kop niveau 1</h1>
<h2>Kop niveau 2</h2>
<h3>Kop niveau 3</h3>
<p>Gewone alinea met <code>inline code</code> erin.</p>
<ul><li><p>Eerste punt</p></li><li><p>Tweede punt</p></li></ul>
<ol><li><p>Eerste stap</p></li><li><p>Tweede stap</p></li></ol>
<ul data-type="taskList">
<li data-type="taskItem" data-checked="false"><div><p>Mails beantwoorden</p><ul data-type="taskList"><li data-type="taskItem" data-checked="true"><div><p>Klant bellen</p></div></li><li data-type="taskItem" data-checked="false"><div><p>Offerte sturen</p></div></li></ul></div></li>
<li data-type="taskItem" data-checked="true"><div><p>Tafel reserveren</p></div></li>
</ul>
<blockquote><p>Een citaat in de notitie.</p></blockquote>
<pre><code>const a = 1;
const b = 2;</code></pre>
<table><tbody>
<tr><th><p>Kolom A</p></th><th><p>Kolom B</p></th></tr>
<tr><td><p>Cel 1</p></td><td><p>Cel 2</p></td></tr>
<tr><td><p>Cel 3</p></td><td><p>Cel 4</p></td></tr>
</tbody></table>
`;

export const Prose = () => {
  const editor = useEditor({
    extensions: noteExtensions,
    content,
    immediatelyRender: false,
    editable: false,
    editorProps: {
      attributes: { class: "text-base font-semibold text-text-primary focus:outline-none" },
    },
  });
  return (
    <div className="w-full">
      <EditorContent editor={editor} />
    </div>
  );
};
