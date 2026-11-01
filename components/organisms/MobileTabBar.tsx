// design: Claude-designed on request (ADR-0055). Record: design/notes/MobileTabBar.md
import { cn } from "@/lib/ui/cn";
import { Icon, type IconName } from "../atoms/Icon";

export interface MobileTabBarItem<Id extends string> {
  id: Id;
  icon: IconName;
  label: string;
}

export interface MobileTabBarProps<Id extends string> {
  items: readonly MobileTabBarItem<Id>[];
  activeItem?: Id;
  onNavigate: (id: Id) => void;
  /** Accessible name of the `<nav>` landmark. */
  navLabel: string;
  className?: string;
}

/** Module switcher fixed to the bottom on mobile (below `md`); one tap per switch. */
export function MobileTabBar<Id extends string>({ items, activeItem, onNavigate, navLabel, className }: MobileTabBarProps<Id>) {
  return (
    <nav
      aria-label={navLabel}
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 border-t border-stroke-primary bg-surface-highlight-white pb-[env(safe-area-inset-bottom)] md:hidden",
        className,
      )}
    >
      <ul className="flex">
        {items.map((item) => {
          const active = item.id === activeItem;
          return (
            <li key={item.id} className="min-w-0 flex-1">
              <button
                type="button"
                aria-current={active ? "page" : undefined}
                aria-label={item.label}
                onClick={() => onNavigate(item.id)}
                className={cn(
                  "flex h-14 w-full flex-col items-center justify-center gap-stack-xs text-xs font-semibold",
                  active ? "text-text-primary" : "text-text-secondary",
                )}
              >
                <Icon name={item.icon} size={22} />
                <span aria-hidden className="max-w-full truncate max-[359px]:sr-only">
                  {item.label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
