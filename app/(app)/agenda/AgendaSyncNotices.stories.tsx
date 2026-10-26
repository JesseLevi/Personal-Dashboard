import type { CalendarActionResult, SyncNoticeView } from "@/lib/agenda/calendars";
import { AgendaSyncNotices } from "./AgendaSyncNotices";
import { StoryIntro } from "@/.ladle/story-kit";
import type { StoryDefault } from "@ladle/react";

export default { title: "Agenda / Agenda sync notices" } satisfies StoryDefault;

async function mockResolve(): Promise<CalendarActionResult> {
  return { success: true, data: undefined };
}

const notices: SyncNoticeView[] = [
  {
    id: "n1",
    eventTitle: "Etentje met Eric",
    items: [
      { id: "i1", name: "Pasta" },
      { id: "i2", name: "Tomatenpuree" },
      { id: "i3", name: "Mozzarella" },
    ],
  },
  { id: "n2", eventTitle: "Verjaardag oma", items: [{ id: "i4", name: "Slagroom" }] },
];

// The real page sits on `surface-primary`, not the story canvas.
const Surface = ({ children }: { children: React.ReactNode }) => (
  <div className="-m-8 bg-surface-primary p-8">{children}</div>
);

export const Overview = () => (
  <Surface>
    <StoryIntro
      what="Notices on the agenda page when a synced event that carried basket items was removed: keep or drop each item."
      note="AgendaPage"
    />
    <AgendaSyncNotices initialNotices={notices} onResolve={mockResolve} />
  </Surface>
);

export const Default = () => (
  <Surface>
    <AgendaSyncNotices initialNotices={notices} onResolve={mockResolve} />
  </Surface>
);

export const ManyItems = () => (
  <Surface>
    <AgendaSyncNotices
      initialNotices={[
        {
          id: "n3",
          eventTitle: "Barbecue",
          items: ["Worst", "Hamburgers", "Stokbrood", "Ketchup", "Mayonaise", "Uien", "Sla", "Komkommer"].map(
            (name, index) => ({ id: `m${index}`, name }),
          ),
        },
      ]}
      onResolve={mockResolve}
    />
  </Surface>
);
