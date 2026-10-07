import { describe, expect, it } from "vitest";
import {
  UNIT_ALIASES,
  UNMAPPED_UNIT_WORDS,
  parseIngredientLine,
} from "../lib/recipes/import/parse-ingredient";
import { UNIT_CODES, isUnitCode, type UnitCode } from "../lib/recipes/units";

// #315 -- table-driven: [raw, quantity, unit, name, note, confidence].
type Row = [string, number | null, UnitCode | null, string, string | null, "high" | "low"];

const NL: Row[] = [
  ["1 1/2 el olijfolie (extra vierge)", 1.5, "eetlepel", "olijfolie", "extra vierge", "high"],
  ["200 g bloem", 200, "gram", "bloem", null, "high"],
  ["200g bloem", 200, "gram", "bloem", null, "high"],
  ["200 gr suiker", 200, "gram", "suiker", null, "high"],
  ["250 gram kipfilet", 250, "gram", "kipfilet", null, "high"],
  ["1,5 kg aardappelen", 1.5, "kilogram", "aardappelen", null, "high"],
  ["0.5 l melk", 0.5, "liter", "melk", null, "high"],
  ["2,5 dl room", 2.5, "deciliter", "room", null, "high"],
  ["500 ml bouillon", 500, "milliliter", "bouillon", null, "high"],
  ["1 tl kaneel", 1, "theelepel", "kaneel", null, "high"],
  ["2 el. sojasaus", 2, "eetlepel", "sojasaus", null, "high"],
  ["3 eetlepels honing", 3, "eetlepel", "honing", null, "high"],
  ["1 theelepel komijn", 1, "theelepel", "komijn", null, "high"],
  ["½ tl zout", 0.5, "theelepel", "zout", null, "high"],
  ["1½ el boter", 1.5, "eetlepel", "boter", null, "high"],
  ["¼ tl nootmuskaat", 0.25, "theelepel", "nootmuskaat", null, "high"],
  ["⅓ kopje rijst", 1 / 3, "stuk", "kopje rijst", null, "high"],
  ["2 ⅔ dl water", 2 + 2 / 3, "deciliter", "water", null, "high"],
  ["3/4 l bouillon", 0.75, "liter", "bouillon", null, "high"],
  ["2 uien", 2, "stuk", "uien", null, "high"],
  ["3 eieren", 3, "stuk", "eieren", null, "high"],
  ["4 stuks tomaat", 4, "stuk", "tomaat", null, "high"],
  ["1 stuk gember", 1, "stuk", "gember", null, "high"],
  ["een snufje zout", 1, "snufje", "zout", null, "high"],
  ["snufje zout", null, "snufje", "zout", null, "high"],
  ["1 snufje peper", 1, "snufje", "peper", null, "high"],
  ["zout naar smaak", null, "naar_smaak", "zout", null, "high"],
  ["peper, naar smaak", null, "naar_smaak", "peper", null, "high"],
  ["peper en zout naar smaak", null, "naar_smaak", "peper en zout", null, "high"],
  ["olijfolie", null, null, "olijfolie", null, "high"],
  ["2 el olijfolie, extra vierge", 2, "eetlepel", "olijfolie", "extra vierge", "high"],
  ["1 ui, fijngehakt", 1, "stuk", "ui", "fijngehakt", "high"],
  ["2 tenen knoflook, geperst", 2, "stuk", "tenen knoflook", "geperst", "high"],
  ["300 g spinazie (vers of diepvries), gewassen", 300, "gram", "spinazie", "vers of diepvries; gewassen", "high"],
  ["1 pot (370 ml) passata", 1, "stuk", "pot passata", "370 ml", "high"],
  ["2 el van de olie", 2, "eetlepel", "de olie", null, "high"],
  ["- 400 g gehakt", 400, "gram", "gehakt", null, "high"],
  ["  500   g   rijst  ", 500, "gram", "rijst", null, "high"],
  ["1 Eetlepel Honing", 1, "eetlepel", "Honing", null, "high"],
  ["1 schepje proteïnepoeder", 1, "scoop", "proteïnepoeder", null, "high"],
];

const RANGES: Row[] = [
  ["2-3 el olie", 2, "eetlepel", "olie", "2-3", "high"],
  ["2–3 tenen knoflook", 2, "stuk", "tenen knoflook", "2–3", "high"],
  ["2 tot 3 tl suiker", 2, "theelepel", "suiker", "2 tot 3", "high"],
  ["2 to 3 tbsp sugar", 2, "tablespoon", "sugar", "2 to 3", "high"],
  ["1,5-2 kg kip", 1.5, "kilogram", "kip", "1,5-2", "high"],
  ["½-1 tl chilivlokken", 0.5, "theelepel", "chilivlokken", "½-1", "high"],
  ["1 1/2 - 2 cups flour", 1.5, "cup", "flour", "1 1/2 - 2", "high"],
];

const EN: Row[] = [
  ["2 cups all-purpose flour", 2, "cup", "all-purpose flour", null, "high"],
  ["1 cup of milk", 1, "cup", "milk", null, "high"],
  ["1/2 cup sugar", 0.5, "cup", "sugar", null, "high"],
  ["1 1/2 tsp baking powder", 1.5, "teaspoon", "baking powder", null, "high"],
  ["2 tbsp. olive oil", 2, "tablespoon", "olive oil", null, "high"],
  ["1 Tbsp butter, melted", 1, "tablespoon", "butter", "melted", "high"],
  ["8 oz cream cheese", 8, "ounce", "cream cheese", null, "high"],
  ["1 lb ground beef", 1, "pound", "ground beef", null, "high"],
  ["2 lbs potatoes, peeled", 2, "pound", "potatoes", "peeled", "high"],
  ["4 fl oz milk", 4, "fluid_ounce", "milk", null, "high"],
  ["1 pinch salt", 1, "snufje", "salt", null, "high"],
  ["a pinch of cayenne", 1, "snufje", "cayenne", null, "high"],
  ["salt to taste", null, "naar_smaak", "salt", null, "high"],
  ["black pepper, to taste", null, "naar_smaak", "black pepper", null, "high"],
  ["3 large eggs", 3, "stuk", "large eggs", null, "high"],
  ["2 cloves garlic, minced", 2, "stuk", "cloves garlic", "minced", "high"],
  ["1 (14 oz) can diced tomatoes", 1, "stuk", "can diced tomatoes", "14 oz", "high"],
  ["1 medium onion, finely chopped", 1, "stuk", "medium onion", "finely chopped", "high"],
  ["1.5 cups water", 1.5, "cup", "water", null, "high"],
  ["2 pcs chicken breast", 2, "stuk", "chicken breast", null, "high"],
  ["1 scoop protein powder", 1, "scoop", "protein powder", null, "high"],
];

const TINS: Row[] = [
  // Pack policy: N * M in the inner unit, "N x M unit" in note.
  ["2 x 400 g blik tomaten", 800, "gram", "blik tomaten", "2 x 400 g", "high"],
  ["2 x 400 g tin tomatoes", 800, "gram", "tin tomatoes", "2 x 400 g", "high"],
  ["3 × 250 ml room", 750, "milliliter", "room", "3 x 250 ml", "high"],
  ["3 x 250 ml room", 750, "milliliter", "room", "3 x 250 ml", "high"],
  ["4 x ½ kg bloem", 2, "kilogram", "bloem", "4 x ½ kg", "high"],
  ["2 x 3 eieren", 6, "stuk", "eieren", "2 x 3", "high"],
  ["2 x 3 stuks tomaat", 6, "stuk", "tomaat", "2 x 3 stuks", "high"],
  ["2 x 3 teentjes knoflook", 6, null, "knoflook", "2 x 3; teentjes", "low"],
  ["2-3 x 400 g tomaten", 2, "stuk", "x 400 g tomaten", "2-3", "low"],
];

const LOW: Row[] = [
  ["2 teentjes knoflook", 2, null, "knoflook", "teentjes", "low"],
  ["1 bosje peterselie", 1, null, "peterselie", "bosje", "low"],
  ["50 cl rode wijn", 50, null, "rode wijn", "cl", "low"],
  ["g zout", null, "gram", "zout", null, "low"],
  ["zout 2x", null, null, "zout 2x", null, "low"],
  ["200 g - 300 g bloem", 200, "gram", "- 300 g bloem", null, "low"],
  ["1 blik 400 g tomaten", 1, "stuk", "blik 400 g tomaten", null, "low"],
  ["3/0 el olie", null, "eetlepel", "olie", null, "low"],
  ["", null, null, "", null, "low"],
];

function check(rows: Row[]) {
  it.each(rows)("%s", (raw, quantity, unit, name, note, confidence) => {
    expect(parseIngredientLine(raw)).toEqual({
      kind: "ingredient",
      quantity,
      unit,
      name,
      note,
      raw,
      confidence,
    });
  });
}

describe("parseIngredientLine: Dutch", () => check(NL));
describe("parseIngredientLine: English", () => check(EN));
describe("parseIngredientLine: ranges (lower bound, original text in note)", () => check(RANGES));
describe("parseIngredientLine: 'N x pack' (multiplied, original text in note)", () =>
  check(TINS));
describe("parseIngredientLine: ambiguous lines are low confidence", () => check(LOW));

describe("parseIngredientLine: group labels", () => {
  it.each([
    ["Voor de saus:", "Voor de saus"],
    ["For the sauce:", "For the sauce"],
    ["SAUS", "SAUS"],
    ["VOOR DE TOPPING", "VOOR DE TOPPING"],
  ])("%s", (raw, label) => {
    expect(parseIngredientLine(raw)).toEqual({ kind: "group", label, raw });
  });

  it("does not treat an ordinary ingredient as a group", () => {
    expect(parseIngredientLine("2 EL OLIE").kind).toBe("ingredient");
    expect(parseIngredientLine("Zout").kind).toBe("ingredient");
  });
});

describe("unit alias map", () => {
  it("maps every alias to a valid UnitCode (isUnitCode)", () => {
    for (const [alias, code] of Object.entries(UNIT_ALIASES)) {
      expect(isUnitCode(code), `${alias} -> ${code}`).toBe(true);
    }
  });

  it("never shadows an unmapped word", () => {
    for (const word of UNMAPPED_UNIT_WORDS) {
      expect(Object.keys(UNIT_ALIASES)).not.toContain(word);
    }
  });

  it("covers the units the ticket names", () => {
    const covered = new Set<string>(Object.values(UNIT_ALIASES));
    for (const code of ["gram", "kilogram", "milliliter", "deciliter", "liter", "theelepel", "eetlepel", "teaspoon", "tablespoon", "cup", "ounce", "pound", "stuk", "snufje", "naar_smaak"]) {
      expect(covered.has(code), code).toBe(true);
      expect(UNIT_CODES).toContain(code);
    }
  });
});

describe("table size", () => {
  it("has at least 60 real-world lines", () => {
    expect(NL.length + EN.length + RANGES.length + TINS.length + LOW.length).toBeGreaterThanOrEqual(60);
  });
});
