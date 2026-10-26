import { readFileSync } from "node:fs";
import { createTranslator } from "next-intl";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { toAssistantSignal, type SignalRow, type SignalTargets } from "@/lib/assistant/signals";

const RECIPE = "11111111-1111-4111-8111-111111111111";
const NOTE = "22222222-2222-4222-8222-222222222222";

const targets: SignalTargets = {
  recipeTitles: new Map([[RECIPE, "Pasta pesto"]]),
  hrefs: new Map([
    [`recipe:${RECIPE}`, `/recepten/${RECIPE}`],
    [`note:${NOTE}`, `/notities/${NOTE}`],
  ]),
};

const row = (over: Partial<SignalRow>): SignalRow => ({
  id: "s1",
  kind: "buy_rhythm",
  created_at: "2026-10-26T08:00:00Z",
  payload: {},
  message: null,
  status: "new",
  ...over,
});

describe("toAssistantSignal", () => {
  it("maps buy_rhythm to i18n text and an add_to_basket action", () => {
    const vm = toAssistantSignal(
      row({
        payload: { item_key: "melk", item_name: "Melk", median_days: 7.4, days_since: 9, purchases: 6 },
      }),
      targets,
    );
    expect(vm).toEqual({
      id: "s1",
      kind: "buy_rhythm",
      createdAt: "2026-10-26T08:00:00Z",
      text: { key: "assistant.signals.buyRhythm", values: { item: "Melk", median: 7, days: 9 } },
      action: { type: "add_to_basket", itemName: "Melk", labelKey: "assistant.signals.actions.addToBasket" },
    });
  });

  it("drops a buy_rhythm without an item name", () => {
    expect(toAssistantSignal(row({ payload: { item_name: null, median_days: 7, days_since: 9 } }), targets)).toBeNull();
  });

  it("maps cook_rhythm with the recipe title and a link", () => {
    const vm = toAssistantSignal(
      row({ kind: "cook_rhythm", payload: { recipe_id: RECIPE, median_days: 14, days_since: 40, times: 4 } }),
      targets,
    );
    expect(vm?.text).toEqual({
      key: "assistant.signals.cookRhythm",
      values: { recipe: "Pasta pesto", median: 14, days: 40 },
    });
    expect(vm?.action).toEqual({
      type: "link",
      href: `/recepten/${RECIPE}`,
      labelKey: "assistant.signals.actions.openRecipe",
    });
  });

  it("drops a cook_rhythm whose recipe is gone", () => {
    const gone: SignalTargets = { recipeTitles: new Map(), hrefs: new Map() };
    expect(
      toAssistantSignal(row({ kind: "cook_rhythm", payload: { recipe_id: RECIPE, median_days: 14, days_since: 40 } }), gone),
    ).toBeNull();
  });

  it("maps a pattern to plain text and a link to its first source", () => {
    const vm = toAssistantSignal(
      row({
        kind: "pattern",
        message: "  Drie notities gaan over je verhuizing.  ",
        payload: { sources: [{ type: "note", id: NOTE }, { type: "card", id: "x" }] },
      }),
      targets,
    );
    expect(vm?.text).toEqual({ plain: "Drie notities gaan over je verhuizing." });
    expect(vm?.action).toEqual({ type: "link", href: `/notities/${NOTE}`, labelKey: "assistant.signals.actions.open" });
  });

  it("drops a pattern whose first source is gone, without message, or malformed", () => {
    const sources = [{ type: "note", id: "missing" }, { type: "note", id: NOTE }];
    expect(toAssistantSignal(row({ kind: "pattern", message: "Hoi", payload: { sources } }), targets)).toBeNull();
    expect(
      toAssistantSignal(row({ kind: "pattern", message: null, payload: { sources: [{ type: "note", id: NOTE }] } }), targets),
    ).toBeNull();
    expect(toAssistantSignal(row({ kind: "pattern", message: "Hoi", payload: { sources: [] } }), targets)).toBeNull();
  });

  it("drops an unknown kind", () => {
    expect(toAssistantSignal(row({ kind: "stuck_card" }), targets)).toBeNull();
  });
});

describe("assistant.signals messages", () => {
  const load = (locale: string) => JSON.parse(readFileSync(`messages/${locale}.json`, "utf8"));

  function keys(value: unknown, prefix = ""): string[] {
    if (typeof value !== "object" || value === null) return [prefix];
    return Object.entries(value).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k));
  }

  it("has identical key sets in nl and en", () => {
    expect(keys(load("nl").assistant.signals).sort()).toEqual(keys(load("en").assistant.signals).sort());
  });

  it.each([
    ["nl", 1, "Je koopt ongeveer elke 1 dag Melk. De laatste keer was 9 dagen geleden."],
    ["nl", 7, "Je koopt ongeveer elke 7 dagen Melk. De laatste keer was 9 dagen geleden."],
    ["en", 1, "You usually buy Melk about every 1 day. The last time was 9 days ago."],
  ])("formats the buy rhythm in %s with plurals (%i)", (locale, median, expected) => {
    const t = createTranslator({ locale, messages: load(locale), namespace: "assistant.signals" });
    expect(t("buyRhythm", { item: "Melk", median, days: 9 })).toBe(expected);
  });

  it("formats every message key used by the view-models", () => {
    const t = createTranslator({ locale: "en", messages: load("en"), namespace: "assistant.signals" });
    expect(t("cookRhythm", { recipe: "Pasta", median: 14, days: 40 })).toContain("Pasta");
    for (const k of ["addToBasket", "openRecipe", "open", "dismiss"] as const) {
      expect(t(`actions.${k}`)).toBeTruthy();
    }
  });
});
