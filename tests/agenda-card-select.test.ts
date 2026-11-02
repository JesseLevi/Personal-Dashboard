import { describe, expect, it } from "vitest";
import { buildCardSelectOptions, findPlanCard } from "@/lib/agenda/card-select";
import type { PlanCardGroup } from "@/lib/agenda/plan-cards";

const card = (id: string, title: string, columnName = "Te doen") => ({ id, title, columnName, plannedFor: null });
const home: PlanCardGroup = { boardId: "b1", boardName: "Huis", cards: [card("c1", "Boodschappen"), card("c2", "Verf kopen", "Bezig")] };
const work: PlanCardGroup = { boardId: "b2", boardName: "Werk", cards: [card("c3", "Offerte")] };
const empty: PlanCardGroup = { boardId: "b3", boardName: "Leeg", cards: [] };

describe("buildCardSelectOptions", () => {
  it("lists the cards flat with one board", () => {
    expect(buildCardSelectOptions([home], "Nieuwe kaart")).toEqual([
      { value: "", label: "Nieuwe kaart" },
      { value: "c1", label: "Boodschappen" },
      { value: "c2", label: "Verf kopen" },
    ]);
  });

  it("groups the cards per board, in board order, with the title only", () => {
    expect(buildCardSelectOptions([home, work], "Nieuwe kaart")).toEqual([
      { value: "", label: "Nieuwe kaart" },
      {
        label: "Huis",
        options: [
          { value: "c1", label: "Boodschappen" },
          { value: "c2", label: "Verf kopen" },
        ],
      },
      { label: "Werk", options: [{ value: "c3", label: "Offerte" }] },
    ]);
  });

  it("skips a board without cards, and stays flat when one board is left", () => {
    expect(buildCardSelectOptions([home, empty], "Nieuwe kaart")).toEqual(buildCardSelectOptions([home], "Nieuwe kaart"));
    expect(buildCardSelectOptions([empty, work, home], "Nieuwe kaart").map((entry) => entry.label)).toEqual([
      "Nieuwe kaart",
      "Werk",
      "Huis",
    ]);
  });

  it("offers only the new card without any board", () => {
    expect(buildCardSelectOptions([], "Nieuwe kaart")).toEqual([{ value: "", label: "Nieuwe kaart" }]);
  });
});

describe("findPlanCard", () => {
  it("returns the card with its board name", () => {
    expect(findPlanCard([home, work], "c3")).toEqual({ card: work.cards[0], boardName: "Werk" });
  });

  it("returns null for an unknown id", () => {
    expect(findPlanCard([home, work], "nope")).toBeNull();
  });
});
