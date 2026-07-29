import { DragDiagnostic } from "./DragDiagnostic";

// TEMPORARY — #117. See layout.tsx in this same directory for scope/removal
// notes. Thin on purpose: metadata needs a server component, the diagnostic
// itself needs browser APIs (pointer/touch listeners, performance.now), so
// the split follows the same server/client boundary rule as the rest of the
// app (CLAUDE.md).
export default function DebugDragPage() {
  return <DragDiagnostic />;
}
