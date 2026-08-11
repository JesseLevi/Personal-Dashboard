// figma: node-id=3670:1696
import clsx from "clsx";
import type { ReactNode } from "react";

/**
 * Molecule/Card-content/Ticket — Figma component "Card-content/Ticket"
 * (node-id 3670:1696, Molecules section; Te-Doen module).
 * TEXT "HBO Wachtwoord updaten" -> `title`; SLOT "Slot" -> required `children`
 * (composer-supplied `Atom/Tag` instances — not a typed `priority`/`labels`
 * prop, since the node binds no Figma property to either sampled Tag).
 * No variant/state axis; `clsx` merges className.
 * — see design/notes/CardContentTicket.md
 */
export interface CardContentTicketProps {
  /** Figma TEXT "HBO Wachtwoord updaten" — ticket title. */
  title: string;
  /**
   * Figma SLOT "Slot" — one or more `Atom/Tag` instances (priority pill,
   * size/other labels). Composer-controlled, same as `Card`'s content slot.
   */
  children: ReactNode;
  className?: string;
}

export function CardContentTicket({
  title,
  children,
  className,
}: CardContentTicketProps) {
  return (
    <div className={clsx("flex w-full flex-col justify-center gap-4 p-3", className)}>
      <p className="w-full text-base font-semibold text-text-primary">{title}</p>
      <div className="flex w-full flex-wrap gap-2">{children}</div>
    </div>
  );
}
