// design: Claude-designed on request (#337)
import { useEffect, useRef } from "react";
import { NoteMarkdownMenu } from "./NoteMarkdownMenu";
import { Specimen, StoryIntro } from "@/.ladle/story-kit";
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

export const Overview = () => (
  <div className="flex max-w-prose flex-col gap-stack-lg">
    <StoryIntro what="Menu in the note header: copy as Markdown, export or delete the note." note="NoteEditor" />
    <Specimen label="Closed" hint="Button right-aligned in the header">
      <Closed />
    </Specimen>
    <Specimen label="Open">
      <MenuOpen />
    </Specimen>
  </div>
);
