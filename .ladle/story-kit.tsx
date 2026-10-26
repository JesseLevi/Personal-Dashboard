import type { ReactNode } from "react";

/**
 * Ladle-only scaffolding for readable stories (docs/guides/ui-components.md, "Ladle").
 * Not a product component: no design note, no Figma node. Demo copy is dev-only English.
 */

/** One sentence on what the component does, plus where its contract lives. */
export const StoryIntro = ({ what, note }: { what: string; note: string }) => (
  <header className="mb-stack-lg flex max-w-prose flex-col gap-stack-xs">
    <p className="text-base text-text-primary">{what}</p>
    <p className="text-xs text-text-secondary">design/notes/{note}.md</p>
  </header>
);

/** A grid of labelled variants. */
export const Specimens = ({ children }: { children: ReactNode }) => (
  <div className="flex flex-wrap items-start gap-stack-lg">{children}</div>
);

/** One labelled variant: `label` names it, `hint` (optional) says why it differs. */
export const Specimen = ({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) => (
  <figure className="flex flex-col gap-stack-xs">
    <figcaption className="flex flex-col">
      <span className="text-sm font-semibold text-text-primary">{label}</span>
      {hint && <span className="text-xs text-text-secondary">{hint}</span>}
    </figcaption>
    {children}
  </figure>
);

/**
 * Frame for `position: fixed` panels (SidePanel and everything built on it): it is the
 * containing block, so the panel and its scrim stay inside the canvas instead of covering
 * Ladle's controls panel and sidebar. `min-h-screen` gives the baseline crop a height.
 */
export const PanelFrame = ({ children }: { children: ReactNode }) => (
  <div className="min-h-screen [contain:layout]">{children}</div>
);
