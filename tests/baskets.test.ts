import { describe, expect, it } from "vitest";
import { needsBasketChoice, toBasketOptions } from "@/lib/shopping/baskets";
import {
  addIngredientToShoppingListSchema,
  sendRecipeToShoppingListSchema,
} from "@/lib/shopping/schemas";

const option = (id: string) => ({ id, name: id, shared: false });

describe("needsBasketChoice", () => {
  it("sends directly with no or one basket", () => {
    expect(needsBasketChoice(undefined)).toBe(false);
    expect(needsBasketChoice([])).toBe(false);
    expect(needsBasketChoice([option("a")])).toBe(false);
  });

  it("asks first with more than one basket", () => {
    expect(needsBasketChoice([option("a"), option("b")])).toBe(true);
  });
});

describe("toBasketOptions", () => {
  const lists = [
    { id: "own", name: null, user_id: "me" },
    { id: "own-shared", name: "Samen", user_id: "me" },
    { id: "theirs", name: "Van Sam", user_id: "sam" },
  ];

  it("flags shared baskets and translates a null name", () => {
    expect(
      toBasketOptions({
        lists,
        acceptedShareListIds: new Set(["own-shared"]),
        userId: "me",
        defaultName: "Mijn mand",
      }),
    ).toEqual([
      { id: "own", name: "Mijn mand", shared: false },
      { id: "own-shared", name: "Samen", shared: true },
      { id: "theirs", name: "Van Sam", shared: true },
    ]);
  });
});

describe("send schemas accept a listId", () => {
  const recipeId = "6f1c1c1e-0b0a-4c3e-9a55-1f6a4d7b2c11";
  const listId = "0b7e2f3a-5c1d-4e8f-8a21-9d3c6b4a1e77";

  it("takes a uuid listId or none, and rejects other values", () => {
    expect(sendRecipeToShoppingListSchema.safeParse({ recipeId, targetPortions: 2 }).success).toBe(true);
    expect(
      sendRecipeToShoppingListSchema.safeParse({ listId, recipeId, targetPortions: 2 }).success,
    ).toBe(true);
    expect(
      sendRecipeToShoppingListSchema.safeParse({ listId: "nope", recipeId, targetPortions: 2 }).success,
    ).toBe(false);
    expect(
      addIngredientToShoppingListSchema.safeParse({
        listId: "nope",
        recipeId,
        ingredientId: recipeId,
        targetPortions: 2,
      }).success,
    ).toBe(false);
  });
});
