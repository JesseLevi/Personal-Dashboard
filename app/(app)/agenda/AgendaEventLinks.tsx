"use client";

// design: Claude-designed (#489)
import type { MouseEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/atoms/Button";
import { Icon, type IconName } from "@/components/atoms/Icon";
import { Card } from "@/components/molecules/Card";
import { linkHref, type AgendaEventMeal, type AgendaLink, type AgendaLinkKind } from "@/lib/agenda/links";

/**
 * "Gekoppeld" in the event panel: the recipes, cards and notes linked to an
 * event, each a link with a remove button, the meals attached to it (a recipe
 * under Koppelen, ADR-0058 §2), plus the button that opens the search panel.
 * Page-level composition; see design/notes/AgendaEventLinks.md.
 */
export const LINK_KIND_ICON: Record<AgendaLinkKind, IconName> = {
  recipe: "ChefHat",
  card: "Columns3",
  note: "Notebook",
};

const rowClass =
  "flex min-w-0 flex-1 items-center gap-inline-sm rounded-control px-component-sm py-component-xs text-left text-base font-semibold text-text-primary hover:bg-surface-secondary-hover active:bg-surface-secondary-active";

export interface AgendaEventLinksProps {
  /** `null` while loading. */
  links: AgendaLink[] | null;
  /** The meals attached to the event; empty while loading. */
  meals?: AgendaEventMeal[];
  onLink: () => void;
  onUnlink: (link: AgendaLink) => void;
  /** A meal row opens the meal panel, not the recipe page. */
  onOpenMeal?: (meal: AgendaEventMeal) => void;
  /** Deletes the meal, without a confirmation (as unlinking). */
  onRemoveMeal?: (meal: AgendaEventMeal) => void;
  /** A plain click goes here (client-side navigation); a modified click keeps the browser's own. */
  onNavigate?: (href: string) => void;
  disabled?: boolean;
}

export function AgendaEventLinks({ links, meals = [], onLink, onUnlink, onOpenMeal, onRemoveMeal, onNavigate, disabled }: AgendaEventLinksProps) {
  const t = useTranslations("components.agendaEventLinks");
  const tSlots = useTranslations("components.mealPanel.slots");

  function handleClick(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (!onNavigate) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    onNavigate(href);
  }

  return (
    <Card
      title={t("title")}
      settings={
        <Button variant="filled" icon="Plus" onClick={onLink} disabled={disabled || links === null}>
          {t("linkLabel")}
        </Button>
      }
    >
      {links === null && <p className="text-base font-semibold text-text-secondary">{t("loadingLabel")}</p>}
      {links?.length === 0 && meals.length === 0 && <p className="text-base font-semibold text-text-secondary">{t("emptyLabel")}</p>}
      {links && links.length + meals.length > 0 && (
        <ul className="flex flex-col gap-stack-sm">
          {links.map((link) => {
            const href = linkHref(link.kind, link.targetId);
            const title = link.title.trim() || t("untitled");
            return (
              <li key={link.id} className="flex items-center gap-inline-sm">
                <a href={href} onClick={(event) => handleClick(event, href)} className={rowClass}>
                  <Icon name={LINK_KIND_ICON[link.kind]} size={20} className="shrink-0 text-text-secondary" />
                  <span className="sr-only">{t(`kinds.${link.kind}`)}: </span>
                  <span className="truncate">{title}</span>
                </a>
                <Button
                  variant="transparent"
                  size="compact"
                  icon="X"
                  aria-label={t("unlinkLabel", { title })}
                  onClick={() => onUnlink(link)}
                  disabled={disabled}
                />
              </li>
            );
          })}
          {meals.map((meal) => {
            const title = meal.title.trim() || t("untitled");
            return (
              <li key={meal.id} className="flex items-center gap-inline-sm">
                <button type="button" onClick={() => onOpenMeal?.(meal)} className={rowClass}>
                  <Icon name={LINK_KIND_ICON.recipe} size={20} className="shrink-0 text-text-secondary" />
                  <span className="sr-only">{t("mealKind")}: </span>
                  <span className="truncate">
                    {title} · {tSlots(meal.slot)}
                  </span>
                </button>
                <Button
                  variant="transparent"
                  size="compact"
                  icon="X"
                  aria-label={t("removeMealLabel", { title })}
                  onClick={() => onRemoveMeal?.(meal)}
                  disabled={disabled}
                />
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
