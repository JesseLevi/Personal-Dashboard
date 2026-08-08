import { describe, expect, it } from "vitest";
import {
  addShoppingListItemSchema,
  deleteShoppingListItemSchema,
  toggleShoppingListItemSchema,
} from "../lib/shopping/schemas";
import { UNIT_CODES } from "../lib/recipes/units";

const uuid = "123e4567-e89b-12d3-a456-426614174000";

describe("addShoppingListItemSchema", () => {
  it("accepts the minimal shape (name only)", () => {
    const result = addShoppingListItemSchema.safeParse({ name: "Melk" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.quantity).toBeNull();
      expect(result.data.unit).toBeNull();
      expect(result.data.section).toBeNull();
    }
  });

  it("accepts a full line for every unit code from #120", () => {
    for (const unit of UNIT_CODES) {
      const result = addShoppingListItemSchema.safeParse({
        name: "Havermout",
        quantity: 1,
        unit,
        section: "Zuivel",
      });
      expect(result.success, `unit "${unit}" should be accepted`).toBe(true);
    }
  });

  it("accepts an explicit null unit (manually-typed item, e.g. #175's 'melk')", () => {
    const result = addShoppingListItemSchema.safeParse({ name: "Melk", unit: null });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown unit code", () => {
    const result = addShoppingListItemSchema.safeParse({
      name: "Havermout",
      unit: "handful",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a null quantity", () => {
    const result = addShoppingListItemSchema.safeParse({
      name: "Zout",
      quantity: null,
      unit: "snufje",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a zero or negative quantity", () => {
    for (const quantity of [0, -1]) {
      const result = addShoppingListItemSchema.safeParse({
        name: "Havermout",
        quantity,
        unit: "gram",
      });
      expect(result.success, `quantity ${quantity} should be rejected`).toBe(false);
    }
  });

  it("rejects an empty name", () => {
    expect(addShoppingListItemSchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("rejects a missing name", () => {
    expect(addShoppingListItemSchema.safeParse({}).success).toBe(false);
  });

  it("accepts a section label", () => {
    const result = addShoppingListItemSchema.safeParse({ name: "Melk", section: "Zuivel" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.section).toBe("Zuivel");
    }
  });

  it("rejects an empty section label", () => {
    expect(
      addShoppingListItemSchema.safeParse({ name: "Melk", section: "" }).success,
    ).toBe(false);
  });
});

describe("toggleShoppingListItemSchema", () => {
  it("accepts an id + checked", () => {
    expect(
      toggleShoppingListItemSchema.safeParse({ id: uuid, checked: true }).success,
    ).toBe(true);
  });

  it("rejects a missing checked value", () => {
    expect(toggleShoppingListItemSchema.safeParse({ id: uuid }).success).toBe(false);
  });

  it("rejects a non-uuid id", () => {
    expect(
      toggleShoppingListItemSchema.safeParse({ id: "not-a-uuid", checked: true }).success,
    ).toBe(false);
  });
});

describe("deleteShoppingListItemSchema", () => {
  it("accepts an id", () => {
    expect(deleteShoppingListItemSchema.safeParse({ id: uuid }).success).toBe(true);
  });

  it("rejects a non-uuid id", () => {
    expect(deleteShoppingListItemSchema.safeParse({ id: "1" }).success).toBe(false);
  });
});
