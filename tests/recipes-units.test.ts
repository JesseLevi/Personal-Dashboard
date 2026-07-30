import { describe, expect, it } from "vitest";
import {
  InvalidPortionCountError,
  UNIT_CODES,
  UNITS,
  UnknownUnitError,
  convert,
  formatQuantity,
  isUnitCode,
  magnitudeOf,
  scaleQuantity,
  type CountUnitCode,
  type MassUnitCode,
  type VolumeUnitCode,
} from "../lib/recipes/units";

describe("UNITS", () => {
  it("carries exactly the codes from the ticket's table, once each", () => {
    expect(UNIT_CODES).toEqual([
      "gram",
      "kilogram",
      "ounce",
      "pound",
      "milliliter",
      "deciliter",
      "liter",
      "theelepel",
      "eetlepel",
      "cup",
      "teaspoon",
      "tablespoon",
      "fluid_ounce",
      "stuk",
      "snufje",
      "scoop",
      "naar_smaak",
    ]);
    expect(new Set(UNIT_CODES).size).toBe(UNIT_CODES.length);
  });

  it("keeps theelepel/eetlepel and teaspoon/tablespoon as distinct factors", () => {
    const factor = (code: string) => {
      const unit = UNITS.find((candidate) => candidate.code === code);
      return unit && "factor" in unit ? unit.factor : undefined;
    };
    expect(factor("theelepel")).toBe(5);
    expect(factor("teaspoon")).toBe(4.93);
    expect(factor("eetlepel")).toBe(15);
    expect(factor("tablespoon")).toBe(14.79);
  });

  it("gives count units no factor property at all", () => {
    for (const unit of UNITS) {
      if (unit.magnitude === "count") {
        expect("factor" in unit).toBe(false);
      }
    }
  });

  it("isUnitCode narrows a plain string", () => {
    expect(isUnitCode("gram")).toBe(true);
    expect(isUnitCode("furlong")).toBe(false);
  });

  it("magnitudeOf reports the right magnitude for each kind", () => {
    expect(magnitudeOf("gram")).toBe("mass");
    expect(magnitudeOf("cup")).toBe("volume");
    expect(magnitudeOf("scoop")).toBe("count");
  });
});

describe("convert", () => {
  it("converts within mass via the gram base unit", () => {
    expect(convert(1, "kilogram", "gram")).toBe(1000);
    expect(convert(1000, "gram", "kilogram")).toBe(1);
  });

  it("converts within volume via the milliliter base unit", () => {
    expect(convert(1, "liter", "milliliter")).toBe(1000);
    expect(convert(240, "milliliter", "cup")).toBe(1);
  });

  it("does not conflate theelepel/eetlepel with teaspoon/tablespoon", () => {
    // 1 theelepel (5ml) is *not* exactly 1 teaspoon (4.93ml) worth of factor.
    expect(convert(1, "theelepel", "milliliter")).toBe(5);
    expect(convert(1, "teaspoon", "milliliter")).toBeCloseTo(4.93, 10);
    expect(convert(1, "theelepel", "milliliter")).not.toBe(
      convert(1, "teaspoon", "milliliter"),
    );
  });

  it("is a no-op converting a unit to itself", () => {
    expect(convert(42, "gram", "gram")).toBe(42);
  });

  it("throws UnknownUnitError if a non-unit code reaches it past the type system", () => {
    expect(() =>
      convert(1, "gram" as MassUnitCode, "not-a-unit" as MassUnitCode),
    ).toThrow(UnknownUnitError);
  });

  // Structural (compile-time) proof that magnitude-crossing and count
  // conversion are impossible, not just unlikely -- see lib/recipes/units.ts's
  // file-header comment. This function is intentionally never called: its
  // only job is to exist for `pnpm typecheck` to check. Each `@ts-expect-error`
  // line must fail to typecheck; if any overload stops rejecting it,
  // typecheck fails because that `@ts-expect-error` becomes "unused". Left
  // uncalled so these invalid calls (which the type system should have
  // already refused) never actually execute at runtime.
  function neverCalled_typeOnlyProofs() {
    // @ts-expect-error volume -> mass is not a valid overload
    convert(1, "cup" as VolumeUnitCode, "gram" as MassUnitCode);
    // @ts-expect-error mass -> volume is not a valid overload
    convert(1, "gram" as MassUnitCode, "cup" as VolumeUnitCode);
    // @ts-expect-error a count code matches neither overload
    convert(1, "scoop" as CountUnitCode, "scoop" as CountUnitCode);
  }
  void neverCalled_typeOnlyProofs;

  it("(compile-time only) cannot mix magnitudes or convert count units", () => {
    // The real assertion is `pnpm typecheck` succeeding with the
    // `@ts-expect-error` comments above intact -- see the function comment.
    expect(typeof neverCalled_typeOnlyProofs).toBe("function");
  });
});

describe("scaleQuantity", () => {
  it("scales quantity × (targetPortions / sourcePortions)", () => {
    expect(scaleQuantity(100, 4, 8)).toBe(200);
    expect(scaleQuantity(100, 4, 2)).toBe(50);
  });

  it("keeps null ('naar smaak') null, never 0/NaN, and never crashes", () => {
    expect(scaleQuantity(null, 4, 8)).toBeNull();
    // Degenerate portions would normally throw -- a null quantity must
    // short-circuit before that check.
    expect(scaleQuantity(null, 0, -1)).toBeNull();
  });

  it("rounds a third of an egg to 0.33, not 0.3333333333333333", () => {
    const result = scaleQuantity(1, 3, 1);
    expect(result).toBe(0.33);
    expect(String(result)).not.toContain("333333");
  });

  it("scales a count unit's quantity numerically without touching magnitude", () => {
    // "2 scoops" for 4 portions -> 3 scoops for 6; the function has no
    // notion of unit, it just scales the number the same as any other.
    expect(scaleQuantity(2, 4, 6)).toBe(3);
  });

  it("handles a fractional cup notation cleanly (1/4 cup scaled to 3/8)", () => {
    expect(scaleQuantity(0.25, 4, 6)).toBe(0.38);
  });

  it("throws InvalidPortionCountError for zero portions", () => {
    expect(() => scaleQuantity(100, 0, 4)).toThrow(InvalidPortionCountError);
    expect(() => scaleQuantity(100, 4, 0)).toThrow(InvalidPortionCountError);
  });

  it("throws InvalidPortionCountError for negative portions", () => {
    expect(() => scaleQuantity(100, -4, 4)).toThrow(InvalidPortionCountError);
    expect(() => scaleQuantity(100, 4, -1)).toThrow(InvalidPortionCountError);
  });

  it("throws InvalidPortionCountError for non-finite portions", () => {
    expect(() => scaleQuantity(100, NaN, 4)).toThrow(InvalidPortionCountError);
    expect(() => scaleQuantity(100, 4, Infinity)).toThrow(
      InvalidPortionCountError,
    );
  });
});

describe("formatQuantity", () => {
  it("composes quantity + label with a space", () => {
    expect(formatQuantity(1250, "Gram")).toBe("1250 Gram");
    expect(formatQuantity(2, "Scoops")).toBe("2 Scoops");
  });

  it("trims a rounded decimal cleanly", () => {
    expect(formatQuantity(0.33, "Stuk")).toBe("0.33 Stuk");
  });

  it("shows the label alone when quantity is null ('naar smaak')", () => {
    expect(formatQuantity(null, "Naar smaak")).toBe("Naar smaak");
  });

  it("shows the number alone when the label is null (unmapped code)", () => {
    expect(formatQuantity(1250, null)).toBe("1250");
  });

  it("returns an empty string when both quantity and label are null", () => {
    expect(formatQuantity(null, null)).toBe("");
  });
});
