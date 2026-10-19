// design: Claude-designed (#486)
"use client";

import { useTranslations } from "next-intl";
import { AgendaCalendarSkeleton } from "@/components/organisms/AgendaCalendarSkeleton";
import { DEFAULT_AGENDA_VIEW, type AgendaView } from "@/lib/agenda/view";
import { AgendaBody } from "./AgendaBody";
import { AgendaHeader, toToggleView } from "./AgendaHeader";

// The real header with inert handlers, so nothing moves when the page arrives.
export function AgendaPageSkeleton({ view = DEFAULT_AGENDA_VIEW }: { view?: AgendaView }) {
  const t = useTranslations("nav");
  const noop = () => {};
  return (
    <>
      <AgendaHeader
        title={t("agenda")}
        view={toToggleView(view)}
        onViewChange={noop}
        onPrevious={noop}
        onNext={noop}
        onToday={noop}
        trayOpen={false}
        onTrayToggle={noop}
        onNew={noop}
      />
      <AgendaBody>
        <AgendaCalendarSkeleton />
      </AgendaBody>
    </>
  );
}
