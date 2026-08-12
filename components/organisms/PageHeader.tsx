// figma: node-id=3878:7959
import clsx from "clsx";
import type { ReactNode } from "react";

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
  /** Rendered next to the title (Te-Doen's board-switcher + favourite buttons). */
  titleAdornments?: ReactNode;
  /** Rendered at the far right (Te-Doen's sort button, Recepten's category button). */
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, titleAdornments, actions, className }: PageHeaderProps) {
  return (
    <header
      className={clsx(
        "sticky top-[env(safe-area-inset-top)] z-10 flex items-center justify-between bg-surface-primary pr-page-right-equal",
        // #172: header chrome, not reading content — see app/globals.css.
        "chrome-touch",
        className,
      )}
    >
      <div className="flex items-center gap-inline-lg">
        <h1 className="text-xl font-semibold text-text-primary">{title}</h1>
        {titleAdornments}
      </div>
      {actions}
    </header>
  );
}
