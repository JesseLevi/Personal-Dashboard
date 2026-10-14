// design: Claude-designed (#485)
import { useTranslations } from "next-intl";
import { cn } from "@/lib/ui/cn";

const BREATHE = "animate-breathe motion-reduce:animate-none";
const DAYS = [0, 1, 2, 3, 4, 5, 6];
const ROWS = [0, 1, 2, 3, 4, 5, 6];
// [row, day] cells that carry a placeholder item.
const ITEMS = new Set(["1:0", "1:2", "1:4", "1:6", "4:1", "4:4"]);

const cell = (day: number) => cn("flex-1", day > 2 && "max-md:hidden", day > 0 && "border-s border-stroke-lines");

/** Week grid with the data hidden: day headers, hour rows and a few item blocks. Three days below `md`. */
export function AgendaCalendarSkeleton({ className }: { className?: string }) {
  const t = useTranslations("common");
  return (
    <div className={cn("h-full min-h-0", className)}>
      <span role="status" className="sr-only">
        {t("loading")}
      </span>
      <div
        aria-hidden="true"
        inert
        className="flex h-full min-h-0 flex-col overflow-clip rounded-card border border-stroke-primary bg-surface-highlight-white"
      >
        <div className="flex border-b border-stroke-lines">
          <div className="w-16 shrink-0 border-e border-stroke-lines" />
          {DAYS.map((day) => (
            <div key={day} className={cn(cell(day), "flex items-center justify-center p-component-md")}>
              <div className={cn("h-component-lg w-16 rounded-control-inner bg-surface-secondary", BREATHE)} />
            </div>
          ))}
        </div>
        <div className="flex min-h-0 flex-1 flex-col">
          {ROWS.map((row) => (
            <div key={row} className="flex flex-1 border-b border-stroke-lines last:border-b-0">
              <div className="w-16 shrink-0 border-e border-stroke-lines" />
              {DAYS.map((day) => (
                <div key={day} className={cn(cell(day), "p-component-xs")}>
                  {ITEMS.has(`${row}:${day}`) && (
                    <div className={cn("h-full rounded-control-inner bg-surface-primary", BREATHE)} />
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
