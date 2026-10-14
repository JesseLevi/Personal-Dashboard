// design: Claude-designed (#486)
import type { ReactNode } from "react";

// The shell gives its pages no definite height, so the calendar frame gets one
// from the viewport minus the chrome above it; the grid scrolls inside. The
// drawer (#487) sits beside it from `md`, under it below.
export function AgendaBody({ children, drawer }: { children: ReactNode; drawer?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-stack-lg pr-page-right-equal md:flex-row">
      <div className="h-[calc(100dvh-20rem)] min-h-[28rem] min-w-0 md:h-[calc(100dvh-14rem)] md:flex-1">{children}</div>
      {drawer && (
        <div className="h-[32rem] md:h-[calc(100dvh-14rem)] md:min-h-[28rem] md:w-80 md:shrink-0">{drawer}</div>
      )}
    </div>
  );
}
