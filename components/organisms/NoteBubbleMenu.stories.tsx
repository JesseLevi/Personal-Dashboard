// design: Claude-designed on request (#331)
import { useEditor, EditorContent } from "@tiptap/react";
import { noteExtensions } from "@/lib/notes/extensions";
import { NoteBubbleMenu } from "./NoteBubbleMenu";
import type { StoryDefault } from "@ladle/react";

export default { title: "Notities / Editor / Note bubble menu" } satisfies StoryDefault;

const content = "<p>Boodschappen deze week en een stukje tekst om te selecteren.</p>";

// Selects "deze week" so the menu shows at first paint; `bold` also applies a
// mark first to show a pressed button.
function BubbleDemo({ bold = false, openTurnInto = false }: { bold?: boolean; openTurnInto?: boolean }) {
  const editor = useEditor({
    extensions: noteExtensions,
    content,
    immediatelyRender: false,
    editorProps: {
      attributes: { class: "text-base font-medium text-text-primary focus:outline-none" },
    },
    onCreate: ({ editor: created }) => {
      created.commands.focus();
      created.commands.setTextSelection({ from: 14, to: 24 });
      if (bold) created.commands.toggleBold();
      if (openTurnInto) {
        const click = () => {
          const trigger = document.querySelector<HTMLButtonElement>("[aria-haspopup=menu]");
          if (trigger) trigger.click();
          else requestAnimationFrame(click);
        };
        requestAnimationFrame(click);
      }
    },
  });
  return (
    <div className={`relative w-full pt-16 ${openTurnInto ? "min-h-96" : "min-h-48"}`}>
      <EditorContent editor={editor} />
      <NoteBubbleMenu editor={editor} />
    </div>
  );
}

export const SelectionMenu = () => <BubbleDemo />;
export const WithActiveMark = () => <BubbleDemo bold />;
export const TurnIntoOpen = () => <BubbleDemo openTurnInto />;
