// figma: node-id=3878:7959
import { cn } from "@/lib/ui/cn";
import type { ReactNode } from "react";
import { PageHeaderTitle, type PageHeaderTitleTrigger } from "./PageHeaderTitle";

/**
 * Organism/PageHeader — the "Header" frame shared by every (app) page design
 * (Recepten `3672:1580`, Te-Doen desktop `3878:7959`, Te-Doen mobile
 * `3680:1438`), not a Figma Component/ComponentSet — modelled as slots since
 * the two pages fill it with different buttons. `title` is caller-supplied
 * data, never a translation key. Sticky (#102) is this codebase's own call,
 * not a Figma-expressible property; `z-10` (#179) is a stacking-context fix.
 * `top` uses a safe-area offset, not a bare `0` (#172): see
 * design/notes/PageHeader.md and design/notes/AppShell.md.
 */
export interface PageHeaderProps {
  title: string;
  /** Skeleton only: the title is a placeholder; keep showing the outgoing name of a board switch. */
  titlePending?: boolean;
  /** Turns the title into a button (see `PageHeaderTitleTrigger`). */
  titleTrigger?: PageHeaderTitleTrigger;
  /** Rendered next to the title (Te-Doen's board-switcher + favourite buttons). */
  titleAdornments?: ReactNode;
  /** Rendered at the far right (Te-Doen's sort button, Recepten's category button). */
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, titlePending, titleTrigger, titleAdornments, actions, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        "sticky top-[env(safe-area-inset-top)] z-10 flex items-center justify-between bg-surface-primary pr-page-right-equal",
        // #172: header chrome, not reading content — see app/globals.css.
        "chrome-touch",
        // The strip over the safe area (iPhone status bar) above the stuck header, full viewport width, so scrolled content never shows through it.
        "before:pointer-events-none before:fixed before:inset-x-0 before:top-0 before:h-[env(safe-area-inset-top)] before:bg-surface-primary before:content-['']",
        className,
      )}
    >
      <div className="flex items-center gap-inline-lg">
        <PageHeaderTitle title={title} pending={titlePending} trigger={titleTrigger} />
        {titleAdornments}
      </div>
      {actions}
    </header>
  );
}
