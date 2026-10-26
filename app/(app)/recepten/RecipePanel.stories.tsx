// figma: node-id=3777:3918 (+3717:2844 fields, 3777:3984 read-only reference)
import { useState } from "react";
import { RecipePanel, type RecipePanelTarget } from "./RecipePanel";
import { Button } from "@/components/atoms/Button";
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
import { StoryIntro } from "@/.ladle/story-kit";
import type { StoryDefault } from "@ladle/react";

export default { title: "Recepten / Recipe panel" } satisfies StoryDefault;

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
  source_url: null,
  import_status: "done",
  import_error: null,
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
      needs_review: false,
      // A NEVO-linked line: the panel shows "NEVO: … · 370 kcal per 100 g".
      nutrients: { ...EMPTY_NUTRIENTS, kcalPer100g: 370 },
      unitMassGrams: null,
      kitchenUnitMasses: EMPTY_KITCHEN_UNIT_MASSES,
      referenceIngredientId: "ref-havermout",
      linkedIngredientName: "Havermout",
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
      needs_review: false,
      nutrients: EMPTY_NUTRIENTS,
      unitMassGrams: null,
      kitchenUnitMasses: EMPTY_KITCHEN_UNIT_MASSES,
      referenceIngredientId: null,
      linkedIngredientName: null,
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
      needs_review: false,
      // Own name kept ("Citroen"), linked to NEVO's "Citroen rauw" with a weight per piece.
      nutrients: { ...EMPTY_NUTRIENTS, kcalPer100g: 29 },
      unitMassGrams: 120,
      kitchenUnitMasses: EMPTY_KITCHEN_UNIT_MASSES,
      referenceIngredientId: "ref-citroen",
      linkedIngredientName: "Citroen rauw",
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

// Most representative state: edit mode with ingredients and steps. The panel is `position: fixed`,
// so the intro sits in the dimmed area beside it.
export const Overview = () => (
  <div className="min-h-screen">
    <StoryIntro
      what="Side panel to add or edit a recipe: title, category, servings, time, photo, ingredient rows and steps, with delete behind a confirm."
      note="RecipePanel"
    />
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

// Real panel, local state: open it for a new or the sample recipe, fill the fields, add ingredient
// rows and steps, save, or press delete to see the confirm. The line below shows what was sent.
export const Interactive = () => {
  const [target, setTarget] = useState<RecipePanelTarget | null>(null);
  const [lastAction, setLastAction] = useState("Nothing sent yet");
  const report = (name: string, input: unknown) => setLastAction(`${name}: ${JSON.stringify(input)}`);

  return (
    <div className="flex max-w-prose flex-col gap-stack-md">
      <StoryIntro
        what="Open the panel for a new or an existing recipe, fill in the fields, save or delete. The line below shows what each action would send."
        note="RecipePanel"
      />
      <div className="flex gap-inline-sm">
        <Button variant="filled" onClick={() => setTarget({ mode: "create", categoryId: "category-ontbijt" })}>
          New recipe
        </Button>
        <Button variant="filled" onClick={() => setTarget({ mode: "edit", recipe: sampleRecipe })}>
          Edit sample recipe
        </Button>
      </div>
      <p className="break-words text-xs text-text-secondary">{lastAction}</p>
      <RecipePanel
        open={target !== null}
        onClose={() => setTarget(null)}
        target={target ?? { mode: "create", categoryId: "category-ontbijt" }}
        categories={sampleCategories}
        onCreateRecipe={async (input) => {
          report("createRecipe", input);
          return mockCreateRecipe(input);
        }}
        onUpdateRecipe={async (input) => {
          report("updateRecipe", input);
          return mockUpdateRecipe(input);
        }}
        onDeleteRecipe={async (input) => {
          report("deleteRecipe", input);
          return mockDeleteRecipe(input);
        }}
        onSearchIngredients={mockSearchIngredients}
        onCreateOwnIngredient={mockCreateOwnIngredient}
        onUploadThumbnail={mockUploadThumbnail}
      />
    </div>
  );
};
