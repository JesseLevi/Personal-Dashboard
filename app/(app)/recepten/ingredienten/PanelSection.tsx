// design: Claude-designed on request (#350), design/notes/IngredientAdminPage.md.
import type { ReactNode } from "react";

// One field group inside the admin panels: a semibold heading, an optional muted hint, then the fields.
export function PanelSection({ heading, hint, children }: { heading: string; hint?: string; children: ReactNode }) {
  return (
    <section className="flex w-full flex-col gap-stack-md">
      <div className="flex flex-col gap-stack-xs">
        <h3 className="text-base font-semibold text-text-primary">{heading}</h3>
        {hint && <p className="text-base text-text-secondary">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

export function PanelTitle({ children }: { children: ReactNode }) {
  // SidePanel's own sr-only h2 names the dialog; this visible copy is hidden from screen readers.
  return (
    <p aria-hidden="true" className="text-xl font-semibold text-text-primary">
      {children}
    </p>
  );
}
