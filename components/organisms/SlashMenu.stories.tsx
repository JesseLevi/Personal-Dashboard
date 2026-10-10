// design: Claude-designed on request (#332)
import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { noteExtensions } from "@/lib/notes/extensions";
import { SlashCommand } from "@/lib/notes/slash-command";
import { SLASH_ITEMS } from "@/lib/notes/slash-items";
import { SlashMenu } from "./SlashMenu";

// Types "/" plus `query` into an empty note, exactly what the menu reacts to.
// Labels are the nl catalog's, as in every other story.
function SlashDemo({ query }: { query: string }) {
  const editor = useEditor({
    extensions: [...noteExtensions, SlashCommand.configure({ items: SLASH_ITEMS })],
    content: "<p></p>",
    immediatelyRender: false,
    editorProps: {
      attributes: { class: "text-base font-semibold text-text-primary focus:outline-none" },
    },
  });
  useEffect(() => {
    if (!editor) return;
    editor.commands.focus();
    editor.commands.insertContent(`/${query}`);
  }, [editor, query]);
  return (
    <div className="relative min-h-[28rem] w-full pt-4">
      <EditorContent editor={editor} />
      <SlashMenu editor={editor} />
    </div>
  );
}

export const Open = () => <SlashDemo query="" />;
export const Filtered = () => <SlashDemo query="kop" />;
export const NoResults = () => <SlashDemo query="zzz" />;
