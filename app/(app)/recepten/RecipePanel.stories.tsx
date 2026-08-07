// figma: node-id=3777:3918 (+3717:2844 fields, 3777:3984 read-only reference)
import { RecipePanel } from "./RecipePanel";
import { EMPTY_KITCHEN_UNIT_MASSES } from "@/lib/recipes/kitchen-units";
import { EMPTY_NUTRIENTS } from "@/lib/recipes/nutrition";
import type {
  ActionResult,
  IngredientRow,
  IngredientSearchResult,
  RecipeCategoryRow,
  RecipeRow,
  RecipeWithIngredientsAndSteps,
} from "@/lib/recipes/types";

// Dev-only mock actions — RecipePanel never imports the real "use server"
// module itself (design/notes/RecipePanel.md), same precedent as
// CardDetailPanel.stories.tsx/CategoryPanel.stories.tsx.
async function mockCreateRecipe(input: unknown): Promise<ActionResult<RecipeRow>> {
  console.log("createRecipe", input);
  return { success: true, data: input as unknown as RecipeRow };
}
async function mockUpdateRecipe(input: unknown): Promise<ActionResult> {
  console.log("updateRecipe", input);
  return { success: true, data: undefined };
}
async function mockDeleteRecipe(input: unknown): Promise<ActionResult> {
  console.log("deleteRecipe", input);
  return { success: true, data: undefined };
}
async function mockSearchIngredients(input: unknown): Promise<IngredientSearchResult[]> {
  console.log("searchIngredients", input);
  return [];
}
async function mockCreateOwnIngredient(input: unknown): Promise<ActionResult<IngredientRow>> {
  const { name } = input as { name: string };
  return {
    success: true,
    data: {
      id: "mock-created-ingredient",
      user_id: "user-1",
      reference_id: null,
      name,
      category: null,
      created_at: "2026-08-01T00:00:00.000Z",
      updated_at: "2026-08-01T00:00:00.000Z",
    },
  };
}
async function mockUploadThumbnail(formData: FormData): Promise<ActionResult<{ path: string }>> {
  const file = formData.get("thumbnail");
  console.log("uploadRecipeThumbnail", file);
  return { success: true, data: { path: "mock-user/mock-thumbnail.jpg" } };
}

const sampleCategories: RecipeCategoryRow[] = [
  {
    id: "category-ontbijt",
    user_id: "user-1",
    name: "Ontbijt",
    icon: "Croissant",
    position: 1000,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
  },
  {
    id: "category-lunch",
    user_id: "user-1",
    name: "Lunch",
    icon: "Sandwich",
    position: 2000,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
  },
  {
    id: "category-avond",
    user_id: "user-1",
    name: "Avond",
    icon: "Broccoli",
    position: 3000,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
  },
];

// Three ingredient rows (matching the fetched node's own sample values) —
// row 1 links a real `ingredient_id` (as #131's search panel would leave
// behind), row 2 has none (a self-typed line never resolved through the
// picker), row 3 links one again. Two steps.
const sampleRecipe: RecipeWithIngredientsAndSteps = {
  id: "recipe-1",
  user_id: "user-1",
  category_id: "category-ontbijt",
  title: "Blueberry Protein Packed Muffins",
  servings: 4,
  thumbnail_path: null,
  time_minutes: 25,
  position: 1000,
  created_at: "2026-07-01T00:00:00.000Z",
  updated_at: "2026-07-01T00:00:00.000Z",
  ingredients: [
    {
      id: "ingredient-row-1",
      user_id: "user-1",
      recipe_id: "recipe-1",
      ingredient_id: "own-havermout",
      name: "Havermout",
      quantity: 1250,
      unit: "gram",
      position: 1000,
      group_label: null,
      // #160: all-null today, same as the seeded data (no licensed
      // nutrition import has run, ADR-0011 §5).
      nutrients: EMPTY_NUTRIENTS,
      unitMassGrams: null,
      kitchenUnitMasses: EMPTY_KITCHEN_UNIT_MASSES,
      created_at: "2026-07-01T00:00:00.000Z",
      updated_at: "2026-07-01T00:00:00.000Z",
    },
    {
      id: "ingredient-row-2",
      user_id: "user-1",
      recipe_id: "recipe-1",
      ingredient_id: null,
      name: "Proteine poeder",
      quantity: 2,
      unit: "scoop",
      position: 2000,
      group_label: null,
      nutrients: EMPTY_NUTRIENTS,
      unitMassGrams: null,
      kitchenUnitMasses: EMPTY_KITCHEN_UNIT_MASSES,
      created_at: "2026-07-01T00:00:00.000Z",
      updated_at: "2026-07-01T00:00:00.000Z",
    },
    {
      id: "ingredient-row-3",
      user_id: "user-1",
      recipe_id: "recipe-1",
      ingredient_id: "own-citroen",
      name: "Citroen",
      quantity: 1,
      unit: "stuk",
      position: 3000,
      group_label: null,
      nutrients: EMPTY_NUTRIENTS,
      unitMassGrams: null,
      kitchenUnitMasses: EMPTY_KITCHEN_UNIT_MASSES,
      created_at: "2026-07-01T00:00:00.000Z",
      updated_at: "2026-07-01T00:00:00.000Z",
    },
  ],
  steps: [
    {
      id: "step-row-1",
      user_id: "user-1",
      recipe_id: "recipe-1",
      position: 1000,
      instruction: "Meng de droge ingrediënten in een grote kom.",
      created_at: "2026-07-01T00:00:00.000Z",
      updated_at: "2026-07-01T00:00:00.000Z",
      // #149: step<->ingredient links — seeded here to exercise
      // `RecipePanel`'s own `ingredientIds` → `ingredientLocalIds` mapping
      // (matched back onto the ingredient rows above by `recipe_ingredients.id`).
      ingredientIds: ["ingredient-row-1", "ingredient-row-2"],
    },
    {
      id: "step-row-2",
      user_id: "user-1",
      recipe_id: "recipe-1",
      position: 2000,
      instruction: "Vouw de bosbessen erdoor en verdeel over de vorm.",
      created_at: "2026-07-01T00:00:00.000Z",
      updated_at: "2026-07-01T00:00:00.000Z",
      ingredientIds: [],
    },
  ],
};

// `min-h-screen` wrapper — SidePanel.stories.tsx's own precedent
// (design/notes/SidePanel.md): SidePanel is `position: fixed`, contributing
// 0 to ancestor flow height, so the screenshot harness needs a non-zero
// crop area.

// Create mode: one empty ingredient row, one empty step, Verwijderen hidden
// (decision (i): nothing to delete yet — design/notes/RecipePanel.md).
export const Empty = () => (
  <div className="min-h-screen">
    <RecipePanel
      open
      onClose={() => {}}
      target={{ mode: "create", categoryId: "category-ontbijt" }}
      categories={sampleCategories}
      onCreateRecipe={mockCreateRecipe}
      onUpdateRecipe={mockUpdateRecipe}
      onDeleteRecipe={mockDeleteRecipe}
      onSearchIngredients={mockSearchIngredients}
      onCreateOwnIngredient={mockCreateOwnIngredient}
      onUploadThumbnail={mockUploadThumbnail}
    />
  </div>
);

// Edit mode: three ingredient rows (incl. one with and one without
// `ingredientId`), two steps, Verwijderen visible.
export const Filled = () => (
  <div className="min-h-screen">
    <RecipePanel
      open
      onClose={() => {}}
      target={{ mode: "edit", recipe: sampleRecipe }}
      categories={sampleCategories}
      onCreateRecipe={mockCreateRecipe}
      onUpdateRecipe={mockUpdateRecipe}
      onDeleteRecipe={mockDeleteRecipe}
      onSearchIngredients={mockSearchIngredients}
      onCreateOwnIngredient={mockCreateOwnIngredient}
      onUploadThumbnail={mockUploadThumbnail}
    />
  </div>
);
