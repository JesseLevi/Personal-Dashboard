"use client";

// design: Claude-designed (#488)
import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useFormatter, useTranslations } from "next-intl";
import { Dropdown } from "@/components/atoms/Dropdown";
import { InputField } from "@/components/atoms/InputField";
import { PlanChoices } from "@/components/molecules/PlanChoices";
import { useAgendaDraggable } from "@/components/organisms/useAgendaDraggable";
import { filterPlanCards, type PlanCard, type PlanCardGroup } from "@/lib/agenda/plan-cards";
import type { AgendaActionResult } from "@/lib/agenda/schemas";
import { PopoverBody, usePlanMenu } from "./PlanRecipeList";

export interface PlanCardListProps {
  groups: readonly PlanCardGroup[];
  /** Today in the Agenda zone, `YYYY-MM-DD`. */
  today: string;
  onPlan: (cardId: string, plannedOn: string) => Promise<AgendaActionResult<unknown>>;
  onPlanned: (title: string, plannedOn: string) => void;
}

function PlanCardRow({
  card,
  today,
  onPlan,
  onPlanned,
}: {
  card: PlanCard;
  today: string;
  onPlan: PlanCardListProps["onPlan"];
  onPlanned: PlanCardListProps["onPlanned"];
}) {
  const t = useTranslations("components.planDrawer");
  const format = useFormatter();
  const rowRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const { open, popover, close, triggerProps } = usePlanMenu(rowRef, popoverRef);

  useAgendaDraggable(rowRef, { type: "card", id: card.id, title: card.title });

  const planned = card.plannedFor
    ? format.dateTime(new Date(`${card.plannedFor}T00:00:00Z`), {
        weekday: "short",
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      })
    : null;

  return (
    <div
      ref={rowRef}
      aria-label={t("planCardLabel", { name: card.title })}
      {...triggerProps}
      className="flex cursor-grab items-center gap-inline-sm rounded-card border border-stroke-primary bg-surface-highlight-white p-component-sm"
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="truncate text-base font-semibold text-text-primary">{card.title}</p>
        <p className="truncate text-sm font-semibold text-text-secondary">
          {planned ? t("cardPlannedOn", { column: card.columnName, date: planned }) : card.columnName}
        </p>
      </div>
      {open &&
        createPortal(
          <PopoverBody popoverRef={popoverRef} style={popover.style} onClose={() => close(false)} wrapperRef={rowRef}>
            <Dropdown className="shadow-sm">
              <PlanChoices
                showSlot={false}
                today={today}
                onPlan={(plannedOn) => onPlan(card.id, plannedOn)}
                onPlanned={(plannedOn) => {
                  close(false);
                  onPlanned(card.title, plannedOn);
                }}
              />
            </Dropdown>
          </PopoverBody>,
          document.body,
        )}
    </div>
  );
}

export function PlanCardList({ groups, today, onPlan, onPlanned }: PlanCardListProps) {
  const t = useTranslations("components.planDrawer");
  const [query, setQuery] = useState("");
  const visible = useMemo(() => filterPlanCards(groups, query), [groups, query]);

  return (
    <>
      {query ? (
        <InputField
          id="plan-cards-search"
          aria-label={t("cardsSearchLabel")}
          placeholder={t("cardsSearchPlaceholder")}
          leadingIcon="Search"
          trailingIcon="X"
          trailingIconLabel={t("searchClearLabel")}
          onTrailingIconClick={() => setQuery("")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      ) : (
        <InputField
          id="plan-cards-search"
          aria-label={t("cardsSearchLabel")}
          placeholder={t("cardsSearchPlaceholder")}
          leadingIcon="Search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      )}
      <p className="text-sm font-semibold text-text-secondary">{t("cardsDragHint")}</p>
      {visible.length === 0 ? (
        <p className="text-base font-semibold text-text-secondary">{groups.length === 0 ? t("cardsEmpty") : t("noCards")}</p>
      ) : (
        visible.map((group) => (
          <section key={group.boardId} aria-label={group.boardName} className="flex flex-col gap-stack-sm">
            <h3 className="text-sm font-semibold text-text-secondary">{group.boardName}</h3>
            <ul className="flex flex-col gap-stack-md">
              {group.cards.map((card) => (
                <li key={card.id}>
                  <PlanCardRow card={card} today={today} onPlan={onPlan} onPlanned={onPlanned} />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </>
  );
}
