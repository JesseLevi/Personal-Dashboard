// Kitchen-friendly display layer for Recepten (#164/#157 slice 2). Pure and
// framework-free, same house style as units.ts/nutrition.ts/mass-
// resolution.ts: no Supabase import, no next-intl import, testable without a
// database (tests/recipes-kitchen-units.test.ts), safe to import from client
// code.
//
// -- The composition layer ADR-0011 §3 allows -------------------------------
// units.ts stays ingredient-blind on purpose (its own file header): it only
// ever converts *within* a magnitude via a fixed factor, with no notion of
// any particular ingredient. ADR-0011 §3 draws the line at "same-dimension
// unit conversion and ingredient-specific unit mass are two separate
// mechanisms and must stay that way in code" -- but a THIRD module composing
// both (unit-blind conversion + an already-resolved per-ingredient mass) is
// exactly what that line permits, and is what this file is. It never
// resolves a mass itself (that stays queries.ts's job, via mass-
// resolution.ts's resolveMassWithBridge against the batched query slice 1
// already built for nutrition) -- it only takes an already-resolved
// KitchenUnitMasses record as input, mirroring nutrition.ts's own
// `unitMassGrams` input pattern.

import {
  convert,
  convertToUnitSystem,
  magnitudeOf,
  type MassUnitCode,
  type UnitCode,
  type UnitSystem,
  type VolumeUnitCode,
} from "@/lib/recipes/units";

// ============================================================================
// 1a: fraction notation (#157)
// ============================================================================

// Tolerance is RELATIVE (5% of the value), not a fixed absolute amount, and
// that choice is the whole point of this formatter. It mirrors the precision
// of the instrument the number is about to be measured with: a cup scooped
// out of a bag is not accurate to better than a few percent, so insisting on
// an absolute window makes the output worse, not more honest. An absolute
// 0.02 window was tried first and produced exactly the wrong readings for
// the case this feature exists to serve -- 190 g of rice came out as
// "1.03 cup" and 500 g as "2.7 cup", where a cook needs "1 cup" and
// "2 3/4 cup". Scaled quantities still behave: 5% of 0.33 is 0.0165, far too
// tight to let 0.33 drift off 1/3, and 0.45 stays decimal because 1/2 is 11%
// away.
const FRACTION_SNAP_RELATIVE_TOLERANCE = 0.05;
// Binary floating point makes a decimal difference that's conceptually
// exactly the tolerance come out a hair over it (e.g. 0.27 - 0.25 is
// 0.020000000000000018, not 0.02) -- the same class of representation error
// units.ts's own roundQuantity guards against with its "+ Number.EPSILON"
// correction (that file's own comment: "plain Math.round(x * 100) / 100
// still mis-rounds some values"). A tiny absolute buffer, several orders of
// magnitude below any real tolerance, absorbs that noise without changing
// which real-world quantities snap.
const FRACTION_SNAP_EPSILON = 1e-9;

// Ascending by fractional value. ASCII slash notation only, matching Figma's
// own drawn text ("1/4 cup") -- no unicode vulgar-fraction glyphs, no "~"
// approximation marker (ticket spec, binding).
const FRACTION_LADDER: readonly { value: number; text: string }[] = [
  { value: 1 / 8, text: "1/8" },
  { value: 1 / 4, text: "1/4" },
  { value: 1 / 3, text: "1/3" },
  { value: 3 / 8, text: "3/8" },
  { value: 1 / 2, text: "1/2" },
  { value: 5 / 8, text: "5/8" },
  { value: 2 / 3, text: "2/3" },
  { value: 3 / 4, text: "3/4" },
  { value: 7 / 8, text: "7/8" },
];

// Same trimming behaviour as units.ts's own private formatNumber (not
// exported, so re-declared here at one line) -- same precedent nutrition.ts's
// own `round` sets for a shared formula with no shared export: "1250" not
// "1250.00", "0.33" not "0.330000000000001".
function formatDecimal(value: number): string {
  return Number(value.toFixed(2)).toString();
}

/**
 * Renders a non-negative `value` as a whole number, an exact ladder
 * fraction, or a mixed number ("1 1/2"), snapping to whichever is NEAREST
 * when it falls within FRACTION_SNAP_RELATIVE_TOLERANCE. Returns `null` when
 * nothing is close enough -- the caller falls back to decimal notation
 * ("0.45" stays "0.45"), never an approximation marker.
 *
 * Nearest-wins rather than first-match-wins, deliberately: a short-circuit on
 * the whole number would render 10.4 as "10" (losing 0.4) simply because the
 * whole number was tested first, when "10 1/2" is four times closer. The
 * candidate set is therefore built in full and then minimised over.
 */
function toFractionText(value: number): string | null {
  const whole = Math.floor(value);
  const tolerance = value * FRACTION_SNAP_RELATIVE_TOLERANCE + FRACTION_SNAP_EPSILON;
  const candidates: { value: number; text: string }[] = [
    { value: whole, text: String(whole) },
    { value: whole + 1, text: String(whole + 1) },
    ...FRACTION_LADDER.map((rung) => ({
      value: whole + rung.value,
      text: whole > 0 ? `${whole} ${rung.text}` : rung.text,
    })),
  ];
  let best: { value: number; text: string } | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const distance = Math.abs(value - candidate.value);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }
  if (best === null || bestDistance > tolerance) return null;
  return best.text;
}

/**
 * Fraction-notation sibling of units.ts's `formatQuantity` -- not a
 * replacement, same quantity+label composition and the same
 * `quantity === null` ("naar smaak")/`label === null` handling, but a
 * volume- or count-magnitude quantity (`magnitudeOf`, units.ts) renders as
 * an ASCII fraction when it's within tolerance of a ladder rung or a whole
 * number, decimal otherwise. Mass-magnitude quantities always stay decimal
 * ("3/8 gram" is nonsense) -- ticket spec, binding.
 */
export function formatQuantityFraction(
  quantity: number | null,
  unit: UnitCode,
  label: string | null,
): string {
  if (quantity === null) return label ?? "";
  const canFraction = magnitudeOf(unit) !== "mass";
  const text = (canFraction ? toFractionText(quantity) : null) ?? formatDecimal(quantity);
  return label === null ? text : `${text} ${label}`;
}

// ============================================================================
// 1b: kitchen-friendly unit choice (#164)
// ============================================================================

/**
 * Grams-per-1-unit for the four volume units a kitchen-friendlier display
 * choice can exist for, resolved per ADR-0011 §3 (extended by #164/#157's
 * bridges) -- `null` means unresolvable, never a stand-in for zero. Built by
 * queries.ts's kitchenUnitMassesFor from the exact same batched mass rows
 * nutrition already fetches (no second round trip), and carried on
 * `RecipeIngredientWithNutrition` (lib/recipes/types.ts) so it can flow
 * through a Server Component prop as plain data -- unlike a resolver
 * function, this crosses the server/client boundary RecipeDetailPage.tsx
 * sits behind without needing a second server round trip from the client.
 */
export interface KitchenUnitMasses {
  cup: number | null;
  tablespoon: number | null;
  teaspoon: number | null;
  fluid_ounce: number | null;
}

/** No per-ingredient kitchen-unit mass resolved for any of the four units
 * above -- `convertToKitchenUnit` then falls straight through to
 * `convertToUnitSystem`'s own flagship-unit fallback (ounce under "us",
 * milliliter under "metric"). Mirrors mass-resolution.ts's own
 * EMPTY_BRIDGE_UNIT_GRAMS. */
export const EMPTY_KITCHEN_UNIT_MASSES: KitchenUnitMasses = {
  cup: null,
  tablespoon: null,
  teaspoon: null,
  fluid_ounce: null,
};

const CUP_TO_TABLESPOON_THRESHOLD = 0.25;
const TABLESPOON_TO_TEASPOON_THRESHOLD = 1;

// Same 2-decimal + Number.EPSILON rule as units.ts's own private
// roundQuantity -- duplicated at one line rather than exported, same
// precedent as nutrition.ts's own `round`.
function round(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Steps an already-computed cup amount down to tablespoon/teaspoon when it
 * falls under 1/4 cup / 1 tablespoon. Pure unit-blind `convert()` -- no
 * density involved -- since cup/tablespoon/teaspoon are all volume-magnitude
 * and convert exactly via units.ts's own factor table once the cup amount is
 * known. "1/8 cup" is a measurement nobody performs; "2 tbs" is the same
 * amount in the spoon a cook actually reaches for, and is what Figma draws.
 */
function stepDownFromCups(cups: number): { quantity: number; unit: UnitCode } {
  if (cups < CUP_TO_TABLESPOON_THRESHOLD) {
    const tablespoons = convert(cups, "cup", "tablespoon");
    if (tablespoons < TABLESPOON_TO_TEASPOON_THRESHOLD) {
      return { quantity: round(convert(tablespoons, "tablespoon", "teaspoon")), unit: "teaspoon" };
    }
    return { quantity: round(tablespoons), unit: "tablespoon" };
  }
  return { quantity: round(cups), unit: "cup" };
}

/** Mass (gram/kilogram) -> cup via the ingredient's own grams-per-cup, then
 * the same step-down ladder. This is the one place a density-like number
 * enters; everything after it is unit-blind arithmetic. */
function usCupLadder(
  quantityInOriginalUnit: number,
  originalUnit: MassUnitCode,
  gramsPerCup: number,
): { quantity: number; unit: UnitCode } {
  const grams = convert(quantityInOriginalUnit, originalUnit, "gram");
  return stepDownFromCups(grams / gramsPerCup);
}

/**
 * Composes units.ts's `convertToUnitSystem` (unit-blind flagship conversion)
 * with an already-resolved `KitchenUnitMasses` for the row's ingredient.
 * `masses` omitted (or every field `null`) reproduces `convertToUnitSystem`'s
 * own behaviour exactly -- the identity/fallback path every existing caller
 * (and every existing test) already relies on.
 *
 * Only intercepts the two specific flagship landings a kitchen-friendlier
 * choice exists for:
 * - **"us"**: a MASS quantity that `convertToUnitSystem` would flagship-
 *   convert to `ounce` becomes `cup` (stepping down to `tablespoon`/
 *   `teaspoon` via `usCupLadder`) when `masses.cup` resolves.
 * - **"metric"**: a VOLUME quantity foreign to metric (`cup`/`teaspoon`/
 *   `tablespoon`/`fluid_ounce`) that `convertToUnitSystem` would flagship-
 *   convert to `milliliter` becomes `gram` when `masses[unit]` resolves.
 *   `milliliter`/`deciliter`/`liter` (and `eetlepel`/`theelepel`) are
 *   already metric-native -- `convertToUnitSystem` returns them untouched
 *   before this function ever sees a flagship landing, so they can never be
 *   misread as "foreign" here.
 *
 * Detects "a real foreign-unit conversion happened" by comparing the landed
 * flagship unit against the *original* `unit`, rather than re-implementing
 * units.ts's own METRIC_UNITS/US_UNITS membership sets (module-private,
 * unexported by that file's ingredient-blind design) -- so this module never
 * carries a second copy of that list to drift out of sync with units.ts's.
 */
export function convertToKitchenUnit(
  quantity: number | null,
  unit: UnitCode,
  system: UnitSystem,
  masses?: KitchenUnitMasses,
): { quantity: number | null; unit: UnitCode } {
  const base = convertToUnitSystem(quantity, unit, system);
  if (quantity === null) return base;

  // Volume -> cup needs NO ingredient data (it is unit-blind arithmetic), so
  // this runs before the `masses` guard: "2 eetlepel" under "Amerikaans" must
  // read "2 tbs", not "1/8 cup", whether or not the ingredient has a seeded
  // mass. Recomputed from the ORIGINAL quantity rather than stepping down
  // `base.quantity`, which units.ts has already rounded to 2 decimals --
  // stepping down a rounded cup figure compounds that error into the spoon
  // (2 eetlepel would read "2.11 tbs" instead of "2.03").
  if (system === "us" && base.unit === "cup" && unit !== "cup") {
    return stepDownFromCups(convert(quantity, unit as VolumeUnitCode, "cup"));
  }

  if (!masses) return base;

  if (system === "us" && base.unit === "ounce" && unit !== "ounce") {
    // Only a mass-magnitude unit ever lands on "ounce" here
    // (SYSTEM_TARGET_UNIT.us.mass in units.ts) -- ounce/pound are already
    // US-native and never reach convert(), so `unit` is a MassUnitCode.
    if (masses.cup !== null) return usCupLadder(quantity, unit as MassUnitCode, masses.cup);
  }

  if (system === "metric" && base.unit === "milliliter" && unit !== "milliliter") {
    // Only a foreign volume unit lands on "milliliter" here
    // (SYSTEM_TARGET_UNIT.metric.volume) -- eetlepel/theelepel/liter/
    // deciliter are already metric-native, so `unit` is one of this
    // module's own four KitchenUnitMasses keys.
    const gramsPerUnit = masses[unit as keyof KitchenUnitMasses];
    if (gramsPerUnit !== null && gramsPerUnit !== undefined) {
      return { quantity: round(quantity * gramsPerUnit), unit: "gram" };
    }
  }

  return base;
}
