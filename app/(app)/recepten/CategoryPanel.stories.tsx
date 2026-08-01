// figma: node-id=3891:17997 (+3957:11537 desktop)
import { useState } from "react";
import { CategoryPanel, type CategoryPanelTarget } from "./CategoryPanel";
import type { ActionResult, RecipeCategoryRow } from "@/lib/recipes/types";

// Dev-only mock actions — CategoryPanel never imports the real "use server"
// module itself (design/notes/CategoryPanel.md), so these stand in for
// createCategory/renameCategory/deleteCategory without needing Supabase/
// Next's request context, same precedent as CardDetailPanel.stories.tsx.
async function mockCreateCategory(input: unknown): Promise<ActionResult<RecipeCategoryRow>> {
  console.log("createCategory", input);
  return { success: true, data: input as unknown as RecipeCategoryRow };
}
async function mockRenameCategory(input: unknown): Promise<ActionResult> {
  console.log("renameCategory", input);
  return { success: true, data: undefined };
}
async function mockDeleteCategory(input: unknown): Promise<ActionResult> {
  console.log("deleteCategory", input);
  return { success: true, data: undefined };
}

const sampleCategory: RecipeCategoryRow = {
  id: "category-1",
  user_id: "user-1",
  name: "Ontbijt",
  icon: "Croissant",
  position: 1000,
  created_at: "2026-07-01T00:00:00.000Z",
  updated_at: "2026-07-01T00:00:00.000Z",
};

// `min-h-screen` wrapper (SidePanel.stories.tsx's own precedent, not
// CardDetailPanel.stories.tsx's — see this file's #125 fix entry in
// design/notes/CategoryPanel.md for why the latter is a bug, not a pattern):
// SidePanel's overlay/panel are `position: fixed`, so they contribute 0 to
// their ancestors' flow height. Without this wrapper, the Provider div that
// tests/visual/screenshot-override.css crops the baseline to collapses to
// near-zero, and the screenshot misses almost the entire panel.

// Create mode: empty name, first curated icon (Sandwich) pre-selected as the
// default. Delete button absent (nothing to delete yet) — "leeg" variant.
export const CreateCategory = () => (
  <div className="min-h-screen">
    <CategoryPanel
      open
      onClose={() => {}}
      target={{ mode: "create" }}
      onCreateCategory={mockCreateCategory}
      onRenameCategory={mockRenameCategory}
      onDeleteCategory={mockDeleteCategory}
    />
  </div>
);

// Rename mode: name prefilled from `sampleCategory`, its icon (Croissant)
// shown pressed in the picker — "ingevuld"/"hernoem"/"gekozen-icoon" variants
// in one story, same combined-coverage precedent as CardDetailPanel's
// EditItem. Click "Verwijderen" to exercise the two-step delete confirm.
export const EditCategory = () => (
  <div className="min-h-screen">
    <CategoryPanel
      open
      onClose={() => {}}
      target={{ mode: "edit", category: sampleCategory }}
      onCreateCategory={mockCreateCategory}
      onRenameCategory={mockRenameCategory}
      onDeleteCategory={mockDeleteCategory}
    />
  </div>
);

// Exercises the real open/close cycle plus create->edit target switching —
// the reset-on-open path this component uses instead of BoardPanel.tsx's
// key-remount (see CategoryPanel.tsx's own header comment). Not
// screenshot-stable by design (starts closed).
export const Interactive = () => {
  const [state, setState] = useState<{ open: boolean; target: CategoryPanelTarget }>({
    open: false,
    target: { mode: "create" },
  });

  return (
    <div className="flex gap-2">
      <button
        type="button"
        className="rounded-lg bg-surface-raised px-3 py-2 text-sm font-semibold"
        onClick={() => setState({ open: true, target: { mode: "create" } })}
      >
        Nieuwe categorie
      </button>
      <button
        type="button"
        className="rounded-lg bg-surface-raised px-3 py-2 text-sm font-semibold"
        onClick={() => setState({ open: true, target: { mode: "edit", category: sampleCategory } })}
      >
        Bewerk Ontbijt
      </button>
      <CategoryPanel
        open={state.open}
        onClose={() => setState((current) => ({ ...current, open: false }))}
        target={state.target}
        onCreateCategory={mockCreateCategory}
        onRenameCategory={mockRenameCategory}
        onDeleteCategory={mockDeleteCategory}
      />
    </div>
  );
};
