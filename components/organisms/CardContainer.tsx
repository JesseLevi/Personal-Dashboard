// figma: node-id=3650:1297
import clsx from "clsx";
import type { ReactNode } from "react";
import { Icon, type IconName } from "../atoms/Icon";
import { Button } from "../atoms/Button";

/**
 * Organism/Card-container — Figma component "Card-container" (node-id
 * 3650:1297). Kanban column: header (`Name`/`Hoeveelheid` text props ->
 * `name`/`count`; `icon` + Plus/Pencil `Button`s — icon has no variant
 * axis on this node, real per-column icons are page-instance overrides,
 * see design/notes/CardContainer.md) above SLOT "Content" -> `children`
 * (real `Card` instances) or, when the column has none, `emptyState`
 * (Figma "EmptyState" frame, node 3878:10175). No CVA — no variant/state
 * axis, `clsx` merges the caller's `className`.
 * Full Figma structure, colours, history: design/notes/CardContainer.md.
 */
export interface CardContainerProps {
  /** Figma `Name` prop (default "Ontbijt") — column title. */
  name: string;
  /** Figma `Hoeveelheid` prop (default "4") — count shown beside the name. */
  count: string;
  /** Header icon (composer-supplied — which icon a real column gets is data, not this component's decision). Defaults to "Croissant", the icon baked into the originally fetched instance. */
  icon?: IconName;
  /** Accessible label for the always-visible icon-only add button (composer-supplied, from next-intl). */
  addLabel: string;
  /** Forwarded to the add button's `onClick`. */
  onAdd?: () => void;
  /** Accessible label for the always-visible icon-only edit button (composer-supplied, from next-intl). */
  editLabel: string;
  /** Forwarded to the edit button's `onClick`. */
  onEdit?: () => void;
  /** Figma SLOT "Content" — the column's cards, typically `Card` instances wrapping `Card-content/*` molecules. */
  children?: ReactNode;
  /** Replaces `children` when the column has no cards (composer decides when, e.g. `count === "0"`) — typically a centered add `Button`, as composed in the story. This component makes no assumption about what "empty" or "add" mean. */
  emptyState?: ReactNode;
  className?: string;
}

export function CardContainer({
  name,
  count,
  icon = "Croissant",
  addLabel,
  onAdd,
  editLabel,
  onEdit,
  children,
  emptyState,
  className,
}: CardContainerProps) {
  return (
    <div
      className={clsx(
        "flex w-full flex-col rounded-container bg-surface-secondary px-component-md pb-component-md",
        className,
      )}
    >
      <div className="flex items-center justify-between px-2">
        <div className="flex h-12 items-center gap-inline-lg">
          <Icon name={icon} className="text-text-secondary" />
          <p className="text-base font-semibold text-text-primary">{name}</p>
          <p className="text-base font-semibold text-text-secondary">{count}</p>
        </div>
        <div className="flex h-12 items-center justify-end gap-inline-sm">
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
      {/* EmptyState's Content SLOT is alignItems:center (vs. the filled
          state's stretch, node 3878:10175) — only added when emptyState
          is in play so the card-list layout is untouched. */}
      <div
        className={clsx(
          "flex flex-1 flex-col justify-center gap-stack-sm",
          emptyState && "items-center",
        )}
      >
        {emptyState ?? children}
      </div>
    </div>
  );
}
