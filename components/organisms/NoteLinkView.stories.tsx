// design: Claude-designed on request (#341)
import { useEditor, EditorContent } from "@tiptap/react";
import { noteExtensionsWith } from "@/lib/notes/extensions";
import { buildNoteLinkResolution } from "@/lib/notes/note-link";
import type { TipTapDocument } from "@/lib/notes/document";

// Fixture content, not app UI. Same extension set and editor root class as NoteEditor.tsx.
const ALIVE = "11111111-1111-4111-8111-111111111111";
const RENAMED = "22222222-2222-4222-8222-222222222222";
const GONE = "33333333-3333-4333-8333-333333333333";

const link = (noteId: string, label: string) => ({ type: "noteLink", attrs: { noteId, label } });
const text = (value: string) => ({ type: "text", text: value });

const doc = {
  type: "doc",
  content: [
    { type: "paragraph", content: [text("Zie ook "), link(ALIVE, "Boodschappen"), text(" en "), link(RENAMED, "Oude titel"), text(".")] },
    { type: "paragraph", content: [text("Dit doel is verwijderd: "), link(GONE, "Weg"), text(".")] },
  ],
} as TipTapDocument;

function NoteLinkDoc({ content, titles }: { content: TipTapDocument; titles: Record<string, string> }) {
  const editor = useEditor({
    extensions: noteExtensionsWith(buildNoteLinkResolution(content, titles)),
    content,
    immediatelyRender: false,
    editorProps: {
      attributes: { class: "text-base font-medium text-text-primary focus:outline-none" },
    },
  });
  return (
    <div className="w-full max-w-prose">
      <EditorContent editor={editor} />
    </div>
  );
}

/** A live link, a renamed target (shows the new title) and a deleted target. */
export const Links = () => (
  <NoteLinkDoc content={doc} titles={{ [ALIVE]: "Boodschappen", [RENAMED]: "Nieuwe titel" }} />
);

/** Only the deleted state: muted, not clickable. */
export const DeletedLink = () => (
  <NoteLinkDoc
    content={{ type: "doc", content: [{ type: "paragraph", content: [text("Verwezen: "), link(GONE, "Weg")] }] } as TipTapDocument}
    titles={{}}
  />
);
