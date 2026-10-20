// design: Claude-designed (#558)
"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { addDays, startOfWeek } from "@/lib/agenda/time";
import { cn } from "@/lib/ui/cn";

export interface AgendaDayStripProps {
  /** The shown day, `YYYY-MM-DD`. */
  date: string;
  /** Today in the Agenda zone, `YYYY-MM-DD`. */
  today: string;
  onSelect: (date: string) => void;
  className?: string;
}

// How long the strip must stay still before a settled swipe counts.
const SETTLE_MS = 120;

const utc = (date: string) => new Date(`${date}T00:00:00Z`);

/**
 * The week strip below `lg`: three weeks side by side in a snapping scroller,
 * the shown week in the middle. A swipe that settles on a neighbour week moves
 * the shown day by a week; the strip then re-centres before paint.
 */
export function AgendaDayStrip({ date, today, onSelect, className }: AgendaDayStripProps) {
  const t = useTranslations("components.pageHeader.agenda");
  const format = useFormatter();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const settleRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const monday = startOfWeek(date);
  const weeks = [-7, 0, 7].map((offset) => addDays(monday, offset));

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (scroller) scroller.scrollLeft = scroller.clientWidth;
  }, [monday]);

  useEffect(() => () => clearTimeout(settleRef.current), []);

  function handleScroll() {
    clearTimeout(settleRef.current);
    settleRef.current = setTimeout(() => {
      const scroller = scrollerRef.current;
      if (!scroller || scroller.clientWidth === 0) return;
      const page = Math.round(scroller.scrollLeft / scroller.clientWidth);
      if (page !== 1) onSelect(addDays(date, (page - 1) * 7));
    }, SETTLE_MS);
  }

  return (
    <div
      ref={scrollerRef}
      onScroll={handleScroll}
      role="group"
      aria-label={t("dayStripLabel")}
      className={cn("flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", className)}
    >
      {weeks.map((weekStart) => (
        <div key={weekStart} className="grid w-full shrink-0 snap-start snap-always grid-cols-7" inert={weekStart !== monday}>
          {Array.from({ length: 7 }, (_, index) => {
            const day = addDays(weekStart, index);
            const selected = day === date;
            const isToday = day === today;
            return (
              <button
                key={day}
                type="button"
                onClick={() => onSelect(day)}
                aria-pressed={selected}
                aria-current={isToday ? "date" : undefined}
                aria-label={format.dateTime(utc(day), { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })}
                className={cn(
                  "mx-auto flex w-11 flex-col items-center gap-stack-xs rounded-control border border-transparent py-component-xs",
                  selected && "border-stroke-primary bg-surface-highlight-white",
                )}
              >
                <span className={cn("text-xs font-semibold", isToday ? "text-event-red-text" : "text-text-secondary")}>
                  {format.dateTime(utc(day), { weekday: "narrow", timeZone: "UTC" })}
                </span>
                <span className={cn("text-lg font-semibold", isToday ? "text-event-red-text" : selected ? "text-text-primary" : "text-text-secondary")}>
                  {format.dateTime(utc(day), { day: "numeric", timeZone: "UTC" })}
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
