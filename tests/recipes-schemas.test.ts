import { describe, expect, it } from "vitest";
import {
  createCategorySchema,
  createOwnIngredientSchema,
  createRecipeSchema,
  deleteCategorySchema,
  deleteRecipeSchema,
  renameCategorySchema,
  updateRecipeSchema,
} from "../lib/recipes/schemas";
import { UNIT_CODES } from "../lib/recipes/units";

const uuid = "123e4567-e89b-12d3-a456-426614174000";
const otherUuid = "223e4567-e89b-12d3-a456-426614174000";

describe("createCategorySchema", () => {
  it("accepts a name + icon", () => {
    expect(
      createCategorySchema.safeParse({ name: "Ontbijt", icon: "Croissant" }).success,
    ).toBe(true);
  });

  it("rejects an empty name", () => {
    expect(
      createCategorySchema.safeParse({ name: "", icon: "Croissant" }).success,
    ).toBe(false);
  });

  it("rejects an empty icon", () => {
    expect(createCategorySchema.safeParse({ name: "Ontbijt", icon: "" }).success).toBe(
      false,
    );
  });
});

describe("renameCategorySchema", () => {
  it("accepts categoryId + name", () => {
    expect(
      renameCategorySchema.safeParse({ categoryId: uuid, name: "Lunch" }).success,
    ).toBe(true);
  });

  it("rejects a missing categoryId", () => {
    expect(renameCategorySchema.safeParse({ name: "Lunch" }).success).toBe(false);
  });
});

describe("deleteCategorySchema", () => {
  it("accepts a categoryId", () => {
    expect(deleteCategorySchema.safeParse({ categoryId: uuid }).success).toBe(true);
  });

  it("rejects a non-uuid categoryId", () => {
    expect(deleteCategorySchema.safeParse({ categoryId: "not-a-uuid" }).success).toBe(
      false,
    );
  });
});

describe("createRecipeSchema", () => {
  it("accepts the minimal shape (categoryId + title only)", () => {
    const result = createRecipeSchema.safeParse({
      categoryId: uuid,
      title: "Havermoutpap",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      // .default([]) fills in empty ingredient/step sets.
      expect(result.data.ingredients).toEqual([]);
      expect(result.data.steps).toEqual([]);
    }
  });

  it("accepts a full ingredient line for every unit code from #120", () => {
    for (const unit of UNIT_CODES) {
      const result = createRecipeSchema.safeParse({
        categoryId: uuid,
        title: "X",
        ingredients: [{ name: "Havermout", quantity: 1, unit }],
      });
      expect(result.success, `unit "${unit}" should be accepted`).toBe(true);
    }
  });

  it("rejects an ingredient line with an unknown unit code", () => {
    const result = createRecipeSchema.safeParse({
      categoryId: uuid,
      title: "X",
      ingredients: [{ name: "Havermout", quantity: 1, unit: "handful" }],
    });
    expect(result.success).toBe(false);
  });

  it("accepts a null quantity (naar smaak)", () => {
    const result = createRecipeSchema.safeParse({
      categoryId: uuid,
      title: "X",
      ingredients: [{ name: "Zout", quantity: null, unit: "naar_smaak" }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a zero or negative quantity", () => {
    for (const quantity of [0, -1]) {
      const result = createRecipeSchema.safeParse({
        categoryId: uuid,
        title: "X",
        ingredients: [{ name: "Havermout", quantity, unit: "gram" }],
      });
      expect(result.success, `quantity ${quantity} should be rejected`).toBe(false);
    }
  });

  it("accepts an ingredient line with an ingredientId link and a group label", () => {
    const result = createRecipeSchema.safeParse({
      categoryId: uuid,
      title: "X",
      ingredients: [
        {
          name: "Havermout",
          quantity: 250,
          unit: "gram",
          ingredientId: otherUuid,
          groupLabel: "Droog",
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts a step line", () => {
    const result = createRecipeSchema.safeParse({
      categoryId: uuid,
      title: "X",
      steps: [{ instruction: "Verwarm de oven voor op 180 graden." }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty step instruction", () => {
    const result = createRecipeSchema.safeParse({
      categoryId: uuid,
      title: "X",
      steps: [{ instruction: "" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty title", () => {
    expect(
      createRecipeSchema.safeParse({ categoryId: uuid, title: "" }).success,
    ).toBe(false);
  });

  it("rejects a non-positive servings value", () => {
    expect(
      createRecipeSchema.safeParse({ categoryId: uuid, title: "X", servings: 0 })
        .success,
    ).toBe(false);
  });
});

describe("updateRecipeSchema", () => {
  it("accepts a recipeId with no other fields (still valid shape-wise)", () => {
    expect(updateRecipeSchema.safeParse({ recipeId: uuid }).success).toBe(true);
  });

  it("accepts a metadata-only partial update with no ingredients/steps", () => {
    const result = updateRecipeSchema.safeParse({ recipeId: uuid, title: "Nieuwe titel" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ingredients).toBeUndefined();
      expect(result.data.steps).toBeUndefined();
    }
  });

  it("accepts a full ingredients/steps replacement set", () => {
    const result = updateRecipeSchema.safeParse({
      recipeId: uuid,
      ingredients: [{ name: "Ei", quantity: 2, unit: "stuk" }],
      steps: [{ instruction: "Klop de eieren los." }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing recipeId", () => {
    expect(updateRecipeSchema.safeParse({ title: "X" }).success).toBe(false);
  });
});

describe("deleteRecipeSchema", () => {
  it("accepts a recipeId", () => {
    expect(deleteRecipeSchema.safeParse({ recipeId: uuid }).success).toBe(true);
  });

  it("rejects a non-uuid recipeId", () => {
    expect(deleteRecipeSchema.safeParse({ recipeId: "1" }).success).toBe(false);
  });
});

describe("createOwnIngredientSchema", () => {
  it("accepts a self-added ingredient (referenceId null)", () => {
    expect(
      createOwnIngredientSchema.safeParse({ name: "Kokosmelk", referenceId: null })
        .success,
    ).toBe(true);
  });

  it("accepts materialising a library pick (referenceId set)", () => {
    expect(
      createOwnIngredientSchema.safeParse({ name: "Havermout", referenceId: uuid })
        .success,
    ).toBe(true);
  });

  it("rejects a missing referenceId (must be explicit null, not omitted)", () => {
    expect(createOwnIngredientSchema.safeParse({ name: "Havermout" }).success).toBe(
      false,
    );
  });

  it("rejects an empty name", () => {
    expect(
      createOwnIngredientSchema.safeParse({ name: "", referenceId: null }).success,
    ).toBe(false);
  });
});
