// design: Claude-designed (#486)
"use client";

import { useFormatter, useTranslations } from "next-intl";
import { AgendaCalendarSkeleton } from "@/components/organisms/AgendaCalendarSkeleton";
import { useIsNarrow } from "@/components/organisms/AgendaCalendar";
import { agendaNow } from "@/lib/agenda/time";
import { DEFAULT_AGENDA_VIEW, type AgendaView } from "@/lib/agenda/view";
import { EnterFromLoginSkeleton } from "../te-doen/EnterFromLoginSkeleton";
import { AgendaBody } from "./AgendaBody";
import { AgendaDayCardsSkeleton } from "./AgendaDayCards";
import { AgendaDayStrip } from "./AgendaDayStrip";
import { AgendaHeader, toToggleView } from "./AgendaHeader";

// The real header with inert handlers, so nothing moves when the page arrives. The cards
// are placeholders in their own column, so the calendar keeps its width (ADR-0059). Below `lg` the
// header is the date opener for today and the sheet sits in peek, like the page.
export function AgendaPageSkeleton({ view = DEFAULT_AGENDA_VIEW }: { view?: AgendaView }) {
  const t = useTranslations("nav");
  const format = useFormatter();
  const narrow = useIsNarrow();
  const today = agendaNow().slice(0, 10);
  const todayUtc = new Date(`${today}T00:00:00Z`);
  const weekday = format.dateTime(todayUtc, { weekday: "long", timeZone: "UTC" });
  const noop = () => {};
  return (
    <EnterFromLoginSkeleton>
      <div className="flex flex-col gap-page-stack">
        <AgendaHeader
          title={narrow ? weekday.charAt(0).toLocaleUpperCase() + weekday.slice(1) : t("agenda")}
          subtitle={format.dateTime(todayUtc, { day: "numeric", month: "long", timeZone: "UTC" })}
          isToday
          view={toToggleView(view)}
          onViewChange={noop}
          onPrevious={noop}
          onNext={noop}
          onToday={noop}
          onNew={noop}
        />
        <AgendaBody
          cards={<AgendaDayCardsSkeleton />}
          sheet={{ stop: "peek", onStopChange: noop, strip: <AgendaDayStrip date={today} today={today} onSelect={noop} /> }}
        >
          <AgendaCalendarSkeleton />
        </AgendaBody>
      </div>
    </EnterFromLoginSkeleton>
  );
}
