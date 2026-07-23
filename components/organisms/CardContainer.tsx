// figma: node-id=3650:1297
import clsx from "clsx";
import type { ReactNode } from "react";
import { Icon } from "../atoms/Icon";
import { Button } from "../atoms/Button";

/**
 * Organism/Card-container — Figma component "Card-container" (node-id
 * 3650:1297). Kanban column: header (`Name`/`Hoeveelheid` text props ->
 * `name`/`count`; fixed Croissant icon + Plus/Pencil `Button`s — not
 * props, no variant axis on this node) above SLOT "Content" -> `children`
 * (real `Card` instances, composed not re-implemented). No CVA — no
 * variant/state axis, `clsx` merges the caller's `className`.
 * Full Figma structure, colours, history: design/notes/CardContainer.md.
 */
export interface CardContainerProps {
  /** Figma `Name` prop (default "Ontbijt") — column title. */
  name: string;
  /** Figma `Hoeveelheid` prop (default "4") — count shown beside the name. */
  count: string;
  /** Accessible label for the always-visible icon-only add button (composer-supplied, from next-intl). */
  addLabel: string;
  /** Forwarded to the add button's `onClick`. */
  onAdd?: () => void;
  /** Accessible label for the always-visible icon-only edit button (composer-supplied, from next-intl). */
  editLabel: string;
  /** Forwarded to the edit button's `onClick`. */
  onEdit?: () => void;
  /** Figma SLOT "Content" — the column's cards, typically `Card` instances wrapping `Card-content/*` molecules. */
  children: ReactNode;
  className?: string;
}

export function CardContainer({
  name,
  count,
  addLabel,
  onAdd,
  editLabel,
  onEdit,
  children,
  className,
}: CardContainerProps) {
  return (
    <div
      className={clsx(
        "flex w-full flex-col rounded-3xl bg-surface-raised px-3 pb-3",
        className,
      )}
    >
      <div className="flex items-center justify-between px-2">
        <div className="flex h-12 items-center gap-4">
          <Icon name="Croissant" className="text-text-muted" />
          <p className="text-base font-semibold text-text">{name}</p>
          <p className="text-base font-semibold text-text-muted">{count}</p>
        </div>
        <div className="flex h-12 items-center justify-end gap-2">
          {/* Button's icon-only size="default" already matches Figma's
              40x40 structurally (#75, fixed in Button.tsx) — no local size
              override needed here. */}
          <Button
            variant="filled"
            icon="Plus"
            aria-label={addLabel}
            onClick={onAdd}
          />
          <Button
            variant="filled"
            icon="Pencil"
            aria-label={editLabel}
            onClick={onEdit}
          />
        </div>
      </div>
      <div className="flex flex-1 flex-col justify-center gap-2">
        {children}
      </div>
    </div>
  );
}
