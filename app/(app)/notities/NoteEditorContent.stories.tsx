// Prose sample, every block type: .tiptap CSS is Claude-designed on request (#329, design/notes/NoteEditor.md); table styling since #330 (design/notes/NoteEditor.md).
import { useEditor, EditorContent } from "@tiptap/react";
import { Placeholder } from "@tiptap/extensions";
import { noteExtensions } from "@/lib/notes/extensions";
import { SlashCommand } from "@/lib/notes/slash-command";
import { SLASH_ITEMS } from "@/lib/notes/slash-items";
import { EditingBar } from "@/components/organisms/EditingBar";
import { NoteBubbleMenu } from "@/components/organisms/NoteBubbleMenu";
import { SlashMenu } from "@/components/organisms/SlashMenu";
import nl from "@/messages/nl.json";
import { StoryIntro } from "@/.ladle/story-kit";
import type { StoryDefault } from "@ladle/react";

export default { title: "Notities / Editor / Note editor content" } satisfies StoryDefault;

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
      attributes: { class: "text-base font-medium text-text-primary focus:outline-none" },
    },
  });
  return (
    <div className="w-full">
      <EditorContent editor={editor} />
    </div>
  );
};

export const Overview = () => (
  <div>
    <StoryIntro
      what="The note text as the reader sees it: headings, lists, task lists, quote, code and table. This is the only visual coverage of the shared prose styles."
      note="NoteEditor"
    />
    <Prose />
  </div>
);

// One editable note with the toolbar, the bubble menu on a selection and the slash menu on "/":
// select text to format it, type "/" on an empty line to insert a block.
export const Interactive = () => {
  const editor = useEditor({
    extensions: [
      ...noteExtensions,
      Placeholder.configure({ placeholder: nl.components.noteEditor.placeholder }),
      SlashCommand.configure({ items: SLASH_ITEMS }),
    ],
    content: "<h2>Weekplanning</h2><p>Select a few words to open the bubble menu, or type / on a new line.</p><p></p>",
    immediatelyRender: false,
    editorProps: {
      attributes: { class: "text-base font-medium text-text-primary focus:outline-none" },
    },
  });
  return (
    <div className="flex max-w-prose flex-col gap-stack-md">
      <StoryIntro
        what="One editable note with the editing bar, the bubble menu on a selection and the slash menu on a slash."
        note="EditingBar"
      />
      <EditingBar editor={editor} />
      <div className="relative min-h-96">
        <EditorContent editor={editor} />
        <SlashMenu editor={editor} />
        <NoteBubbleMenu editor={editor} />
      </div>
    </div>
  );
};
