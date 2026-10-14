import { AgendaPageSkeleton } from "./AgendaPageSkeleton";

// Route-segment fallback for a hard navigation; page.tsx streams the same skeleton.
export default function Loading() {
  return <AgendaPageSkeleton />;
}
