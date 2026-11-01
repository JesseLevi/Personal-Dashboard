"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/atoms/Button";
import { Card } from "@/components/molecules/Card";

// Buy-rhythm signals above the basket (ADR-0046 §6). Adding settles the
// signal server-side; "Nee" dismisses it. Record: design/notes/WinkelmandPage.md.

export interface BasketSuggestion {
  id: string;
  item: string;
  median: number;
  days: number;
}

export interface BasketSuggestionsProps {
  suggestions: readonly BasketSuggestion[];
  /** Adds the item to the basket on screen; the composer refreshes on success. */
  onAdd: (item: string) => Promise<{ success: boolean }>;
  onDismiss: (id: string) => Promise<{ success: boolean }>;
}

export function BasketSuggestions({ suggestions, onAdd, onDismiss }: BasketSuggestionsProps) {
  const t = useTranslations("assistant.signals");
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const visible = suggestions.filter((s) => !hidden.has(s.id));
  if (visible.length === 0) return null;

  function settle(id: string, run: () => Promise<{ success: boolean }>) {
    setHidden((current) => new Set(current).add(id));
    startTransition(async () => {
      const result = await run();
      if (!result.success) {
        setHidden((current) => {
          const next = new Set(current);
          next.delete(id);
          return next;
        });
      }
    });
  }

  return (
    <div className="pr-page-right-equal">
      <Card title={t("basketTitle")}>
        <ul className="flex flex-col gap-stack-md">
          {visible.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-inline-sm">
              <p className="w-full text-base font-medium text-text-primary md:w-auto md:min-w-0 md:flex-1">
                {t("buyRhythm", { item: s.item, median: s.median, days: s.days })}
              </p>
              <div className="flex gap-inline-sm">
                <Button
                  icon="Plus"
                  disabled={isPending}
                  onClick={() => settle(s.id, () => onAdd(s.item))}
                >
                  {t("actions.addToBasket")}
                </Button>
                <Button
                  variant="outline"
                  disabled={isPending}
                  onClick={() => settle(s.id, () => onDismiss(s.id))}
                >
                  {t("actions.no")}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
