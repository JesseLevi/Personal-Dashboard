// figma: node-id=3878:7959
import clsx from "clsx";
import type { ReactNode } from "react";

/**
 * Organism/PageHeader — the "Header" frame shared by every (app) page design
 * (Recepten `3672:1580`, Te-Doen desktop `3878:7959`, Te-Doen mobile
 * `3680:1438`), not a Figma Component/ComponentSet — modelled as slots since
 * the two pages fill it with different buttons. `title` is caller-supplied
 * data (e.g. the active board's real name), never a translation key — see
 * design/notes/PageHeader.md.
 *
 * Sticky (#102): Figma can't express `position: sticky`, only that Header
 * is a sibling of Carousel, not a wrapper around it — the sticky behaviour
 * itself is this codebase's own call, applied to every caller. `bg-surface-
 * muted` (matching `main`'s own background) keeps scrolling cards from
 * showing through underneath it. See design/notes/PageHeader.md.
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
        "sticky top-0 flex items-center justify-between bg-surface-muted pr-4 md:pr-32",
        className,
      )}
    >
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-semibold text-text">{title}</h1>
        {titleAdornments}
      </div>
      {actions}
    </header>
  );
}
