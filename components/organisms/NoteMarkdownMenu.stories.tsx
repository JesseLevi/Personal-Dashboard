// design: Claude-designed on request (#337)
import { useEffect, useRef } from "react";
import { NoteMarkdownMenu } from "./NoteMarkdownMenu";
import type { StoryDefault } from "@ladle/react";

export default { title: "Notities / Editor / Note markdown menu" } satisfies StoryDefault;

// Mirrors the note header: the menu button sits right-aligned in the header.
function Demo({ open }: { open: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => ref.current?.querySelector<HTMLButtonElement>("[aria-haspopup=menu]")?.click());
    return () => cancelAnimationFrame(frame);
  }, [open]);
  return (
    <div ref={ref} className="flex min-h-48 w-full items-start justify-end gap-4">
      <NoteMarkdownMenu onCopy={() => {}} onExport={() => {}} onDelete={() => {}} />
    </div>
  );
}

export const Closed = () => <Demo open={false} />;
export const MenuOpen = () => <Demo open />;
