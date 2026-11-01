"use client";

import { useState, type ReactNode } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Button } from "@/components/atoms/Button";
import { Tag } from "@/components/atoms/Tag";
import { AnimatedAddToBasketButton } from "@/components/molecules/AnimatedAddToBasketButton";
import { Card } from "@/components/molecules/Card";
import { PageHeader } from "@/components/organisms/PageHeader";
import type { AssistantSignal } from "@/lib/assistant/types";
import type { BasketOption } from "@/lib/shopping/baskets";
import { clockOf, type TodayGroups } from "@/lib/today/day";
import type { ActionResult } from "@/lib/shopping/types";
import { EnterFromLogin } from "../te-doen/EnterFromLogin";

// Day overview view (ADR-0057): today's events, meals, planned cards and deadlines,
// the open basket count and new signals. Record: design/notes/VandaagPage.md.

export interface VandaagViewProps {
  /** Today in the Agenda zone, `YYYY-MM-DD`. */
  today: string;
  groups: TodayGroups;
  basketCount: number;
  signals: readonly AssistantSignal[];
  baskets: BasketOption[];
  onNavigate: (href: string) => void;
  /** Act on (true) or dismiss (false) a signal; the row hides at once. */
  onSignal: (signal: AssistantSignal, act: boolean) => void;
  onDayToBasket: (listId?: string) => Promise<ActionResult>;
}

function Section({ title, empty, children }: { title: string; empty: string | null; children: ReactNode }) {
  return (
    <Card title={title}>
      {empty ? <p className="text-base font-medium text-text-secondary">{empty}</p> : <ul className="flex flex-col gap-stack-sm">{children}</ul>}
    </Card>
  );
}

export function VandaagView({ today, groups, basketCount, signals, baskets, onNavigate, onSignal, onDayToBasket }: VandaagViewProps) {
  const t = useTranslations("vandaag");
  const tSlots = useTranslations("components.mealPanel.slots");
  const tSignals = useTranslations();
  const format = useFormatter();
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const visibleSignals = signals.filter((s) => !hidden.has(s.id));
  const agendaHref = `/agenda?date=${today}`;

  function handleSignal(signal: AssistantSignal, act: boolean) {
    setHidden((current) => new Set(current).add(signal.id));
    onSignal(signal, act);
  }

  const dateLabel = format.dateTime(new Date(`${today}T12:00:00Z`), { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

  return (
    <div className="flex w-full flex-col gap-page-stack pr-page-right-equal">
      <EnterFromLogin index={0}>
        <PageHeader title={t("title")} />
        <p className="text-base font-semibold text-text-secondary">{dateLabel}</p>
      </EnterFromLogin>
      <EnterFromLogin index={1}>
        <div className="grid w-full grid-cols-1 gap-stack-xl md:grid-cols-2">
          <Section title={t("events")} empty={groups.events.length === 0 ? t("noEvents") : null}>
            {groups.events.map((event) => (
              <li key={event.id} className="flex items-baseline gap-inline-sm">
                <span className="w-24 shrink-0 text-sm font-semibold text-text-secondary">
                  {event.allDay ? t("allDay") : event.end ? `${clockOf(event.start)}–${clockOf(event.end)}` : clockOf(event.start)}
                </span>
                <span className="min-w-0 text-base font-semibold text-text-primary">{event.title}</span>
              </li>
            ))}
          </Section>

          <Section title={t("meals")} empty={groups.meals.length === 0 ? t("noMeals") : null}>
            {groups.meals.map((meal) => (
              <li key={meal.id} className="flex items-baseline gap-inline-sm">
                <span className="w-24 shrink-0 text-sm font-semibold text-text-secondary">{tSlots(meal.slot)}</span>
                <span className="min-w-0 text-base font-semibold text-text-primary">{meal.title}</span>
              </li>
            ))}
            <li>
              <AnimatedAddToBasketButton
                label={t("dayToBasket")}
                addedLabel={t("dayToBasketAdded")}
                baskets={baskets}
                chooseBasketLabel={t("chooseBasket")}
                onAddToBasket={onDayToBasket}
              />
            </li>
          </Section>

          <Section title={t("cards")} empty={groups.cards.length === 0 ? t("noCards") : null}>
            {groups.cards.map((card) => (
              <li key={`${card.kind}-${card.id}`} className="flex items-center gap-inline-sm">
                <Tag variant={card.kind === "deadline" ? "urgent" : "highlight"}>
                  {card.kind === "deadline" ? t("deadline") : t("planned")}
                </Tag>
                <span className="min-w-0 text-base font-semibold text-text-primary">{card.title}</span>
              </li>
            ))}
          </Section>

          <Card title={t("basket")}>
            <div className="flex flex-wrap items-center justify-between gap-inline-sm">
              <p className="text-base font-semibold text-text-primary">{t("basketCount", { count: basketCount })}</p>
              <Button icon="ShoppingBasket" onClick={() => onNavigate("/winkelmand")}>
                {t("openBasket")}
              </Button>
            </div>
          </Card>

          {visibleSignals.length > 0 && (
            <div className="md:col-span-2">
              <Section title={t("signals")} empty={null}>
                {visibleSignals.map((signal) => (
                  <li key={signal.id} className="flex flex-wrap items-center justify-between gap-inline-sm">
                    <p className="w-full text-base font-medium text-text-primary md:w-auto md:min-w-0 md:flex-1">
                      {"plain" in signal.text ? signal.text.plain : tSignals(signal.text.key, signal.text.values)}
                    </p>
                    <div className="flex gap-inline-sm">
                      <Button onClick={() => handleSignal(signal, true)}>{tSignals(signal.action.labelKey)}</Button>
                      <Button variant="outline" onClick={() => handleSignal(signal, false)}>
                        {tSignals("assistant.signals.actions.dismiss")}
                      </Button>
                    </div>
                  </li>
                ))}
              </Section>
            </div>
          )}
        </div>
      </EnterFromLogin>
      <Button align="left" icon="Calendar" onClick={() => onNavigate(agendaHref)} className="w-fit">
        {t("openAgenda")}
      </Button>
    </div>
  );
}
