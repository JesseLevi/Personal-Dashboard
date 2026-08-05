// Canonical unit list + conversion/scaling/formatting for Recepten (#120,
// Phase 4 wave 1). Pure and framework-free on purpose, same house style as
// lib/boards/positioning.ts: no Supabase import, testable without a
// database (tests/recipes-units.test.ts), safe to import from client code.
//
// -- Structural (not runtime) unconvertibility of `count` units -----------
// UNITS is a plain `as const` array, not a hand-written discriminated union,
// but `as const` already gives each literal object its own type, so the
// union TS infers *is* a discriminated union on `magnitude`: mass/volume
// entries carry a `factor`, count entries do not have that property at all.
// `convert()` below is declared as two overloads -- (mass, mass) and
// (volume, volume) -- with no overload accepting a `count` code or mixed
// magnitudes. Calling it with a count code, or with one mass + one volume
// code, is therefore a compile error, not a thrown exception (verified with
// `@ts-expect-error` in tests/recipes-units.test.ts). This is deliberate:
// the ticket asks for the impossibility to be structural, not a runtime
// guard that a caller could still trigger by mistake.
//
// -- Two separate mechanisms, do not merge (ADR-0011 §3) ------------------
// This file only ever converts *within* a magnitude (volume<->volume,
// mass<->mass) using the fixed `factor` below. It has no notion of any
// particular ingredient. Turning "1 cup havermout" or "1 stuk ei" into a
// gram weight is a per-(ingredient, unit) lookup against
// reference.ingredient_unit_masses / public.ingredient_unit_masses
// (ADR-0011 §3), resolved user-override-first -- that resolution function
// belongs to #122, not here. Do not add ingredient-aware logic to this
// module; it must stay a pure unit-conversion library.
//
// -- Enum-sync mechanism for #119 ------------------------------------------
// #119 will add `recipe_ingredients.unit` as a Postgres enum sourced from
// the `code`s below, and ADR-0011 §3's `ingredient_unit_masses.unit` must
// use the same codes. `lib/database.types.ts` is hand-written and carries
// no `unit` enum yet, and no recipe migration exists yet on this branch, so
// there is nothing to compare UNIT_CODES against at the type level today.
// The enforcement mechanism is therefore a *tripwire test*
// (tests/recipes-units-enum-sync.test.ts): it scans supabase/migrations/
// for a `create type ... as enum (...)` declaration whose name contains
// "unit", and asserts its values exactly equal UNIT_CODES. With no such
// migration yet, that test passes trivially (nothing found); the day #119
// lands its migration, the same test starts asserting real equality and
// fails loudly on any drift. The tripwire also refuses to silently pass if
// it finds the word "unit" near "create type" in a shape its parser doesn't
// recognise -- see that file's own header comment. #119's implementer:
// this is the file to make the tripwire test start comparing against real
// values, and ADR-0011 §3's implementer (#130) must use these same codes
// for `ingredient_unit_masses.unit`.
//
// The list below is *decided* (user, 2026-07-29), and the cost of changing it
// is asymmetric: adding a value later is cheap (`alter type ... add value`),
// while removing or renaming one is expensive once real recipes reference it.
// So extend this list only deliberately, and flag any deviation in the PR
// rather than quietly editing it.

/** The three closed magnitudes a unit can belong to. `count` units have no
 * base-unit factor and cannot convert to anything, structurally (see above). */
export type Magnitude = "mass" | "volume" | "count";

// Base units: mass -> gram, volume -> milliliter. `factor` is the multiplier
// from one unit to its magnitude's base unit (e.g. 1 kilogram = 1000 grams).
//
// theelepel/eetlepel (Dutch measuring spoons) and teaspoon/tablespoon
// (US customary) are deliberately separate entries with different factors
// (5 vs 4.93 ml, 15 vs 14.79 ml) -- a Dutch recipe keeps "el", an American
// one keeps "tbsp", and conversion uses the real factor instead of treating
// them as equal. Do not merge them.
export const UNITS = [
  { code: "gram", magnitude: "mass", factor: 1 },
  { code: "kilogram", magnitude: "mass", factor: 1000 },
  { code: "ounce", magnitude: "mass", factor: 28.35 },
  { code: "pound", magnitude: "mass", factor: 453.59 },
  { code: "milliliter", magnitude: "volume", factor: 1 },
  { code: "deciliter", magnitude: "volume", factor: 100 },
  { code: "liter", magnitude: "volume", factor: 1000 },
  { code: "theelepel", magnitude: "volume", factor: 5 },
  { code: "eetlepel", magnitude: "volume", factor: 15 },
  { code: "cup", magnitude: "volume", factor: 240 },
  { code: "teaspoon", magnitude: "volume", factor: 4.93 },
  { code: "tablespoon", magnitude: "volume", factor: 14.79 },
  { code: "fluid_ounce", magnitude: "volume", factor: 29.57 },
  { code: "stuk", magnitude: "count" },
  { code: "snufje", magnitude: "count" },
  { code: "scoop", magnitude: "count" },
  { code: "naar_smaak", magnitude: "count" },
] as const satisfies readonly { code: string; magnitude: Magnitude; factor?: number }[];

export type Unit = (typeof UNITS)[number];
export type UnitCode = Unit["code"];

export const UNIT_CODES: readonly UnitCode[] = UNITS.map((unit) => unit.code);

export function isUnitCode(value: string): value is UnitCode {
  return (UNIT_CODES as readonly string[]).includes(value);
}

type MassUnit = Extract<Unit, { magnitude: "mass" }>;
type VolumeUnit = Extract<Unit, { magnitude: "volume" }>;
type CountUnit = Extract<Unit, { magnitude: "count" }>;

export type MassUnitCode = MassUnit["code"];
export type VolumeUnitCode = VolumeUnit["code"];
export type CountUnitCode = CountUnit["code"];

export function magnitudeOf(code: UnitCode): Magnitude {
  // UNIT_CODES is derived from UNITS, so this lookup cannot miss for a
  // well-typed UnitCode; the `as Unit` cast just satisfies noUncheckedIndexedAccess-
  // style strictness without a redundant runtime branch that could never run.
  const unit = UNITS.find((candidate) => candidate.code === code) as Unit;
  return unit.magnitude;
}

/** Thrown by `convert()` if a unit code somehow reaches it without a known
 * `factor` (e.g. an unvalidated value cast past the type system). The
 * (mass, mass) / (volume, volume) overloads below make this unreachable
 * from normally-typed call sites -- this is a defensive backstop, not the
 * primary enforcement mechanism. */
export class UnknownUnitError extends Error {
  constructor() {
    // No row/user content in the message -- this can end up in logs.
    super("unit code has no conversion factor");
    this.name = "UnknownUnitError";
  }
}

function factorFor(code: MassUnitCode | VolumeUnitCode): number {
  const unit = UNITS.find((candidate) => candidate.code === code);
  if (!unit || unit.magnitude === "count") {
    throw new UnknownUnitError();
  }
  return unit.factor;
}

/**
 * Converts a quantity between two units of the *same* magnitude via each
 * unit's factor to its shared base unit. Same-magnitude only, per ADR-0011:
 * volume<->volume or mass<->mass, never volume<->mass (no density table).
 * Overloaded rather than generic so that mixing magnitudes, or passing a
 * `count` code, is a compile error -- see the file-header comment.
 */
export function convert(
  quantity: number,
  from: MassUnitCode,
  to: MassUnitCode,
): number;
export function convert(
  quantity: number,
  from: VolumeUnitCode,
  to: VolumeUnitCode,
): number;
export function convert(
  quantity: number,
  from: MassUnitCode | VolumeUnitCode,
  to: MassUnitCode | VolumeUnitCode,
): number {
  return (quantity * factorFor(from)) / factorFor(to);
}

/** Thrown by `scaleQuantity()` for zero/negative/non-finite portion counts.
 * Message carries no row/user content -- this can end up in logs. */
export class InvalidPortionCountError extends Error {
  constructor() {
    super("portion counts must be finite numbers greater than zero");
    this.name = "InvalidPortionCountError";
  }
}

// Rounding rule, chosen deliberately (Architecture.md §9 calls portion
// scaling a high-value test target):
//
// Round to 2 decimal places, with the standard `+ Number.EPSILON` correction
// for binary floating point (plain `Math.round(x * 100) / 100` still
// mis-rounds some values, e.g. 1.005). Two decimals is enough precision for
// every unit this library carries (nobody doses a thousandth of a gram in a
// home kitchen) and it directly fixes the exact defect the ticket calls
// out: scaling 1 egg by 1/3 must read "0.33", not
// "0.3333333333333333". Rounding once here, at the data layer, means every
// consumer (the formatter below, a future UI) gets a clean number for free
// instead of re-implementing display rounding at each call site.
function roundQuantity(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Scales a recipe quantity from a source portion count to a target portion
 * count: `quantity * (targetPortions / sourcePortions)`, rounded per
 * `roundQuantity` above.
 *
 * - `quantity === null` ("naar smaak") always stays `null` -- never 0, never
 *   NaN, never a crash -- checked before the portion counts are validated,
 *   so a `null` quantity never triggers `InvalidPortionCountError` either.
 * - `count` units (stuk, scoop, ...) scale numerically like any other unit
 *   (2 scoops for 4 people -> 3 scoops for 6) but this function has no
 *   notion of unit at all, so it can never change a value's magnitude.
 * - Zero, negative, or non-finite portion counts throw
 *   `InvalidPortionCountError` rather than dividing by zero or propagating
 *   `NaN`/`Infinity` silently.
 */
export function scaleQuantity(
  quantity: number | null,
  sourcePortions: number,
  targetPortions: number,
): number | null {
  if (quantity === null) return null;
  if (
    !Number.isFinite(sourcePortions) ||
    !Number.isFinite(targetPortions) ||
    sourcePortions <= 0 ||
    targetPortions <= 0
  ) {
    throw new InvalidPortionCountError();
  }
  return roundQuantity(quantity * (targetPortions / sourcePortions));
}

/** The two systems #160's "Pas aan" panel toggles between (Figma: "Metrisch"
 * / "Amerikaans"). Purely a display-layer concept -- nothing is persisted,
 * see design/notes/RecipeDetailPage.md. */
export type UnitSystem = "metric" | "us";

// One flagship unit per magnitude per system -- a build decision, not a
// Figma spec: the fetched Eenheid annotation only names the two system
// labels, never which specific unit each magnitude should render as. Metric
// maps to each magnitude's own base unit (gram/milliliter, factor 1 --
// matching how most stored recipe_ingredients rows already use them); US
// maps to the two most commonly recognised US customary units (ounce/cup)
// rather than a "best-fit" unit chosen per quantity, which would need
// ingredient-agnostic magnitude-selection logic this module doesn't have
// and the ticket doesn't ask for. Flagged, not silently invented --
// docs/open-questions.md's now-resolved metric-imperial-conversion entry
// records this choice.
const SYSTEM_UNIT: Record<UnitSystem, { mass: MassUnitCode; volume: VolumeUnitCode }> = {
  metric: { mass: "gram", volume: "milliliter" },
  us: { mass: "ounce", volume: "cup" },
};

/**
 * Converts one ingredient row's quantity+unit to the flagship unit of
 * `system` for that unit's magnitude (see `SYSTEM_UNIT` above), the #160 UI
 * entry point for this file's own `convert()`. `count` units (stuk, scoop,
 * snufje, naar_smaak) are structurally unconvertible (file header) and pass
 * through unchanged, same for `quantity === null` ("naar smaak") -- nothing
 * to convert either way. Already-matching units skip the arithmetic
 * entirely rather than round-tripping through `convert()` for a no-op.
 */
export function convertToUnitSystem(
  quantity: number | null,
  unit: UnitCode,
  system: UnitSystem,
): { quantity: number | null; unit: UnitCode } {
  const magnitude = magnitudeOf(unit);
  if (magnitude === "count" || quantity === null) return { quantity, unit };
  const target = SYSTEM_UNIT[system][magnitude];
  if (unit === target) return { quantity, unit };
  const converted =
    magnitude === "mass"
      ? convert(quantity, unit as MassUnitCode, target as MassUnitCode)
      : convert(quantity, unit as VolumeUnitCode, target as VolumeUnitCode);
  return { quantity: roundQuantity(converted), unit: target };
}

// Mirrors roundQuantity's 2-decimal precision, then trims trailing zeros so
// whole numbers print as "1250" (not "1250.00") and thirds print as "0.33"
// (not "0.330000000000001" -- `toFixed` alone doesn't remove those). This
// deliberately emits decimals, not vulgar fractions ("0.25 Cup", not "1/4
// Cup"), which reads differently from the detail-page design --
// see docs/open-questions.md#fraction-notation-vs-decimal-formatter.
function formatNumber(value: number): string {
  return Number(value.toFixed(2)).toString();
}

/**
 * Composes a quantity and an already-resolved unit label into one display
 * string -- the design's Tag content on the ingredient overlay (`3777:4012`)
 * and recipe detail page (`3778:3792`), e.g. "1250 Gram", "2 Scoops". Stays
 * i18n-free on purpose (no next-intl import, no hardcoded strings): the
 * caller resolves the label (typically a next-intl `t()` call keyed by this
 * module's `UnitCode`) and passes the resolved string in.
 *
 * null handling, both deliberate:
 * - `quantity === null` ("naar smaak"): the label alone, with no leading
 *   number -- "Naar smaak", not "null Naar smaak" or "0 Naar smaak".
 * - `label === null` (resolver had nothing for this code): the number
 *   alone, rather than leaking the internal unit `code` into a user-facing
 *   string. If both are `null`/missing there is nothing sensible to show,
 *   so the result is `""`.
 */
export function formatQuantity(
  quantity: number | null,
  label: string | null,
): string {
  if (quantity === null) return label ?? "";
  const quantityText = formatNumber(quantity);
  return label === null ? quantityText : `${quantityText} ${label}`;
}
