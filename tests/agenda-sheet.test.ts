import { describe, expect, it } from "vitest";
import { DRAG_CLOSE_VELOCITY_PX_MS } from "@/lib/dom/use-sheet-drag";
import { SHEET_FLICK_MIN_PX, settleAgendaSheet } from "@/lib/agenda/sheet";

const TRAVEL = 400;
const fast = DRAG_CLOSE_VELOCITY_PX_MS + 0.1;

describe("settleAgendaSheet", () => {
  it("takes the nearest stop on a slow release", () => {
    expect(settleAgendaSheet({ from: "peek", offsetPx: -150, travelPx: TRAVEL, velocityPxMs: 0 })).toBe("peek");
    expect(settleAgendaSheet({ from: "peek", offsetPx: -250, travelPx: TRAVEL, velocityPxMs: 0 })).toBe("full");
    expect(settleAgendaSheet({ from: "full", offsetPx: 150, travelPx: TRAVEL, velocityPxMs: 0 })).toBe("full");
    expect(settleAgendaSheet({ from: "full", offsetPx: 250, travelPx: TRAVEL, velocityPxMs: 0 })).toBe("peek");
  });

  it("goes up on a fast upward flick, even after a short pull", () => {
    expect(settleAgendaSheet({ from: "peek", offsetPx: -40, travelPx: TRAVEL, velocityPxMs: -fast })).toBe("full");
  });

  it("goes down on a fast downward flick, even after a short pull", () => {
    expect(settleAgendaSheet({ from: "full", offsetPx: 40, travelPx: TRAVEL, velocityPxMs: fast })).toBe("peek");
  });

  it("ignores the speed when the pull is under the minimum", () => {
    const offsetPx = -(SHEET_FLICK_MIN_PX - 1);
    expect(settleAgendaSheet({ from: "peek", offsetPx, travelPx: TRAVEL, velocityPxMs: -fast })).toBe("peek");
  });

  it("ignores a speed under the threshold", () => {
    const velocityPxMs = -(DRAG_CLOSE_VELOCITY_PX_MS - 0.1);
    expect(settleAgendaSheet({ from: "peek", offsetPx: -60, travelPx: TRAVEL, velocityPxMs })).toBe("peek");
  });

  it("returns to the start on a flick against the pull", () => {
    expect(settleAgendaSheet({ from: "peek", offsetPx: -300, travelPx: TRAVEL, velocityPxMs: fast })).toBe("peek");
    expect(settleAgendaSheet({ from: "full", offsetPx: 300, travelPx: TRAVEL, velocityPxMs: -fast })).toBe("full");
  });

  it("clamps a pull past either end", () => {
    expect(settleAgendaSheet({ from: "peek", offsetPx: -900, travelPx: TRAVEL, velocityPxMs: 0 })).toBe("full");
    expect(settleAgendaSheet({ from: "full", offsetPx: 900, travelPx: TRAVEL, velocityPxMs: 0 })).toBe("peek");
  });
});
