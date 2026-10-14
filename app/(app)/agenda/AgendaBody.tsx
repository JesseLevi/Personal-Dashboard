// design: Claude-designed (#486)
import type { ReactNode } from "react";

// The shell gives its pages no definite height, so the calendar frame gets one
// from the viewport minus the chrome above it; the grid scrolls inside.
export function AgendaBody({ children }: { children: ReactNode }) {
  return (
    <div className="h-[calc(100dvh-20rem)] min-h-[28rem] min-w-0 pr-page-right-equal md:h-[calc(100dvh-14rem)]">
      {children}
    </div>
  );
}
