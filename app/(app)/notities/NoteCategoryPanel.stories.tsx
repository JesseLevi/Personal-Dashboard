// No figma node of its own — the shared components/organisms/CategoryPanel.tsx
// configured for /notities (note icons, notes namespaces); design/notes/CategoryPanel.md.
import { useState } from "react";
import { CategoryPanel, type CategoryPanelTarget } from "@/components/organisms/CategoryPanel";
import { NOTE_CATEGORY_ICONS } from "./category-icons";
import type { ActionResult, NoteCategoryRow } from "@/lib/notes/types";

// Dev-only mock actions — the shared CategoryPanel never imports the real
// "use server" module itself (design/notes/CategoryPanel.md), so these
// stand in for createCategory/renameCategory/deleteCategory without needing
// Supabase/Next's request context, same precedent as CategoryPanel.stories.tsx.
async function mockCreateCategory(input: unknown): Promise<ActionResult<NoteCategoryRow>> {
  console.log("createCategory", input);
  return { success: true, data: input as unknown as NoteCategoryRow };
}
async function mockRenameCategory(input: unknown): Promise<ActionResult> {
  console.log("renameCategory", input);
  return { success: true, data: undefined };
}
async function mockDeleteCategory(input: unknown): Promise<ActionResult> {
  console.log("deleteCategory", input);
  return { success: true, data: undefined };
}

const sampleCategory: NoteCategoryRow = {
  id: "category-1",
  user_id: "user-1",
  name: "Werk",
  icon: "Lightbulb",
  position: 1000,
  created_at: "2026-08-13T00:00:00.000Z",
  updated_at: "2026-08-13T00:00:00.000Z",
};

// `min-h-screen` wrapper — same fix CategoryPanel.stories.tsx already ships
// (design/notes/CategoryPanel.md's own #125 entry): SidePanel's overlay/panel
// are `position: fixed`, so they contribute 0 to their ancestors' flow
// height, and without this wrapper the Playwright baseline crop collapses to
// near-zero.

// Create mode: empty name, first curated icon (FolderClosed) pre-selected.
// Delete button absent (nothing to delete yet).
export const CreateCategory = () => (
  <div className="min-h-screen">
    <CategoryPanel
      open
      onClose={() => {}}
      target={{ mode: "create" }}
      onCreateCategory={mockCreateCategory}
      icons={NOTE_CATEGORY_ICONS}
      translationNamespace="components.noteCategoryPanel"
      errorsNamespace="notes.errors"
      onUpdateCategory={mockRenameCategory}
      onDeleteCategory={mockDeleteCategory}
    />
  </div>
);

// Rename mode: name prefilled from `sampleCategory`, its icon (Lightbulb)
// shown pressed in the picker. Click "Verwijderen" to exercise the two-step
// delete confirm.
export const EditCategory = () => (
  <div className="min-h-screen">
    <CategoryPanel
      open
      onClose={() => {}}
      target={{ mode: "edit", category: sampleCategory }}
      onCreateCategory={mockCreateCategory}
      icons={NOTE_CATEGORY_ICONS}
      translationNamespace="components.noteCategoryPanel"
      errorsNamespace="notes.errors"
      onUpdateCategory={mockRenameCategory}
      onDeleteCategory={mockDeleteCategory}
    />
  </div>
);

// Exercises the real open/close cycle plus create->edit target switching —
// the reset-on-open path this component uses. Not screenshot-stable by
// design (starts closed).
export const Interactive = () => {
  const [state, setState] = useState<{ open: boolean; target: CategoryPanelTarget }>({
    open: false,
    target: { mode: "create" },
  });

  return (
    <div className="flex gap-2">
      <button
        type="button"
        className="rounded-lg bg-surface-secondary px-3 py-2 text-sm font-semibold"
        onClick={() => setState({ open: true, target: { mode: "create" } })}
      >
        Nieuwe categorie
      </button>
      <button
        type="button"
        className="rounded-lg bg-surface-secondary px-3 py-2 text-sm font-semibold"
        onClick={() => setState({ open: true, target: { mode: "edit", category: sampleCategory } })}
      >
        Bewerk Werk
      </button>
      <CategoryPanel
        open={state.open}
        onClose={() => setState((current) => ({ ...current, open: false }))}
        target={state.target}
        onCreateCategory={mockCreateCategory}
        icons={NOTE_CATEGORY_ICONS}
      translationNamespace="components.noteCategoryPanel"
      errorsNamespace="notes.errors"
      onUpdateCategory={mockRenameCategory}
        onDeleteCategory={mockDeleteCategory}
      />
    </div>
  );
};
