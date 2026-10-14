// design: Claude-designed (#490)
"use client";

import { useState, useTransition } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Button } from "@/components/atoms/Button";
import { Card } from "@/components/molecules/Card";
import { CardContentTicket } from "@/components/molecules/CardContentTicket";
import type { CalendarActionResult, SyncNoticeView } from "@/lib/agenda/calendars";

export interface AgendaSyncNoticesProps {
  initialNotices: SyncNoticeView[];
  onResolve: (input: unknown) => Promise<CalendarActionResult>;
}

const NAMES_SHOWN = 6;

// One dismissable card per deleted event whose meal left open basket items (ADR-0037 §6).
export function AgendaSyncNotices({ initialNotices, onResolve }: AgendaSyncNoticesProps) {
  const t = useTranslations("agenda.notices");
  const tErrors = useTranslations("agenda.errors");
  const format = useFormatter();
  const [notices, setNotices] = useState(initialNotices);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function resolve(id: string, removeItems: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await onResolve({ id, removeItems });
      if (!result.success && result.error !== "not-found") {
        setError(tErrors("generic"));
        return;
      }
      setNotices((current) => current.filter((notice) => notice.id !== id));
    });
  }

  if (notices.length === 0) return null;

  return (
    <div className="flex flex-col gap-stack-md pr-page-right-equal" role="status">
      {notices.map((notice) => {
        const shown = notice.items.slice(0, NAMES_SHOWN).map((item) => item.name);
        const rest = notice.items.length - shown.length;
        const items = rest > 0 ? [...shown, t("more", { count: rest })] : shown;
        return (
          <Card key={notice.id}>
            <CardContentTicket title={t("message", { title: notice.eventTitle, items: format.list(items) })}>
              <Button icon="Trash" onClick={() => resolve(notice.id, true)} disabled={isPending}>
                {t("removeLabel")}
              </Button>
              <Button icon="X" onClick={() => resolve(notice.id, false)} disabled={isPending}>
                {t("keepLabel")}
              </Button>
            </CardContentTicket>
          </Card>
        );
      })}
      {error && <p className="text-base font-semibold text-priority-urgent">{error}</p>}
    </div>
  );
}
