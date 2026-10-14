// figma: node-id=3670:1696
import { cn } from "@/lib/ui/cn";
import type { ReactNode } from "react";
import { Icon } from "../atoms/Icon";
import { Tag } from "../atoms/Tag";

/**
 * Molecule/Card-content/Ticket — Figma component "Card-content/Ticket"
 * (node-id 3670:1696, Molecules section; Te-Doen module).
 * TEXT "HBO Wachtwoord updaten" -> `title`; SLOT "Slot" -> required `children`
 * (composer-supplied `Atom/Tag` instances — not a typed `priority`/`labels`
 * prop, since the node binds no Figma property to either sampled Tag).
 * No variant/state axis; `cn` merges className.
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
  /** Compact day the card is planned for ("za"), shown after the slot as a highlight Tag. Not the deadline. */
  plannedLabel?: string;
  /** Screen-reader prefix for `plannedLabel` ("Gepland op"). */
  plannedCaption?: string;
  className?: string;
}

export function CardContentTicket({
  title,
  children,
  plannedLabel,
  plannedCaption,
  className,
}: CardContentTicketProps) {
  return (
    // spacing-flag: `gap-4` stays raw (#205): root itemSpacing (16px) has no bound
    // variable in the fetched node. See design/notes/CardContentTicket.md.
    <div className={cn("flex w-full flex-col justify-center gap-4 p-component-md", className)}>
      <p className="w-full text-base font-semibold text-text-primary">{title}</p>
      {/* spacing-flag: `gap-2` stays raw: "Slot"'s itemSpacing (8px) is likewise unbound. design/notes/CardContentTicket.md. */}
      <div className="flex w-full flex-wrap gap-2">
        {children}
        {plannedLabel && (
          <Tag variant="highlight">
            <Icon name="Calendar" />
            {plannedCaption && <span className="sr-only">{plannedCaption}</span>}
            {plannedLabel}
          </Tag>
        )}
      </div>
    </div>
  );
}
