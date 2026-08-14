import { NoteEditorSkeleton } from "../../_components/PageSkeleton";

// #233: route-segment Suspense fallback for the note editor page — same
// shape as app/(app)/recepten/[recipeId]/loading.tsx, see that file's
// comment and PageSkeleton.tsx.
export default function Loading() {
  return <NoteEditorSkeleton />;
}
