// design: Claude-designed on request (#339) -- the four states of an image in the notes editor.
import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { noteExtensions } from "@/lib/notes/extensions";
import { NoteImageUpload, requestImageUpload } from "@/lib/notes/image-upload";
import nl from "../../messages/nl.json";

// Route-shaped srcs, served by the note-image middleware in .ladle/vite.config.mjs
// (a two-tone picture; the missing id answers 404, so the browser fires `error`).
const PICTURE = "/api/note-image/00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000002";
const MISSING = "/api/note-image/00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-00000000dead";

const intro = { type: "paragraph", content: [{ type: "text", text: "Een notitie met een afbeelding." }] };
const image = (src: string, alt?: string) => ({ type: "image", attrs: { src, alt: alt ?? null } });

function ImageDemo({
  src,
  alt,
  selected,
  uploading,
}: {
  src?: string;
  alt?: string;
  selected?: boolean;
  uploading?: boolean;
}) {
  const editor = useEditor({
    extensions: [
      ...noteExtensions,
      NoteImageUpload.configure({
        upload: () => new Promise(() => {}),
        onError: () => {},
        uploadingLabel: nl.components.noteImage.uploading,
      }),
    ],
    content: {
      type: "doc",
      content: src ? [intro, image(src, alt), { type: "paragraph" }] : [intro, { type: "paragraph" }],
    },
    immediatelyRender: false,
    editorProps: {
      attributes: { class: "text-base font-medium text-text-primary focus:outline-none" },
    },
  });
  useEffect(() => {
    if (!editor) return;
    if (selected) editor.commands.setNodeSelection(editor.state.doc.child(0).nodeSize);
    if (uploading) {
      const file = new File([new Uint8Array(16)], "foto.png", { type: "image/png" });
      requestImageUpload(editor, [file], editor.state.doc.content.size - 1);
    }
  }, [editor, selected, uploading]);
  return (
    <div className="w-full">
      <EditorContent editor={editor} />
    </div>
  );
}

export const Uploading = () => <ImageDemo uploading />;
export const WithImage = () => <ImageDemo src={PICTURE} alt="Een blauwe lucht boven groene heuvels" />;
export const Broken = () => <ImageDemo src={MISSING} alt="Een foto die niet meer bestaat" />;
export const Selected = () => <ImageDemo src={PICTURE} alt="Een blauwe lucht boven groene heuvels" selected />;
