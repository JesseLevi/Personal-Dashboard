import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBacklinks, getNote, resolveNoteTitles } from "@/lib/notes/queries";
import { getEventRefsOrEmpty } from "@/lib/agenda/link-queries";
import { extractNoteLinkIds } from "@/lib/notes/document";
import { NoteEditor } from "./NoteEditor";

// #233: note editor route — Figma "Desktop/Notes/Edit" (3934:33463) /
// "Mobile/Notes/Edit" (3934:33422). Server Component: fetches the one note
// via `getNote` (#228, the only lib/notes/queries.ts function that reads the
// full `content` jsonb — already RLS-scoped + explicitly user-filtered).
// `notFound()` covers both "note doesn't exist" and "not this user's note",
// same precedent as app/(app)/recepten/[recipeId]/page.tsx. Full reasoning:
// design/notes/NoteEditor.md.
// #390: same manifest as /notities, so adding a single note to the home screen lands in Notities.
export const metadata: Metadata = {
  manifest: "/notities/manifest.webmanifest",
};

export default async function NoteEditorRoute({
  params,
}: {
  params: Promise<{ noteId: string }>;
}) {
  const { noteId } = await params;
  const note = await getNote(noteId);

  if (!note) notFound();

  // Keyed on note.id, same reasoning as RecipeDetailRoute's own `key`: a
  // future in-editor link straight from one note to another must fully
  // remount rather than reuse TipTap/local state from the previous note.
  // #341: current titles of the linked notes (a missing one is a deleted target) and "Gelinkt vanuit".
  const [linkTitles, backlinks, agendaEvents] = await Promise.all([
    resolveNoteTitles(extractNoteLinkIds(note.content)),
    getBacklinks(note.id),
    getEventRefsOrEmpty("note", note.id),
  ]);

  return <NoteEditor key={note.id} note={note} linkTitles={linkTitles} backlinks={backlinks} agendaEvents={agendaEvents} />;
}
