"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Button } from "@/components/atoms/Button";
import { Icon } from "@/components/atoms/Icon";
import { Tag } from "@/components/atoms/Tag";
import { AnimatedAddToBasketButton } from "@/components/molecules/AnimatedAddToBasketButton";
import { Card } from "@/components/molecules/Card";
import { CardContentRecipe } from "@/components/molecules/CardContentRecipe";
import { ColorDot } from "@/components/molecules/ColorSwatches";
import {
  basketSuggestion,
  groupDay,
  isEmptyDay,
  limitRows,
  timeLabel,
  timelineState,
  TIMELINE_LIMIT,
  TODO_LIMIT,
  type BasketSuggestion,
} from "@/lib/agenda/day-cards";
import type { AgendaItem } from "@/lib/agenda/types";
import type { AssistantSignal } from "@/lib/assistant/types";
import { recipeThumbnailRouteUrl } from "@/lib/recipes/thumbnail-url";
import type { BasketOption } from "@/lib/shopping/baskets";
import type { ActionResult } from "@/lib/shopping/types";
import { cn } from "@/lib/ui/cn";
import { LoadingStatus, SKELETON_BREATHE } from "../_components/skeletons/skeleton-parts";

// The day's essentials as cards (ADR-0059): timeline, meals, planned cards and deadlines,
// suggestions. Page composition; record: design/notes/AgendaPage.md.

export interface AgendaDayCardsProps {
  /** The shown day, `YYYY-MM-DD`. */
  day: string;
  /** Today in the Agenda zone, `YYYY-MM-DD`. Past, "Nu" and signals only apply when `day` is today. */
  today: string;
  /** Agenda-zone wall clock, `YYYY-MM-DDTHH:mm`. */
  now: string;
  /** The loaded items after the hidden calendars and kinds are filtered out. */
  items: readonly AgendaItem[];
  /** The day is outside the loaded window: skeleton cards until it arrives. */
  loading?: boolean;
  signals?: readonly AssistantSignal[];
  /** `meal id -> recipe id`, for the thumbnail. */
  recipeIds?: Readonly<Record<string, string>>;
  /** `recipe id -> presigned thumbnail URL`. */
  thumbnailUrls?: Readonly<Record<string, string>>;
  /** `meal id -> has a basket item`; a meal that is not listed is unknown and never suggested. */
  basket?: Readonly<Record<string, boolean>>;
  baskets?: BasketOption[];
  /** Same handler as a click in the calendar. */
  onOpenItem: (item: AgendaItem) => void;
  /** Act on (true) or dismiss (false) a signal. */
  onSignal: (signal: AssistantSignal, act: boolean) => Promise<{ success: boolean }>;
  onDayToBasket: (day: string, listId?: string) => Promise<ActionResult>;
  className?: string;
}

const utc = (day: string) => new Date(`${day}T00:00:00Z`);
/** How long the "in the basket" face stays before the suggestion goes. */
const SENT_MS = 1400;

const rowClass =
  "flex min-h-11 w-full items-center gap-inline-sm rounded-control px-component-xs text-left hover:bg-surface-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stroke-secondary-active";

function CardSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section aria-label={label}>
      <Card>{children}</Card>
    </section>
  );
}

function MoreRow({ label, expanded, onToggle }: { label: string; expanded: boolean; onToggle: () => void }) {
  return (
    <li>
      <button type="button" aria-expanded={expanded} onClick={onToggle} className={cn(rowClass, "text-sm font-semibold text-text-secondary")}>
        {label}
      </button>
    </li>
  );
}

function SuggestionCard({ text, children }: { text: string; children: ReactNode }) {
  const t = useTranslations("agenda.dayCards.labels");
  return (
    <section aria-label={t("suggestion")} className="flex flex-wrap items-center gap-inline-xs">
      {/* Tag highlight look, but the sentence may wrap, so no fixed height. */}
      <p className="inline-flex min-h-6 min-w-0 items-start gap-inline-xs rounded-control bg-tag-highlight-bg px-component-sm py-component-xs text-xs font-semibold text-tag-highlight">
        <Icon name="Sparkles" size={14} className="shrink-0" />
        <span className="min-w-0">{text}</span>
      </p>
      <div className="flex flex-wrap gap-inline-xs">{children}</div>
    </section>
  );
}

function CardsSkeleton() {
  return (
    <>
      {[0, 1].map((index) => (
        <div key={index} aria-hidden inert>
          <Card className={SKELETON_BREATHE} contentClassName="bg-surface-primary">
            <div className="h-20" />
          </Card>
        </div>
      ))}
    </>
  );
}

const gridClass = "grid grid-cols-[repeat(auto-fit,minmax(16rem,1fr))] items-start gap-stack-lg";

/** Placeholder for the cards while the page streams in (AgendaPageSkeleton). */
export function AgendaDayCardsSkeleton() {
  return (
    <div className={gridClass}>
      <CardsSkeleton />
    </div>
  );
}

export function AgendaDayCards({
  day,
  today,
  now,
  items,
  loading = false,
  signals = [],
  recipeIds = {},
  thumbnailUrls = {},
  basket = {},
  baskets,
  onOpenItem,
  onSignal,
  onDayToBasket,
  className,
}: AgendaDayCardsProps) {
  const t = useTranslations("agenda.dayCards");
  const tSlots = useTranslations("components.mealPanel.slots");
  const tAll = useTranslations();
  const format = useFormatter();
  const isToday = day === today;
  const groups = useMemo(() => groupDay(items, day), [items, day]);
  const [expanded, setExpanded] = useState({ events: false, cards: false });
  const [hiddenSignals, setHiddenSignals] = useState<ReadonlySet<string>>(new Set());
  const [declinedDays, setDeclinedDays] = useState<ReadonlySet<string>>(new Set());
  const [sent, setSent] = useState<{ day: string; suggestion: BasketSuggestion } | null>(null);
  const sentTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(sentTimer.current), []);

  const known = groups.meals.filter((meal) => meal.id in basket);
  const live = loading ? null : basketSuggestion(known, new Set(known.filter((meal) => basket[meal.id]).map((meal) => meal.id)));
  const shownBasket = declinedDays.has(day) ? null : (live ?? (sent?.day === day ? sent.suggestion : null));
  const shownSignals = isToday && !loading ? signals.filter((signal) => !hiddenSignals.has(signal.id)) : [];

  async function handleSignal(signal: AssistantSignal, act: boolean) {
    setHiddenSignals((current) => new Set(current).add(signal.id));
    const result = await onSignal(signal, act);
    if (result.success) return;
    setHiddenSignals((current) => {
      const next = new Set(current);
      next.delete(signal.id);
      return next;
    });
  }

  async function handleBasket(listId?: string): Promise<ActionResult> {
    const result = await onDayToBasket(day, listId);
    if (result.success && live) {
      setSent({ day, suggestion: live });
      clearTimeout(sentTimer.current);
      sentTimer.current = setTimeout(() => setSent(null), SENT_MS);
    }
    return result;
  }

  const events = limitRows(groups.events, TIMELINE_LIMIT, expanded.events);
  const cards = limitRows(groups.cards, TODO_LIMIT, expanded.cards);
  const thumbnail = (mealId: string, thumbnailPath: string | null) => {
    const recipeId = recipeIds[mealId];
    const route = recipeId && thumbnailPath ? recipeThumbnailRouteUrl(recipeId, thumbnailPath, "card") : undefined;
    return { imageUrl: (recipeId && thumbnailUrls[recipeId]) || route, imageFallbackUrl: route };
  };

  const weekday = format.dateTime(utc(day), { weekday: "long", timeZone: "UTC" });
  const todayLabel = format.dateTime(utc(today), { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

  return (
    <div className={cn(gridClass, className)}>
      <h2 className="col-span-full hidden text-base font-semibold text-text-primary lg:block">{t("heading", { date: todayLabel })}</h2>

      {loading && (
        <>
          <LoadingStatus />
          <CardsSkeleton />
        </>
      )}

      {!loading && isEmptyDay(groups) && (
        <p className="col-span-full text-base font-medium text-text-secondary">{t("empty", { weekday })}</p>
      )}

      {!loading && groups.events.length > 0 && (
        <CardSection label={t("labels.events")}>
          <ul>
            {events.shown.map((event, index) => {
              const state = isToday ? timelineState(event, now) : "upcoming";
              const time = timeLabel(event) ?? t("allDay");
              const last = index === events.shown.length - 1;
              return (
                <li key={event.id}>
                  <button type="button" onClick={() => onOpenItem(event)} className={rowClass}>
                    <span aria-hidden="true" className="relative flex w-4 shrink-0 items-center justify-center self-stretch">
                      <span className={cn("absolute w-px bg-stroke-lines", index === 0 ? "top-1/2" : "top-0", last ? "bottom-1/2" : "bottom-0")} />
                      <ColorDot color={event.color} className="relative size-3" />
                    </span>
                    <span className={cn("min-w-0 flex-1 truncate text-base font-semibold", state === "past" ? "text-text-secondary" : "text-text-primary")}>
                      {event.title}
                    </span>
                    <span className="shrink-0 whitespace-nowrap text-sm text-text-secondary">{time}</span>
                    {state === "now" && <Tag>{t("now")}</Tag>}
                  </button>
                </li>
              );
            })}
            {groups.events.length > TIMELINE_LIMIT && (
              <MoreRow
                label={expanded.events ? t("less") : t("more", { count: events.more })}
                expanded={expanded.events}
                onToggle={() => setExpanded((c) => ({ ...c, events: !c.events }))}
              />
            )}
          </ul>
        </CardSection>
      )}

      {!loading && groups.meals.length > 0 && (
        <CardSection label={t("labels.meals")}>
          <ul>
            {groups.meals.map((meal) => (
              <li key={meal.id}>
                <button type="button" onClick={() => onOpenItem(meal)} className={cn(rowClass, "py-component-xs")}>
                  <CardContentRecipe compact name={meal.title} meta={tSlots(meal.slot)} {...thumbnail(meal.id, meal.thumbnailPath)} />
                </button>
              </li>
            ))}
          </ul>
        </CardSection>
      )}

      {!loading && groups.cards.length > 0 && (
        <CardSection label={t("labels.cards")}>
          <ul>
            {cards.shown.map((card) => (
              <li key={`${card.kind}-${card.id}`}>
                <button type="button" onClick={() => onOpenItem(card)} className={rowClass}>
                  <Tag variant={card.kind === "deadline" ? "urgent" : "highlight"} className="min-w-20 justify-center">{card.kind === "deadline" ? t("deadline") : t("planned")}</Tag>
                  <span className="min-w-0 flex-1 truncate text-base font-semibold text-text-primary">{card.title}</span>
                </button>
              </li>
            ))}
            {groups.cards.length > TODO_LIMIT && (
              <MoreRow
                label={expanded.cards ? t("less") : t("more", { count: cards.more })}
                expanded={expanded.cards}
                onToggle={() => setExpanded((c) => ({ ...c, cards: !c.cards }))}
              />
            )}
          </ul>
        </CardSection>
      )}

      {shownBasket && (
        <SuggestionCard text={t("basketMissing", { count: shownBasket.mealIds.length, recipe: shownBasket.title })}>
          <AnimatedAddToBasketButton
            label={t("toBasket")}
            addedLabel={t("inBasket")}
            baskets={baskets}
            chooseBasketLabel={t("chooseBasket")}
            onAddToBasket={handleBasket}
            size="small"
          />
          <Button variant="outline" size="small" onClick={() => setDeclinedDays((current) => new Set(current).add(day))}>
            {t("no")}
          </Button>
        </SuggestionCard>
      )}

      {shownSignals.map((signal) => (
        <SuggestionCard key={signal.id} text={"plain" in signal.text ? signal.text.plain : tAll(signal.text.key, signal.text.values)}>
          <Button size="small" onClick={() => void handleSignal(signal, true)}>
            {tAll(signal.action.labelKey)}
          </Button>
          <Button variant="outline" size="small" onClick={() => void handleSignal(signal, false)}>
            {t("no")}
          </Button>
        </SuggestionCard>
      ))}
    </div>
  );
}
