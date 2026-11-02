"use client";

// design: Claude-designed (#486, #529, #550)
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/ui/cn";

// The shell gives its pages no definite height, so the calendar frame gets one
// from the viewport minus the chrome above it; the grid scrolls inside. The
// calendar fills the width; the plan tray (#487) is a mode ("Plannen"). Open,
// it sits beside the calendar from `lg`, but only once the page itself is at
// least 44rem wide (the sidebar and page padding eat most of a tablet
// landscape); under it otherwise. The container query keeps the calendar from
// being squeezed. Closed, the tray stays mounted (it keeps its tab and search)
// but is inert and, once the transition has played, not rendered.
//
// Beside the calendar the tray column grows from 0 to `--plan-tray-width`
// while the calendar column shrinks with it, and the tray's content slides in
// 12px and fades; the content keeps its final width so text never reflows.
// Under the calendar there is no height animation, only `animate-blur-in`.
// Durations and the curve are `--plan-tray-*` in globals.css.
//
// The day cards (ADR-0058) take a column of `--plan-tray-width` left of the planner once
// the page container is 65rem wide: the 44rem week grid, the column and one gap. They scroll
// inside the body's height. Narrower, they are a row above the planner. The planner is its
// own container, so the tray's 44rem rule applies to the room next to the column.
export function AgendaBody({
  children,
  drawer,
  drawerOpen = false,
  cards,
}: {
  children: ReactNode;
  drawer?: ReactNode;
  drawerOpen?: boolean;
  cards?: ReactNode;
}) {
  // Under the calendar the tray plays `animate-blur-in` when it opens, but not on first paint.
  const [toggled, setToggled] = useState(false);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setToggled(true);
  }, [drawerOpen]);

  const planner = (
    <div className="@container min-w-0">
      <div
        className={cn(
          "flex min-w-0 flex-col gap-stack-lg lg:@min-[44rem]:grid lg:@min-[44rem]:transition-[grid-template-columns,column-gap] lg:@min-[44rem]:ease-(--plan-tray-ease) motion-reduce:lg:@min-[44rem]:transition-none",
          drawerOpen
            ? "lg:@min-[44rem]:grid-cols-[minmax(0,1fr)_var(--plan-tray-width)] lg:@min-[44rem]:gap-x-stack-lg lg:@min-[44rem]:duration-(--plan-tray-open-duration)"
            : "lg:@min-[44rem]:grid-cols-[minmax(0,1fr)_0px] lg:@min-[44rem]:gap-x-0 lg:@min-[44rem]:duration-(--plan-tray-close-duration)",
        )}
      >
        <div className="h-[calc(100dvh-20rem)] min-h-[28rem] min-w-0 lg:@min-[44rem]:h-[calc(100dvh-14rem)]">{children}</div>
        {drawer && (
          <div
            inert={!drawerOpen}
            className={cn(
              "h-[32rem] lg:@min-[44rem]:block lg:@min-[44rem]:h-[calc(100dvh-14rem)] lg:@min-[44rem]:min-h-[28rem] lg:@min-[44rem]:min-w-0 lg:@min-[44rem]:overflow-hidden",
              // Closed: out of the tab order and the accessibility tree once the transition is over (visibility flips after the delay).
              drawerOpen
                ? cn("lg:@min-[44rem]:visible lg:@min-[44rem]:delay-0", toggled && "animate-blur-in lg:@min-[44rem]:animate-none")
                : "hidden lg:@min-[44rem]:invisible lg:@min-[44rem]:transition-[visibility] lg:@min-[44rem]:delay-(--plan-tray-close-duration) lg:@min-[44rem]:duration-0",
            )}
          >
            <div
              className={cn(
                "h-full lg:@min-[44rem]:w-(--plan-tray-width) lg:@min-[44rem]:transition-[opacity,translate] lg:@min-[44rem]:ease-(--plan-tray-ease)",
                "motion-reduce:lg:@min-[44rem]:duration-(--blur-fade-reduced-duration) motion-reduce:lg:@min-[44rem]:ease-linear",
                drawerOpen
                  ? "lg:@min-[44rem]:translate-x-0 lg:@min-[44rem]:opacity-100 lg:@min-[44rem]:duration-(--plan-tray-open-duration)"
                  : "lg:@min-[44rem]:translate-x-(--plan-tray-shift) lg:@min-[44rem]:opacity-0 lg:@min-[44rem]:duration-(--plan-tray-close-duration)",
                "motion-reduce:lg:@min-[44rem]:translate-x-0",
              )}
            >
              {drawer}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="@container min-w-0 pr-page-right-equal">
      <div
        className={cn(
          "flex min-w-0 flex-col gap-stack-lg",
          cards && "lg:@min-[65rem]:grid lg:@min-[65rem]:grid-cols-[var(--plan-tray-width)_minmax(0,1fr)] lg:@min-[65rem]:items-start",
        )}
      >
        {cards && (
          <div className="min-w-0 lg:@min-[65rem]:h-[calc(100dvh-14rem)] lg:@min-[65rem]:min-h-[28rem] lg:@min-[65rem]:overflow-y-auto">
            {cards}
          </div>
        )}
        {planner}
      </div>
    </div>
  );
}
