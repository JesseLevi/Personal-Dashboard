import { NoteEditorSkeleton } from "../../_components/skeletons/NoteEditorSkeleton";

// Route-segment Suspense fallback for the note editor page —
// docs/open-questions.md#note-editor-skeleton-undesigned.
export default function Loading() {
  return <NoteEditorSkeleton />;
}
