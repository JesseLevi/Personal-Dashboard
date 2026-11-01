import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn() }));

import { matchingSignalIds } from "@/lib/assistant/settle";
import { toBasketSuggestions } from "@/lib/assistant/surfaces";
import type { AssistantSignal } from "@/lib/assistant/types";
import { splitHighlighted, type PlanRecipe } from "@/lib/agenda/plan-recipes";

describe("matchingSignalIds", () => {
  const rows = [
    { id: "s1", payload: { item_name: "Pindakaas", median_days: 30, days_since: 31 } },
    { id: "s2", payload: { item_name: "Melk", median_days: 7, days_since: 8 } },
    { id: "s3", payload: { recipe_id: "r1", median_days: 14, days_since: 20 } },
    { id: "s4", payload: null },
  ];

  it("settles a buy rhythm by item name, ignoring case and spaces", () => {
    expect(matchingSignalIds(rows, { kind: "buy_rhythm", itemName: "  pindakaas " })).toEqual(["s1"]);
  });

  it("settles a cook rhythm by recipe id", () => {
    expect(matchingSignalIds(rows, { kind: "cook_rhythm", recipeId: "r1" })).toEqual(["s3"]);
  });

  it("matches nothing for another item or a malformed payload", () => {
    expect(matchingSignalIds(rows, { kind: "buy_rhythm", itemName: "Kaas" })).toEqual([]);
  });
});

describe("toBasketSuggestions", () => {
  it("keeps buy rhythms only, with the catalog values", () => {
    const signals: AssistantSignal[] = [
      {
        id: "s1",
        kind: "buy_rhythm",
        createdAt: "2026-11-01T00:00:00Z",
        text: { key: "assistant.signals.buyRhythm", values: { item: "Pindakaas", median: 30, days: 31 } },
        action: { type: "add_to_basket", itemName: "Pindakaas", labelKey: "assistant.signals.actions.addToBasket" },
      },
      {
        id: "s2",
        kind: "pattern",
        createdAt: "2026-11-01T00:00:00Z",
        text: { plain: "x" },
        action: { type: "link", href: "/notities/n", labelKey: "assistant.signals.actions.open" },
      },
    ];
    expect(toBasketSuggestions(signals)).toEqual([{ id: "s1", item: "Pindakaas", median: 30, days: 31 }]);
  });
});

describe("splitHighlighted", () => {
  const recipe = (id: string): PlanRecipe => ({
    id,
    title: id,
    servings: 2,
    categoryId: "c",
    categoryName: "C",
    timeMinutes: null,
    thumbnailUrl: null,
    thumbnailPath: null,
  });

  it("pulls the highlighted recipes out in signal order and keeps the rest in order", () => {
    const { highlighted, visible } = splitHighlighted([recipe("a"), recipe("b"), recipe("c")], ["c", "missing", "a"]);
    expect(highlighted.map((r) => r.id)).toEqual(["c", "a"]);
    expect(visible.map((r) => r.id)).toEqual(["b"]);
  });
});
