import { useState } from "react";
import { AgendaHeader, type AgendaToggleView } from "./AgendaHeader";

const noop = () => {};
const weekToBasket = { onSend: async () => ({ success: true as const, data: undefined }), baskets: [{ id: "own", name: "Boodschappen", shared: false }] };

// The mobile shape (toggle on its own row) follows the viewport, not the
// container, so it is only checkable in a narrow window (design/notes/AgendaPage.md).
export const Desktop = () => (
  <AgendaHeader
    title="29 dec – 4 jan"
    view="week"
    onViewChange={noop}
    onPrevious={noop}
    onNext={noop}
    onToday={noop}
    onOpenCalendars={noop}
    weekToBasket={weekToBasket}
  />
);

export const MonthSelected = () => (
  <AgendaHeader title="januari 2026" view="month" onViewChange={noop} onPrevious={noop} onNext={noop} onToday={noop} onOpenCalendars={noop} />
);

// Not screenshot-stable by design: the toggle animates.
export const Interactive = () => {
  const [view, setView] = useState<AgendaToggleView>("month");
  return (
    <AgendaHeader
      title={`januari 2026 (${view})`}
      view="month"
      onViewChange={setView}
      onPrevious={noop}
      onNext={noop}
      onToday={noop}
    />
  );
};
