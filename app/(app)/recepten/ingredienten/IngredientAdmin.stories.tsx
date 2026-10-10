// design: Claude-designed on request (#325)
import { IngredientAdmin } from "./IngredientAdmin";
import { AliasPanel } from "./AliasPanel";
import { OwnIngredientPanel } from "./OwnIngredientPanel";
import type { AdminAlias, AdminEigenIngredient } from "@/lib/recipes/ingredient-admin";
import type { ActionResult, IngredientSearchResult, ReferenceIngredientRow } from "@/lib/recipes/types";

// Dev-only mock actions: the page components never import the real "use server" module.
async function ok(input: unknown): Promise<ActionResult> {
  console.log("action", input);
  return { success: true, data: undefined };
}
async function mockSearch(): Promise<IngredientSearchResult[]> {
  const base: ReferenceIngredientRow = {
    id: "ref-1",
    name_nl: "Tomaat, rauw",
    name_en: "Tomato, raw",
    category_nl: "Groenten",
    category_en: "Vegetables",
    kcal_per_100g: 18,
    protein_g_per_100g: 0.9,
    carbs_g_per_100g: 3.5,
    fat_g_per_100g: 0.2,
    fiber_g_per_100g: 1.2,
    nutrient_basis: "per_100g",
    source: "NEVO",
    source_ref: "1",
    source_version: "2025",
  };
  return [
    { source: "reference", ingredient: base },
    { source: "reference", ingredient: { ...base, id: "ref-2", name_nl: "Tomaat, gedroogd", name_en: "Tomato, dried" } },
  ];
}

const aliases: AdminAlias[] = [
  { id: "a1", aliasNormalized: "tomaat", ingredient: { id: "ref-1", nameNl: "Tomaat, rauw", nameEn: "Tomato, raw", source: "NEVO" } },
  { id: "a2", aliasNormalized: "pindakaas", ingredient: { id: "e1", nameNl: "Pindakaas, zonder zout", nameEn: null, source: "eigen" } },
  { id: "a3", aliasNormalized: "ui", ingredient: { id: "ref-3", nameNl: "Ui, rauw", nameEn: "Onion, raw", source: "NEVO" } },
];

const eigen: AdminEigenIngredient[] = [
  {
    id: "e1",
    nameNl: "Pindakaas, zonder zout",
    nameEn: "Peanut butter, unsalted",
    categoryNl: "Smeersels",
    categoryEn: "Spreads",
    kcal: 600,
    protein: 25,
    carbs: 12,
    fat: 50,
    fiber: null,
    unitMass: { unit: "eetlepel", grams: 16 },
    sourceVersion: "2026-10-10",
  },
  {
    id: "e2",
    nameNl: "Gochujang",
    nameEn: null,
    categoryNl: null,
    categoryEn: null,
    kcal: null,
    protein: null,
    carbs: null,
    fat: null,
    fiber: null,
    unitMass: null,
    sourceVersion: "2026-10-10",
  },
];

const handlers = {
  onSearch: mockSearch,
  onCreateAlias: ok,
  onUpdateAlias: ok,
  onDeleteAlias: ok,
  onCreateEigen: ok,
  onUpdateEigen: ok,
  onDeleteEigen: ok,
};

// min-h-screen: the panels are `position: fixed`, so without it the baseline crop collapses.
export const Koppelingen = () => (
  <div className="min-h-screen">
    <IngredientAdmin title="Ingrediënten" aliases={aliases} eigen={eigen} {...handlers} />
  </div>
);

export const EigenIngredienten = () => (
  <div className="min-h-screen">
    <IngredientAdmin title="Ingrediënten" aliases={aliases} eigen={eigen} initialTab="own" {...handlers} />
  </div>
);

export const LeegKoppelingen = () => (
  <div className="min-h-screen">
    <IngredientAdmin title="Ingrediënten" aliases={[]} eigen={[]} {...handlers} />
  </div>
);

export const AliasPanelEdit = () => (
  <div className="min-h-screen">
    <AliasPanel
      open
      onClose={() => {}}
      target={{ mode: "edit", alias: aliases[0] }}
      onSearch={mockSearch}
      onCreateAlias={ok}
      onUpdateAlias={ok}
      onDeleteAlias={ok}
    />
  </div>
);

export const OwnIngredientPanelEdit = () => (
  <div className="min-h-screen">
    <OwnIngredientPanel open onClose={() => {}} target={{ mode: "edit", ingredient: eigen[0] }} onCreate={ok} onUpdate={ok} onDelete={ok} />
  </div>
);

export const OwnIngredientPanelCreate = () => (
  <div className="min-h-screen">
    <OwnIngredientPanel open onClose={() => {}} target={{ mode: "create" }} onCreate={ok} onUpdate={ok} onDelete={ok} />
  </div>
);
