// figma: node-id=3670:1696
import clsx from "clsx";
import type { ReactNode } from "react";

/**
 * Molecule/Card-content/Ticket — Figma component "Card-content/Ticket"
 * (node-id 3670:1696, Molecules section; Te-Doen module). Renders one
 * task-list ticket: a title, plus a wrapping row of `Atom/Tag` pills for
 * priority and any other labels. Slots into the `Card` molecule's SLOT
 * "Type", same composition pattern as `Card-content/Recipi` and
 * `Card-content/Ingredient`.
 *
 * Figma structure, mirrored 1:1 (single COMPONENT, no variant/state axis,
 * so no CVA — `clsx` merges the caller's `className`, same as
 * `Card`/`CardContentRecipe`):
 *   root (column, padding 12px, gap 16px, hug/hug standalone -> w-full in
 *         composition, same "hug on canvas, fill in context" reasoning
 *         `CardContentRecipe`/`CardContentIngredient` already document)
 *   ├─ TEXT "HBO Wachtwoord updaten" — sizing horizontal:fill -> `title`
 *   │  (required; text-base/semibold -> `text-base font-semibold`)
 *   └─ SLOT "Slot" (row, wrap, gap 8px, fill width, hug height) -> `children`
 *      (required — always present in the fetched node, same as `Card`'s own
 *      SLOT "Type"). Per CLAUDE.md ("SLOT nodes -> children/named slots"),
 *      this is intentionally NOT re-modelled as a typed `priority`/`labels`
 *      prop: the fetched node holds two plain `Atom/Tag` INSTANCES with no
 *      Figma property binding either one to a "priority" concept, so the
 *      composer decides which/how many `Tag` atoms go here (a `Tag
 *      variant="medium"` priority pill plus a `Tag variant="neutral"` size
 *      label, in the sampled frame) — same reasoning `Card` already applies
 *      to its own content SLOT.
 *
 * Colours: title fill stone-950 -> `text-text`, no gap. The two fetched Tag
 * instances need no work here at all: `Color=Yellow` is an exact primitive
 * match for `Atom/Tag`'s existing `medium` variant (`priority-medium-bg`/
 * `priority-medium`, orange-50/orange-400 in design/tokens.json), and
 * `Color=Grey` is an exact match for its existing `neutral` variant
 * (`surface-muted`/`text-muted`, stone-100/stone-500) — both confirmed by
 * comparing the fetched fills against design/tokens.json's primitive values
 * (recorded in `design/notes/CardContentTicket.md`, not here — see CLAUDE.md's no-raw-hex
 * rule). Both variants already existed before this ticket, so this molecule
 * adds no new colour and flags no token gap.
 *
 * No i18n keys added: `title` and the Tag children are caller-supplied
 * ticket content (a ticket's own title/priority/labels), not fixed UI
 * chrome — same reasoning `CardContentRecipe`'s `name`/`duration` props
 * document.
 *
 * Stays a Server Component: no internal state, no event handlers, no
 * `"use client"`.
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
      <p className="w-full text-base font-semibold text-text">{title}</p>
      <div className="flex w-full flex-wrap gap-2">{children}</div>
    </div>
  );
}
