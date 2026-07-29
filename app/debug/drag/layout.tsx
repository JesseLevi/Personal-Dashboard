import type { Metadata } from "next";

// TEMPORARY DIAGNOSTIC ROUTE — #117 ("Diagnose: meet op iOS Safari waarom de
// 2s long-press geen drag start"). This is a measurement instrument, not a
// feature: an on-screen event log the user reads on their own phone (no
// devtools there) to answer #117's decision tree after #115 and #116 both
// reasoned about mobile long-press without ever watching a device. Delete
// the whole `app/debug/` directory once the diagnosis lands — nothing here
// is meant to survive into the real app (see docs/HANDOFF.md). `noindex`
// keeps a route that needs no auth out of search regardless.
export const metadata: Metadata = {
  title: "Drag-diagnose (#117)",
  robots: { index: false, follow: false },
};

export default function DebugDragLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
