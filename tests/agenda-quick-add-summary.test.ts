import { describe, expect, it } from "vitest";
import { formatSummaryDay, quickAddSummary, type QuickAddSummaryLabels, type QuickAddSummaryValues } from "@/lib/agenda/quick-add-summary";

const labels: QuickAddSummaryLabels = {
  allDay: "hele dag",
  moment: (slot) => ({ breakfast: "ontbijt", lunch: "lunch", dinner: "diner", snack: "snack" })[slot],
  people: (names) => `Met ${names}`,
  repeat: (choice) => `herhaalt ${choice}`,
  category: (id) => (id === "cal-social" ? "Sociaal" : null),
};

const base: QuickAddSummaryValues = {
  title: "Etentje",
  date: "2026-01-02",
  allDay: false,
  start: "19:00",
  end: "20:00",
  people: "Mila",
  place: "Groningen",
  repeat: "none",
  categoryId: "cal-1",
  moment: "dinner",
  pickedTitle: "",
};

describe("quickAddSummary", () => {
  it("lists title, day, start, people and place for an event", () => {
    expect(quickAddSummary("event", base, labels, "nl")).toEqual(["Etentje", "vr 2 jan", "19:00", "Met Mila", "Groningen"]);
  });

  it("shows the end only when it is not the default hour", () => {
    expect(quickAddSummary("event", { ...base, end: "21:30" }, labels, "nl")[2]).toBe("19:00–21:30");
  });

  it("shows what the user changed by hand, not what the text said", () => {
    const edited = { ...base, title: "Diner", date: "2026-01-03", allDay: true, people: " Mila , Youri ", place: "", repeat: "weekly" as const, categoryId: "cal-social" };
    expect(quickAddSummary("event", edited, labels, "nl")).toEqual([
      "Diner",
      "za 3 jan",
      "hele dag",
      "Met Mila, Youri",
      "herhaalt weekly",
      "Sociaal",
    ]);
  });

  it("leaves out empty parts", () => {
    expect(quickAddSummary("event", { ...base, title: " ", people: "", place: "" }, labels, "nl")).toEqual(["vr 2 jan", "19:00"]);
  });

  it("names the recipe, day and moment of a meal", () => {
    expect(quickAddSummary("meal", { ...base, pickedTitle: "Warme dal" }, labels, "nl")).toEqual(["Warme dal", "vr 2 jan", "diner"]);
  });

  it("names the picked card of a to-do, else its title", () => {
    expect(quickAddSummary("todo", { ...base, pickedTitle: "Fiets laten nakijken" }, labels, "nl")).toEqual(["Fiets laten nakijken", "vr 2 jan"]);
    expect(quickAddSummary("todo", { ...base, title: "KPN bellen" }, labels, "nl")).toEqual(["KPN bellen", "vr 2 jan"]);
  });
});

describe("formatSummaryDay", () => {
  it("follows the locale", () => {
    expect(formatSummaryDay("2026-01-02", "en")).toMatch(/Fri/);
    expect(formatSummaryDay("2026-11-06", "nl")).toBe("vr 6 nov");
  });
});
