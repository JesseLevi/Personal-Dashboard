// design: Claude-designed on request (#331)
import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { noteExtensions } from "@/lib/notes/extensions";
import { requestLinkPopover } from "@/lib/notes/link-popover";
import { LinkPopover } from "./LinkPopover";
import { StoryIntro } from "@/.ladle/story-kit";
import type { StoryDefault } from "@ladle/react";

export default { title: "Notities / Editor / Link popover" } satisfies StoryDefault;

const content = '<p>Lees meer op <a href="https://example.com/recepten">de receptenpagina</a> of mail ons.</p>';

// `select` places the cursor/selection before the popover is requested; the
// "Edit" variant additionally clicks the popover's edit button.
function LinkPopoverDemo({ select, edit = false }: { select: [number, number]; edit?: boolean }) {
  const editor = useEditor({
    extensions: noteExtensions,
    content,
    immediatelyRender: false,
    editorProps: {
      attributes: { class: "text-base font-medium text-text-primary focus:outline-none" },
    },
  });
  useEffect(() => {
    if (!editor) return;
    let frame = 0;
    let step = 0;
    const run = () => {
      if (step === 0) {
        editor.commands.focus();
        editor.commands.setTextSelection({ from: select[0], to: select[1] });
        requestLinkPopover(editor, null);
        step = edit ? 1 : 2;
      } else if (step === 1) {
        const button = Array.from(document.querySelectorAll<HTMLButtonElement>("[role=dialog] button")).find(
          (el) => el.textContent === "Bewerken",
        );
        if (!button) return void (frame = requestAnimationFrame(run));
        button.click();
        step = 2;
      }
      if (step < 2) frame = requestAnimationFrame(run);
    };
    frame = requestAnimationFrame(run);
    return () => cancelAnimationFrame(frame);
  }, [editor, select, edit]);
  return (
    <div className="relative min-h-72 w-full pt-4">
      <EditorContent editor={editor} />
      <LinkPopover editor={editor} />
    </div>
  );
}

// Cursor in plain text, no link: URL field, apply only.
export const Empty = () => <LinkPopoverDemo select={[3, 3]} />;
// Text selected, no link yet.
export const SelectedText = () => <LinkPopoverDemo select={[3, 8]} />;
// Cursor inside the link: URL with open, edit, remove.
export const ExistingLink = () => <LinkPopoverDemo select={[22, 22]} />;
// Same link after "Edit": field prefilled, apply and remove.
export const EditingLink = () => <LinkPopoverDemo select={[22, 22]} edit />;

// The popover with the cursor inside an existing link.
export const Overview = () => (
  <div className="flex max-w-prose flex-col gap-stack-md">
    <StoryIntro
      what="Popover to add, open, edit or remove a link in a note. It follows the cursor, or opens on the link shortcut."
      note="NoteEditor"
    />
    <ExistingLink />
  </div>
);
