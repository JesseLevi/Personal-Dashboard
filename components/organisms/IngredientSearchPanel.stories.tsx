// figma: node-id=3957:10337 (+3957:10595 desktop, panel 3957:11006)
import { IngredientSearchPanel, ingredientSearchResultKey } from "./IngredientSearchPanel";
import type {
  ActionResult,
  IngredientRow,
  IngredientSearchResult,
  ReferenceIngredientRow,
} from "@/lib/recipes/types";

// Dev-only mock actions -- IngredientSearchPanel never imports the real
// "use server" module itself (design/notes/IngredientSearchPanel.md), same
// precedent as CardDetailPanel.stories.tsx: these stand in for
// searchIngredients/createOwnIngredient without needing Supabase/Next's
// request context, which Ladle's plain Vite runtime doesn't have.

const mockReferenceIngredients: ReferenceIngredientRow[] = [
  {
    id: "ref-appel",
    name_nl: "Appel",
    name_en: "Apple",
    category: null,
    kcal_per_100g: null,
    protein_g_per_100g: null,
    carbs_g_per_100g: null,
    fat_g_per_100g: null,
    source: "hand-curated",
    source_ref: null,
    source_version: "2026-07-30",
  },
  {
    id: "ref-banaan",
    name_nl: "Banaan",
    name_en: "Banana",
    category: null,
    kcal_per_100g: null,
    protein_g_per_100g: null,
    carbs_g_per_100g: null,
    fat_g_per_100g: null,
    source: "hand-curated",
    source_ref: null,
    source_version: "2026-07-30",
  },
  {
    id: "ref-havermout",
    name_nl: "Havermout",
    name_en: "Oats",
    category: null,
    kcal_per_100g: null,
    protein_g_per_100g: null,
    carbs_g_per_100g: null,
    fat_g_per_100g: null,
    source: "hand-curated",
    source_ref: null,
    source_version: "2026-07-30",
  },
];

const mockOwnIngredients: IngredientRow[] = [
  {
    id: "own-kipfilet",
    user_id: "user-1",
    reference_id: null,
    name: "Kipfilet",
    category: null,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
  },
];

async function mockOnSearch(input: unknown): Promise<IngredientSearchResult[]> {
  const query = ((input as { query?: string } | null)?.query ?? "").toLowerCase().trim();
  if (!query) return [];
  const own = mockOwnIngredients
    .filter((ingredient) => ingredient.name.toLowerCase().includes(query))
    .map((ingredient): IngredientSearchResult => ({ source: "own", ingredient }));
  const reference = mockReferenceIngredients
    .filter((ingredient) => ingredient.name_nl.toLowerCase().includes(query))
    .map((ingredient): IngredientSearchResult => ({ source: "reference", ingredient }));
  return [...own, ...reference];
}

let mockCreatedCount = 0;
async function mockOnCreateOwnIngredient(input: unknown): Promise<ActionResult<IngredientRow>> {
  const { name, referenceId } = input as { name: string; referenceId: string | null };
  mockCreatedCount += 1;
  return {
    success: true,
    data: {
      id: `mock-created-${mockCreatedCount}`,
      user_id: "user-1",
      reference_id: referenceId,
      name,
      category: null,
      created_at: "2026-08-01T00:00:00.000Z",
      updated_at: "2026-08-01T00:00:00.000Z",
    },
  };
}

function logSave(ingredients: IngredientRow[]) {
  console.log("IngredientSearchPanel saved", ingredients);
}

// SidePanel is `position: fixed`, so it contributes 0 to ancestor flow
// height -- `min-h-screen` gives the screenshot harness a non-zero crop
// area, same idiom SidePanel.stories.tsx/CardDetailPanel.stories.tsx use.

// Not yet searched -- only the prompt copy is visible, no Card.
export const Empty = () => (
  <div className="min-h-screen">
    <IngredientSearchPanel
      open
      onClose={() => {}}
      onSearch={mockOnSearch}
      onCreateOwnIngredient={mockOnCreateOwnIngredient}
      onSave={logSave}
    />
  </div>
);

// Matches one own ingredient (Kipfilet) and two reference ingredients
// (Appel, Havermout) via the shared substring "e" -- exercises both sources
// in the same list, all rows unchecked (matches the fetched Figma mock).
export const FilledResults = () => (
  <div className="min-h-screen">
    <IngredientSearchPanel
      open
      onClose={() => {}}
      onSearch={mockOnSearch}
      onCreateOwnIngredient={mockOnCreateOwnIngredient}
      onSave={logSave}
      initialQuery="e"
    />
  </div>
);

// Zero results -- exercises the "add as new ingredient" affordance, the
// deliberate deviation from Figma (see the component's own header comment
// and design/notes/IngredientSearchPanel.md).
export const ZeroResultsWithAddNew = () => (
  <div className="min-h-screen">
    <IngredientSearchPanel
      open
      onClose={() => {}}
      onSearch={mockOnSearch}
      onCreateOwnIngredient={mockOnCreateOwnIngredient}
      onSave={logSave}
      initialQuery="Kaneel"
    />
  </div>
);

// Same "e" result set as FilledResults, with Appel (reference) and Kipfilet
// (own) pre-checked via `initialSelectedIds` -- the fetched node draws no
// checked example at all (design/notes/CardContentIngredient.md), so this
// reuses the Checked styling already built for the recipe detail screen.
export const SomeRowsChecked = () => (
  <div className="min-h-screen">
    <IngredientSearchPanel
      open
      onClose={() => {}}
      onSearch={mockOnSearch}
      onCreateOwnIngredient={mockOnCreateOwnIngredient}
      onSave={logSave}
      initialQuery="e"
      initialSelectedIds={[
        ingredientSearchResultKey({ source: "reference", ingredient: mockReferenceIngredients[0] }),
        ingredientSearchResultKey({ source: "own", ingredient: mockOwnIngredients[0] }),
      ]}
    />
  </div>
);
