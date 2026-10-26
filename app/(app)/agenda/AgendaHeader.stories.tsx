import { useState } from "react";
import { AgendaHeader, type AgendaToggleView } from "./AgendaHeader";
import { Specimen, Specimens, StoryIntro } from "@/.ladle/story-kit";
import type { StoryDefault } from "@ladle/react";

export default { title: "Agenda / Agenda header" } satisfies StoryDefault;

const noop = () => {};
const weekToBasket = { onSend: async () => ({ success: true as const, data: undefined }), baskets: [{ id: "own", name: "Boodschappen", shared: false }] };

const handlers = {
  date: "2026-01-01",
  today: "2026-01-01",
  onGoToDate: noop, onViewChange: noop, onPrevious: noop, onNext: noop, onToday: noop, onTrayToggle: noop, onNew: noop, onOpenCalendars: noop };

export const Overview = () => (
  <div>
    <StoryIntro
      what="The agenda page header: period title with date picker, view toggle, navigation, the plan tray toggle and the + Nieuw button."
      note="AgendaPage"
    />
    <Specimens>
      <Specimen label="Week" hint="Plannen off">
        <div className="w-[60rem]">
          <AgendaHeader title="29 dec – 4 jan" view="week" weekNumber={1} trayOpen={false} weekToBasket={weekToBasket} {...handlers} />
        </div>
      </Specimen>
      <Specimen label="Tray open" hint="Plannen pressed">
        <div className="w-[60rem]">
          <AgendaHeader title="29 dec – 4 jan" view="week" weekNumber={1} trayOpen weekToBasket={weekToBasket} {...handlers} />
        </div>
      </Specimen>
      <Specimen label="Month" hint="no week number">
        <div className="w-[60rem]">
          <AgendaHeader title="januari 2026" view="month" trayOpen={false} {...handlers} />
        </div>
      </Specimen>
    </Specimens>
  </div>
);

// Not screenshot-stable by design: the toggle animates.
export const Interactive = () => {
  const [view, setView] = useState<AgendaToggleView>("month");
  return (
    <AgendaHeader
      title={`januari 2026 (${view})`}
      view="month"
      trayOpen={false}
      {...handlers}
      onViewChange={setView}
    />
  );
};

// The mobile shape (toggle on its own row) follows the viewport, not the
// container, so it is only checkable in a narrow window (design/notes/AgendaPage.md).
export const Desktop = () => (
  <AgendaHeader title="29 dec – 4 jan" view="week" weekNumber={1} trayOpen={false} weekToBasket={weekToBasket} {...handlers} />
);

// Short ranges, the longest realistic ones across a month boundary, keep the title row to one line with the week number.
export const ThreeDay = () => <AgendaHeader title="20–22 okt" view="week" weekNumber={43} trayOpen={false} {...handlers} />;
export const ThreeDayAcrossMonths = () => (
  <AgendaHeader title="30 dec – 1 jan" view="week" weekNumber={53} trayOpen={false} {...handlers} />
);

export const TrayOpen = () => (
  <AgendaHeader title="29 dec – 4 jan" view="week" weekNumber={1} trayOpen weekToBasket={weekToBasket} {...handlers} />
);

export const MonthSelected = () => <AgendaHeader title="januari 2026" view="month" trayOpen={false} {...handlers} />;

// The menu is portalled and positioned from the trigger's real box.
export const MenuOpen = () => (
  <div className="h-60">
    <AgendaHeader title="29 dec – 4 jan" view="week" weekNumber={1} trayOpen={false} weekToBasket={weekToBasket} defaultMenuOpen {...handlers} />
  </div>
);

export const ShortcutsOpen = () => (
  <div className="h-96">
    <AgendaHeader title="29 dec – 4 jan" view="week" weekNumber={1} trayOpen={false} weekToBasket={weekToBasket} defaultMenuOpen defaultMenuStep="shortcuts" {...handlers} />
  </div>
);

// The native date field shows the browser's own format; the popover hangs from the title.
export const DatePickerOpen = () => (
  <div className="h-60">
    <AgendaHeader title="29 dec – 4 jan" view="week" weekNumber={1} trayOpen={false} weekToBasket={weekToBasket} defaultPickerOpen {...handlers} />
  </div>
);
