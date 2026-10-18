// design: Claude-designed (#486)
import type { ReactNode } from "react";

// The shell gives its pages no definite height, so the calendar frame gets one
// from the viewport minus the chrome above it; the grid scrolls inside. The
// drawer (#487) sits beside it from `lg`, but only once the page itself is at
// least 44rem wide (the sidebar and page padding eat most of a tablet
// landscape); under it otherwise. The container query keeps the calendar from
// being squeezed.
export function AgendaBody({ children, drawer }: { children: ReactNode; drawer?: ReactNode }) {
  return (
    <div className="@container min-w-0 pr-page-right-equal">
      <div className="flex min-w-0 flex-col gap-stack-lg lg:@min-[44rem]:flex-row">
        <div className="h-[calc(100dvh-20rem)] min-h-[28rem] min-w-0 lg:@min-[44rem]:h-[calc(100dvh-14rem)] lg:@min-[44rem]:flex-1">
          {children}
        </div>
        {drawer && (
          <div className="h-[32rem] lg:@min-[44rem]:h-[calc(100dvh-14rem)] lg:@min-[44rem]:min-h-[28rem] lg:@min-[44rem]:w-80 lg:@min-[44rem]:shrink-0">
            {drawer}
          </div>
        )}
      </div>
    </div>
  );
}
