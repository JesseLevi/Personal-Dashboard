import { describe, expect, it } from "vitest";
import { AGENDA_VIEWS, fitAgendaView } from "@/lib/agenda/view";

describe("fitAgendaView", () => {
  it("keeps the week when the planner is wide enough", () => {
    expect(fitAgendaView("week", 640)).toBe("week");
    expect(fitAgendaView("week", 1100)).toBe("week");
  });

  it("drops to three days, then one day, as the planner narrows", () => {
    expect(fitAgendaView("week", 639)).toBe("threeDay");
    expect(fitAgendaView("week", 352)).toBe("threeDay");
    expect(fitAgendaView("week", 351)).toBe("day");
    expect(fitAgendaView("week", 0)).toBe("day");
  });

  it("keeps the chosen view before the first measurement", () => {
    expect(fitAgendaView("week", null)).toBe("week");
  });

  it("leaves every other view alone", () => {
    for (const view of AGENDA_VIEWS.filter((v) => v !== "week")) {
      expect(fitAgendaView(view, 100)).toBe(view);
    }
  });
});
