import type { MassResolution } from "@/lib/recipes/types";
import { convert, magnitudeOf, type UnitCode, type VolumeUnitCode } from "@/lib/recipes/units";

// ADR-0011 §3's precedence decision (user override -> reference ->
// unresolved), pulled out of lib/recipes/queries.ts's
// resolveIngredientUnitMass into its own pure, framework-free module —
// same split as lib/boards/positioning.ts's nextPosition vs. its
// DB-touching callers: no Supabase import here, so it is testable without a
// database (tests/recipes-mass-resolution.test.ts) and safe to import from
// client code if a future UI ever needs to reason about the ordering
// itself. queries.ts is the only Supabase-dependent shell around this.

/**
 * Pure precedence decision behind resolveIngredientUnitMass: user override
 * grams (or `null` if none/not fetched) wins over reference grams (or
 * `null`), which wins over `{ status: "unresolved" }`. Branches on
 * `!== null`, not truthiness, so a legitimate 0-gram override or reference
 * value is never silently skipped in favor of the next layer — the same
 * pitfall ADR-0011 §4 names for the (still-empty) nutrition columns.
 */
export function resolveMass(
  userOverrideGrams: number | null,
  referenceGrams: number | null,
): MassResolution {
  if (userOverrideGrams !== null) return { status: "resolved", grams: userOverrideGrams };
  if (referenceGrams !== null) return { status: "resolved", grams: referenceGrams };
  return { status: "unresolved" };
}

// ============================================================================
// #164/#157 slice 1: the volume->ml bridge (and the closely related spoon
// bridge). Extends resolveMass above with two more, lower-priority tiers
// rather than replacing it -- see resolveMassWithBridge's own doc comment
// for the full five-tier order. This module stays ingredient-blind and
// framework-free exactly like the rest of the file; units.ts's own header
// (ADR-0011 §3) is the reason this bridge logic lives here and not there:
// "Turning '1 cup havermout' ... into a gram weight is a per-(ingredient,
// unit) lookup ... that resolution function belongs to #122[/this
// ticket], not [units.ts]." All arithmetic below reuses units.ts's
// existing `convert()` factor table -- no gram-per-ml or ml-per-spoon
// number is duplicated here.
// ============================================================================

/**
 * Grams-per-1-unit lookups the bridge tiers draw from, one instance per
 * ownership layer (user override / reference) -- mirrors resolveMass's own
 * `userOverrideGrams`/`referenceGrams` pair, just widened to the extra
 * units a bridge can be built from. `null` means "no row fetched or no
 * matching row", never a stand-in for zero.
 */
export interface BridgeUnitGrams {
  /** Grams for 1 milliliter of this ingredient (its density). ml-bridge source. */
  milliliter: number | null;
  /** Grams for 1 eetlepel. Spoon-bridge source for a `tablespoon` request. */
  eetlepel: number | null;
  /** Grams for 1 theelepel. Spoon-bridge source for a `teaspoon` request. */
  theelepel: number | null;
  /** Grams for 1 tablespoon. Spoon-bridge source for an `eetlepel` request (the "vice versa" direction). */
  tablespoon: number | null;
  /** Grams for 1 teaspoon. Spoon-bridge source for a `theelepel` request (the "vice versa" direction). */
  teaspoon: number | null;
}

/**
 * Builds one ownership layer's `BridgeUnitGrams` (mass-resolution.ts) from
 * a `unit -> grams` lookup already fetched for one ingredient — shared by
 * queries.ts's `nutritionInputsForIngredients` batched map lookup,
 * `resolveIngredientUnitMass`'s single-ingredient row list and the recipe
 * import's unit-grams lookup (lib/recipes/import/unit-grams.ts). Only
 * `milliliter`/`eetlepel`/`theelepel` are ever populated here
 * (`tablespoon`/`teaspoon` stay `null`): this app's recipes are authored
 * in Dutch `eetlepel`/`theelepel`, not US `tablespoon`/`teaspoon`, so
 * fetching those two extra units for every ingredient would be dead
 * weight — `resolveMassWithBridge` itself stays fully bidirectional for
 * tests/future callers, this is just what the query sites
 * choose to feed it.
 */
export function bridgeUnitGramsFrom(gramsForUnit: (unit: string) => number | null): BridgeUnitGrams {
  return {
    milliliter: gramsForUnit("milliliter"),
    eetlepel: gramsForUnit("eetlepel"),
    theelepel: gramsForUnit("theelepel"),
    tablespoon: null,
    teaspoon: null,
  };
}

/** No bridge data fetched/available -- both bridge tiers fall straight
 * through to the next tier for every unit. */
export const EMPTY_BRIDGE_UNIT_GRAMS: BridgeUnitGrams = {
  milliliter: null,
  eetlepel: null,
  theelepel: null,
  tablespoon: null,
  teaspoon: null,
};

// -- ml bridge ---------------------------------------------------------------
// A reference/override row measured in `milliliter` (this ingredient's
// density, g per 1 ml -- #164/#157's USDA seed) can stand in for ANY
// requested volume unit: grams-per-unit = density x (ml per 1 of that
// unit). Applies only when the requested unit's magnitude is "volume"
// (mass/count units have no ml equivalent to bridge from). Rationale for
// ranking this BELOW the exact-unit tiers (see resolveMassWithBridge): a
// measurement for the actual requested unit always beats one derived
// through a volume conversion, so exactness outranks source (a reference
// row can outrank a "bridged" user override, never the reverse-ordered
// pair of exact tiers).

function mlBridgeGrams(unit: UnitCode, bridge: BridgeUnitGrams): number | null {
  if (magnitudeOf(unit) !== "volume" || bridge.milliliter === null) return null;
  const mlPerUnit = convert(1, unit as VolumeUnitCode, "milliliter");
  return bridge.milliliter * mlPerUnit;
}

// -- spoon bridge --------------------------------------------------------
// eetlepel <-> tablespoon and theelepel <-> teaspoon are each pairs of
// near-identical spoons (15 vs 14.79 ml, 5 vs 4.93 ml -- units.ts's own
// factor table), so a row measured in one resolves a request for the
// other via an exact volume conversion of a REAL measured value -- not an
// inferred density the way the ml bridge is. Unlike a cup (a 16x
// extrapolation across cup<->ml, a much larger semantic jump than one
// spoon size to a near-identical other spoon size), this is trustworthy
// enough to prefer over the ml bridge when both are available at the same
// ownership tier (see resolveMassWithBridge). Bidirectional per the
// ticket: an eetlepel row resolves a `tablespoon` request AND a
// tablespoon row resolves an `eetlepel` request (same for
// theelepel/teaspoon). Deliberately kept as its own small table + function
// (SPOON_BRIDGE_SOURCE / spoonBridgeGrams), separate from the ml bridge
// above, so either one can be removed independently without touching the
// other if the user vetoes it.

const SPOON_BRIDGE_SOURCE: Partial<Record<VolumeUnitCode, keyof BridgeUnitGrams>> = {
  tablespoon: "eetlepel",
  eetlepel: "tablespoon",
  teaspoon: "theelepel",
  theelepel: "teaspoon",
};

function spoonBridgeGrams(unit: UnitCode, bridge: BridgeUnitGrams): number | null {
  if (magnitudeOf(unit) !== "volume") return null;
  const sourceUnit = SPOON_BRIDGE_SOURCE[unit as VolumeUnitCode];
  if (sourceUnit === undefined) return null;
  const sourceGrams = bridge[sourceUnit];
  if (sourceGrams === null) return null;
  const factor = convert(1, unit as VolumeUnitCode, sourceUnit as VolumeUnitCode);
  return sourceGrams * factor;
}

/** One ownership layer's bridged grams-per-unit, spoon bridge preferred
 * over the ml bridge when both resolve (see spoonBridgeGrams's doc
 * comment for why the spoon conversion is the more trustworthy of the
 * two) -- `null` when neither applies. */
function bridgedGrams(unit: UnitCode, bridge: BridgeUnitGrams): number | null {
  return spoonBridgeGrams(unit, bridge) ?? mlBridgeGrams(unit, bridge);
}

/**
 * Extends resolveMass with two more, lower-priority tiers -- the full
 * order (ADR-0011 §3, amended for #164/#157):
 *   1. user override row for the EXACT unit
 *   2. reference row for the EXACT unit
 *   3. user override bridge (spoon bridge, then ml bridge) for `unit`
 *   4. reference bridge (spoon bridge, then ml bridge) for `unit`
 *   5. unresolved
 * Tiers 1-2 are resolveMass itself, called unmodified -- this function
 * extends it rather than reimplementing it. Tiers 3-4 only ever fire for
 * a volume-magnitude `unit` (mlBridgeGrams/spoonBridgeGrams both no-op
 * otherwise) and only when the caller actually fetched bridge data for
 * that ownership layer -- pass EMPTY_BRIDGE_UNIT_GRAMS when it didn't.
 * Same `!== null` (never truthiness) discipline as resolveMass throughout,
 * so a real 0-gram bridged value is never coerced into "unresolved".
 */
export function resolveMassWithBridge(
  unit: UnitCode,
  userOverrideGrams: number | null,
  referenceGrams: number | null,
  userBridge: BridgeUnitGrams,
  referenceBridge: BridgeUnitGrams,
): MassResolution {
  const exact = resolveMass(userOverrideGrams, referenceGrams);
  if (exact.status === "resolved") return exact;

  const userBridged = bridgedGrams(unit, userBridge);
  if (userBridged !== null) return { status: "resolved", grams: userBridged };

  const referenceBridged = bridgedGrams(unit, referenceBridge);
  if (referenceBridged !== null) return { status: "resolved", grams: referenceBridged };

  return { status: "unresolved" };
}
