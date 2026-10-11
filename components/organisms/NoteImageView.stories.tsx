// design: Claude-designed on request (#339) -- the four states of an image in the notes editor.
import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { noteExtensions } from "@/lib/notes/extensions";
import { NoteImageUpload, requestImageUpload } from "@/lib/notes/image-upload";
import nl from "../../messages/nl.json";

// A flat two-tone picture as a data URI: no network, identical in every run.
const PICTURE = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="320"><rect width="640" height="320" fill="steelblue"/><circle cx="480" cy="110" r="60" fill="gold"/><path d="M0 320 L200 140 L360 280 L460 200 L640 320 Z" fill="seagreen"/></svg>',
)}`;
// Not decodable as an image, so the browser fires `error` straight away.
const MISSING = "data:image/png;base64,AAAA";

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
