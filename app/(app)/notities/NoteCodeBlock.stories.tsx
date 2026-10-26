// design: Claude-designed on request (#336) -- editable code blocks with the language selector and copy button; grammars load lazily, the baseline settles once they have.
import { useEditor, EditorContent } from "@tiptap/react";
import { noteExtensions } from "@/lib/notes/extensions";
import { Specimen, StoryIntro } from "@/.ladle/story-kit";
import type { StoryDefault } from "@ladle/react";

export default { title: "Notities / Blokken / Note code block" } satisfies StoryDefault;

const highlighted = `
<pre><code class="language-javascript">// Totaal van de boodschappen
const prijzen = [2.5, 1.25, 4];
export function totaal(lijst) {
  return lijst.reduce((som, prijs) => som + prijs, 0);
}</code></pre>
<pre><code class="language-json">{ "naam": "Melk", "aantal": 2, "vers": true }</code></pre>
<pre><code class="language-python">def groet(naam):
    return f"Hallo {naam}"  # begroeting</code></pre>
`;

// Pre-#336 shape: no language at all.
const plain = `<pre><code>npm install
npm run build</code></pre>`;

function CodeDemo({ content }: { content: string }) {
  const editor = useEditor({
    extensions: noteExtensions,
    content,
    immediatelyRender: false,
    editorProps: {
      attributes: { class: "text-base font-medium text-text-primary focus:outline-none" },
    },
  });
  return (
    <div className="w-full">
      <EditorContent editor={editor} />
    </div>
  );
}

export const Highlighted = () => <CodeDemo content={highlighted} />;
export const PlainOldBlock = () => <CodeDemo content={plain} />;

export const Overview = () => (
  <div className="flex max-w-prose flex-col gap-stack-lg">
    <StoryIntro what="Code block in a note with a language selector, a copy button and highlighting." note="NoteEditor" />
    <Specimen label="Highlighted" hint="JavaScript, JSON and Python">
      <Highlighted />
    </Specimen>
    <Specimen label="Plain old block" hint="Stored before languages existed">
      <PlainOldBlock />
    </Specimen>
  </div>
);
