import { describe, expect, it } from "vitest";
import {
  defaultEndTime,
  parseQuickAdd,
  rankRecipes,
  type QuickAddContext,
  type QuickAddLocale,
  type QuickAddResult,
} from "@/lib/agenda/quick-add";
import { createPlannedCardSchema } from "@/lib/agenda/schemas";

// Reference: Sunday 18 October 2026, 15:48 in Europe/Amsterdam (CEST, so 13:48 UTC).
const NOW = new Date("2026-10-18T13:48:00Z");

const categories = [
  { id: "persoonlijk", name: "Persoonlijk", isDefault: true },
  { id: "sociaal", name: "Sociaal", isDefault: false },
  { id: "sport", name: "Sport", isDefault: false },
  { id: "werk", name: "Werk", isDefault: false },
];
const recipes = [
  { id: "dal", title: "Warme dal" },
  { id: "curry", title: "Vegan Currykikkererwten" },
  { id: "muffins", title: "Blauwe bessen eiwitmuffins" },
  { id: "pannenkoeken", title: "Pannenkoeken" },
  { id: "pasta", title: "Pasta pesto" },
];

function parse(text: string, locale: QuickAddLocale = "nl", overrides: Partial<QuickAddContext> = {}): QuickAddResult {
  return parseQuickAdd(text, { locale, now: NOW, categories, recipes, ...overrides });
}

describe("parseQuickAdd, Dutch", () => {
  it("film op vrijdag met youri: a social all-day event on the coming Friday", () => {
    const result = parse("film op vrijdag met youri");
    expect(result).toMatchObject({
      kind: "event",
      title: "Film",
      date: "2026-10-23",
      allDay: true,
      start: null,
      people: ["Youri"],
      categoryId: "sociaal",
      repeat: "none",
    });
  });

  it("Padel morgen 19:30-21:00: a timed sport event", () => {
    expect(parse("Padel morgen 19:30-21:00")).toMatchObject({
      kind: "event",
      title: "Padel",
      date: "2026-10-19",
      allDay: false,
      start: "19:30",
      end: "21:00",
      categoryId: "sport",
    });
  });

  it("Warme dal donderdag: a meal with the recipe found", () => {
    expect(parse("Warme dal donderdag")).toMatchObject({
      kind: "meal",
      date: "2026-10-22",
      recipeId: "dal",
      slot: null,
    });
  });

  it("KPN bellen dinsdag: a task", () => {
    expect(parse("KPN bellen dinsdag")).toMatchObject({ kind: "todo", title: "KPN bellen", date: "2026-10-20", allDay: true });
  });

  it("Lunch met Sanne volgende week woensdag 12u: with people it stays an event", () => {
    expect(parse("Lunch met Sanne volgende week woensdag 12u")).toMatchObject({
      kind: "event",
      title: "Lunch",
      date: "2026-10-21",
      start: "12:00",
      end: null,
      allDay: false,
      people: ["Sanne"],
      categoryId: "sociaal",
    });
  });

  it("Etentje bij mama za 18u met Youri en Sanne: place, time, two people", () => {
    expect(parse("Etentje bij mama za 18u met Youri en Sanne")).toMatchObject({
      kind: "event",
      title: "Etentje",
      date: "2026-10-24",
      start: "18:00",
      place: "Mama",
      people: ["Youri", "Sanne"],
      categoryId: "sociaal",
    });
  });

  it("Overleg 10:30-12:00 op 23-10: a numeric date and a time range", () => {
    expect(parse("Overleg 10:30-12:00 op 23-10")).toMatchObject({
      kind: "event",
      title: "Overleg",
      date: "2026-10-23",
      start: "10:30",
      end: "12:00",
      categoryId: "persoonlijk",
    });
  });

  it("Verjaardag oma 2 nov hele dag", () => {
    expect(parse("Verjaardag oma 2 nov hele dag")).toMatchObject({
      kind: "event",
      title: "Verjaardag oma",
      date: "2026-11-02",
      allDay: true,
      categoryId: "sociaal",
    });
  });

  it("yoga elke dinsdag 19u: a weekly repeat starting on the coming Tuesday", () => {
    expect(parse("yoga elke dinsdag 19u")).toMatchObject({
      kind: "event",
      title: "Yoga",
      date: "2026-10-20",
      start: "19:00",
      repeat: "weekly",
      categoryId: "sport",
    });
  });

  it.each([
    ["elke dag", "daily"],
    ["dagelijks", "daily"],
    ["elke week", "weekly"],
    ["wekelijks", "weekly"],
    ["om de week", "biweekly"],
    ["om de 2 weken", "biweekly"],
    ["elke maand", "monthly"],
    ["maandelijks", "monthly"],
    ["elk jaar", "yearly"],
    ["jaarlijks", "yearly"],
  ])("repeat phrase %s", (phrase, repeat) => {
    const result = parse(`Schoonmaken ${phrase}`);
    expect(result.repeat).toBe(repeat);
    expect(result.title).toBe("Schoonmaken");
  });

  it("elke vrijdag: weekly on that weekday", () => {
    expect(parse("Borrel elke vrijdag 17u")).toMatchObject({ repeat: "weekly", date: "2026-10-23", start: "17:00", title: "Borrel" });
  });

  it("an explicit day beats the weekday of a repeat", () => {
    expect(parse("Zwemmen elke dinsdag vanaf 27-10")).toMatchObject({ repeat: "weekly", date: "2026-10-27" });
  });

  it("no day, no time: nothing recognised, an all-day event for the caller to place", () => {
    expect(parse("Tandarts")).toMatchObject({ kind: "event", title: "Tandarts", date: null, allDay: true, spans: [] });
  });

  it("morgen is the next day, vandaag today, overmorgen two days on", () => {
    expect(parse("Opruimen morgen").date).toBe("2026-10-19");
    expect(parse("Opruimen vandaag").date).toBe("2026-10-18");
    expect(parse("Opruimen overmorgen 14u")).toMatchObject({ date: "2026-10-20", start: "14:00" });
  });

  it("a weekday is the coming one (on that day itself the next week), a past date rolls to next year", () => {
    expect(parse("Wandelen zondag").date).toBe("2026-10-25");
    expect(parse("Feest 5 oktober").date).toBe("2027-10-05");
    expect(parse("Feest 3 december 2026").date).toBe("2026-12-03");
  });

  it("times: 20u, 20.30, 20u30, om 9, 's avonds", () => {
    expect(parse("Bellen om 20u").start).toBe("20:00");
    expect(parse("dinsdag 20.30 yoga")).toMatchObject({ start: "20:30", title: "Yoga", date: "2026-10-20" });
    expect(parse("Film vrijdag 20u30").start).toBe("20:30");
    expect(parse("Overleg morgen om 9")).toMatchObject({ start: "09:00", date: "2026-10-19" });
    expect(parse("Borrel zaterdag 's avonds")).toMatchObject({ start: "19:00", allDay: false });
    expect(parse("Film zaterdag 8u 's avonds").start).toBe("20:00");
  });

  it("a time range with u and a connector word", () => {
    expect(parse("Cursus woensdag van 9u tot 12u")).toMatchObject({ start: "09:00", end: "12:00", date: "2026-10-21" });
    expect(parse("Cursus 10-12 uur")).toMatchObject({ start: "10:00", end: "12:00", date: null });
  });

  it("10-12 without a mark is the tenth of December, not a time range", () => {
    expect(parse("Feest 10-12")).toMatchObject({ date: "2026-12-10", allDay: true });
  });

  it("an end before the start lasts one hour", () => {
    expect(parse("Overleg 14:00-13:00")).toMatchObject({ start: "14:00", end: "15:00" });
  });

  it("names that look like months stay names", () => {
    expect(parse("Koffie met Mei")).toMatchObject({ people: ["Mei"], date: null });
    expect(parse("Koffie met Jan zaterdag")).toMatchObject({ people: ["Jan"], date: "2026-10-24" });
  });

  it("a place of several words", () => {
    expect(parse("Boodschappen bij de bakker").place).toBe("De bakker");
  });

  it("in before a capitalised name is a place", () => {
    expect(parse("Markt in Groningen")).toMatchObject({ title: "Markt", place: "Groningen" });
    expect(parse("Festival in Den Haag zaterdag")).toMatchObject({ title: "Festival", place: "Den Haag", date: "2026-10-24" });
    expect(parse("Etentje bij mama in Groningen").place).toBe("Mama");
  });

  it("in before a lowercase word or a month is not a place", () => {
    expect(parse("Hardlopen in de ochtend").place).toBeNull();
    expect(parse("Vakantie in Maart").place).toBeNull();
  });

  it("meal: a moment word without people or place", () => {
    expect(parse("Diner vandaag")).toMatchObject({ kind: "meal", slot: "dinner", date: "2026-10-18", recipeId: null });
    expect(parse("Ontbijt morgen")).toMatchObject({ kind: "meal", slot: "breakfast" });
    expect(parse("Lunch bij mama").kind).toBe("event");
  });

  it("meal: a plural finds the recipe, a moment word is not part of the title", () => {
    expect(parse("Pannenkoek donderdag")).toMatchObject({ kind: "meal", recipeId: "pannenkoeken", date: "2026-10-22" });
    expect(parse("Lunch pasta pesto")).toMatchObject({ kind: "meal", slot: "lunch", recipeId: "pasta", recipeQuery: "Pasta pesto" });
  });

  it("a recipe name with people is an appointment", () => {
    expect(parse("Warme dal met Youri").kind).toBe("event");
  });

  it("a task keeps people and places in its title", () => {
    expect(parse("Bellen met Youri vrijdag")).toMatchObject({ kind: "todo", title: "Bellen met Youri", date: "2026-10-23" });
    expect(parse("Bel mama om 20u")).toMatchObject({ kind: "todo", title: "Bel mama", start: "20:00" });
  });

  it("a word equal to a category name wins over keywords", () => {
    expect(parse("Padel werk afspraak").categoryId).toBe("werk");
    expect(parse("Film met collega's").categoryId).toBe("sociaal");
  });

  it("keywords only count when such a category exists; otherwise the default", () => {
    const only = [{ id: "a", name: "Persoonlijk", isDefault: true }, { id: "b", name: "Werk", isDefault: false }];
    expect(parse("Padel morgen", "nl", { categories: only }).categoryId).toBe("a");
    expect(parse("Padel morgen", "nl", { categories: [] }).categoryId).toBeNull();
  });

  it("reports the recognised spans for highlighting, in order and apart", () => {
    const text = "Etentje bij mama za 18u met Youri en Sanne";
    const { spans } = parse(text);
    expect(spans.map((span) => [span.kind, text.slice(span.start, span.end)])).toEqual([
      ["place", "bij mama"],
      ["when", "za"],
      ["time", "18u"],
      ["person", "met Youri en Sanne"],
    ]);
  });

  it("the same text parses the same on any device zone", () => {
    const early = new Date("2026-10-18T22:30:00Z");
    expect(parseQuickAdd("Opruimen morgen", { locale: "nl", now: early }).date).toBe("2026-10-20");
  });

  it("the Amsterdam zone decides what today is", () => {
    const afterMidnight = new Date("2026-10-18T22:30:00Z");
    expect(parseQuickAdd("Opruimen vandaag", { locale: "nl", now: afterMidnight }).date).toBe("2026-10-19");
  });
});

describe("parseQuickAdd, English", () => {
  it("movie on friday with youri", () => {
    expect(parse("movie on friday with youri", "en")).toMatchObject({
      kind: "event",
      title: "Movie",
      date: "2026-10-23",
      allDay: true,
      people: ["Youri"],
      categoryId: "sociaal",
    });
  });

  it("Padel tomorrow 7:30pm-9pm", () => {
    expect(parse("Padel tomorrow 7:30pm-9pm", "en")).toMatchObject({
      title: "Padel",
      date: "2026-10-19",
      start: "19:30",
      end: "21:00",
      categoryId: "sport",
    });
  });

  it("Dinner Thursday is a meal; with people it is an event", () => {
    expect(parse("Dinner Thursday", "en")).toMatchObject({ kind: "meal", slot: "dinner", date: "2026-10-22" });
    expect(parse("Dinner Thursday with Sanne", "en").kind).toBe("event");
  });

  it("Warm dal Thursday finds the recipe", () => {
    expect(parse("Warme dal Thursday", "en")).toMatchObject({ kind: "meal", recipeId: "dal", date: "2026-10-22" });
  });

  it("Call KPN Tuesday", () => {
    expect(parse("Call KPN Tuesday", "en")).toMatchObject({ kind: "todo", title: "Call KPN", date: "2026-10-20" });
  });

  it("Lunch with Sanne next week Wednesday at noon", () => {
    expect(parse("Lunch with Sanne next week Wednesday at noon", "en")).toMatchObject({
      kind: "event",
      title: "Lunch",
      date: "2026-10-21",
      start: "12:00",
      people: ["Sanne"],
    });
  });

  it("in before a capitalised name is a place", () => {
    expect(parse("Market in Groningen", "en")).toMatchObject({ title: "Market", place: "Groningen" });
    expect(parse("Run in the morning", "en").place).toBeNull();
  });

  it("Dinner at mom's Sat 6pm with Youri and Sanne", () => {
    expect(parse("Dinner at mom's Sat 6pm with Youri and Sanne", "en")).toMatchObject({
      kind: "event",
      title: "Dinner",
      date: "2026-10-24",
      start: "18:00",
      place: "Mom's",
      people: ["Youri", "Sanne"],
    });
  });

  it("Meeting 10:30-12:00 on 10/23 reads month first", () => {
    expect(parse("Meeting 10:30-12:00 on 10/23", "en")).toMatchObject({ date: "2026-10-23", start: "10:30", end: "12:00" });
  });

  it("reads 11/3 as 3 November", () => {
    expect(parse("Dentist 11/3", "en").date).toBe("2026-11-03");
    expect(parse("Dentist 23/10", "en").date).toBe("2026-10-23");
  });

  it("Grandma's birthday 2 Nov all day", () => {
    expect(parse("Grandma's birthday 2 Nov all day", "en")).toMatchObject({
      title: "Grandma's birthday",
      date: "2026-11-02",
      allDay: true,
      categoryId: "sociaal",
    });
  });

  it("yoga every Tuesday 7pm", () => {
    expect(parse("yoga every Tuesday 7pm", "en")).toMatchObject({ repeat: "weekly", date: "2026-10-20", start: "19:00", title: "Yoga" });
  });

  it.each([
    ["every day", "daily"],
    ["weekly", "weekly"],
    ["every other week", "biweekly"],
    ["every month", "monthly"],
    ["yearly", "yearly"],
  ])("repeat phrase %s", (phrase, repeat) => {
    expect(parse(`Clean ${phrase}`, "en").repeat).toBe(repeat);
  });

  it("in the evening, in 3 days, the day after tomorrow", () => {
    expect(parse("Drinks Saturday in the evening", "en").start).toBe("19:00");
    expect(parse("Dentist in 3 days", "en").date).toBe("2026-10-21");
    expect(parse("Dentist the day after tomorrow", "en").date).toBe("2026-10-20");
  });
});

describe("rankRecipes", () => {
  it("ranks recipes by shared words, plurals and prefixes included", () => {
    expect(rankRecipes("dal", recipes).map((recipe) => recipe.id)).toEqual(["dal"]);
    expect(rankRecipes("pannenkoek", recipes).map((recipe) => recipe.id)).toEqual(["pannenkoeken"]);
    expect(rankRecipes("pas", recipes).map((recipe) => recipe.id)).toEqual(["pasta"]);
    expect(rankRecipes("vegan curry", recipes)[0].id).toBe("curry");
  });

  it("finds nothing for an empty or unrelated query", () => {
    expect(rankRecipes("", recipes)).toEqual([]);
    expect(rankRecipes("film", recipes)).toEqual([]);
  });
});

describe("defaultEndTime", () => {
  it("is one hour on, held at 23:59", () => {
    expect(defaultEndTime("19:30")).toBe("20:30");
    expect(defaultEndTime("23:30")).toBe("23:59");
  });
});

describe("createPlannedCardSchema", () => {
  it("takes a trimmed title and a day, nothing else", () => {
    expect(createPlannedCardSchema.parse({ title: "  KPN bellen ", plannedFor: "2026-10-20" })).toEqual({
      title: "KPN bellen",
      plannedFor: "2026-10-20",
    });
    expect(createPlannedCardSchema.safeParse({ title: "  ", plannedFor: "2026-10-20" }).success).toBe(false);
    expect(createPlannedCardSchema.safeParse({ title: "x", plannedFor: "20-10-2026" }).success).toBe(false);
  });
});
