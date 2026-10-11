// design: Claude-designed on request (#341)
import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { noteExtensionsWith } from "@/lib/notes/extensions";
import { NoteLinkSuggestion, type NoteLinkSuggestionItem } from "@/lib/notes/note-link-suggestion";
import { NoteLinkMenu } from "./NoteLinkMenu";

// Fixture notes, not app data. Types "[[" plus `query` into an empty note,
// exactly what the menu reacts to; labels are the nl catalog's, as in every story.
const NOTES: NoteLinkSuggestionItem[] = [
  { id: "11111111-1111-4111-8111-111111111111", title: "Boodschappen deze week", category_name: "Huis" },
  { id: "22222222-2222-4222-8222-222222222222", title: "Boekidee: een korte roman", category_name: "Ideeen" },
  { id: "33333333-3333-4333-8333-333333333333", title: "Vergadering met het team over de planning van het derde kwartaal", category_name: "Werk" },
  { id: "44444444-4444-4444-8444-444444444444", title: "", category_name: "Werk" },
];

function NoteLinkDemo({ query, slow = false }: { query: string; slow?: boolean }) {
  const editor = useEditor({
    extensions: [
      ...noteExtensionsWith({ titles: {}, missing: [] }),
      NoteLinkSuggestion.configure({
        debounce: 0,
        search: (text) =>
          slow
            ? new Promise(() => {})
            : Promise.resolve(NOTES.filter((note) => note.title.toLowerCase().includes(text.trim().toLowerCase()))),
      }),
    ],
    content: "<p></p>",
    immediatelyRender: false,
    editorProps: {
      attributes: { class: "text-base font-semibold text-text-primary focus:outline-none" },
    },
  });
  useEffect(() => {
    if (!editor) return;
    editor.commands.focus();
    editor.commands.insertContent(`[[${query}`);
  }, [editor, query]);
  return (
    <div className="relative min-h-[28rem] w-full pt-4">
      <EditorContent editor={editor} />
      <NoteLinkMenu editor={editor} />
    </div>
  );
}

export const Open = () => <NoteLinkDemo query="" />;
export const Filtered = () => <NoteLinkDemo query="bo" />;
export const NoResults = () => <NoteLinkDemo query="zzz" />;
export const Searching = () => <NoteLinkDemo query="bo" slow />;
