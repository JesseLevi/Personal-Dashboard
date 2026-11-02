// design: Claude-designed (#486)
"use client";

import { useTranslations } from "next-intl";
import { AgendaCalendarSkeleton } from "@/components/organisms/AgendaCalendarSkeleton";
import { DEFAULT_AGENDA_VIEW, type AgendaView } from "@/lib/agenda/view";
import { EnterFromLoginSkeleton } from "../te-doen/EnterFromLoginSkeleton";
import { AgendaBody } from "./AgendaBody";
import { AgendaDayCardsSkeleton } from "./AgendaDayCards";
import { AgendaHeader, toToggleView } from "./AgendaHeader";

// The real header with inert handlers, so nothing moves when the page arrives. The cards
// are placeholders in their own column, so the calendar keeps its width (ADR-0059).
export function AgendaPageSkeleton({ view = DEFAULT_AGENDA_VIEW }: { view?: AgendaView }) {
  const t = useTranslations("nav");
  const noop = () => {};
  return (
    <EnterFromLoginSkeleton>
      <div className="flex flex-col gap-page-stack">
        <AgendaHeader
          title={t("agenda")}
          view={toToggleView(view)}
          onViewChange={noop}
          onPrevious={noop}
          onNext={noop}
          onToday={noop}
          onNew={noop}
        />
        <AgendaBody cards={<AgendaDayCardsSkeleton />}>
          <AgendaCalendarSkeleton />
        </AgendaBody>
      </div>
    </EnterFromLoginSkeleton>
  );
}
