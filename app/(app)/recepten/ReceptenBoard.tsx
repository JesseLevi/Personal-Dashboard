"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/organisms/PageHeader";
import { Button } from "@/components/atoms/Button";
import { BoardView, type BoardColumn } from "@/components/organisms/BoardView";
import { CardContentRecipe } from "@/components/molecules/CardContentRecipe";
import { isIconName } from "@/components/atoms/Icon";
import { applyItemMove, type CardMove } from "@/lib/boards/optimistic";
import type { CategoryWithRecipes, RecipeRow } from "@/lib/recipes/types";
import { CategoryPanel, type CategoryPanelTarget } from "@/components/organisms/CategoryPanel";
import { CATEGORY_ICONS } from "./category-icons";
import { RecipePanel, type RecipePanelTarget } from "./RecipePanel";
import {
  createCategory,
  updateCategory,
  deleteCategory,
  createRecipe,
  updateRecipe,
  deleteRecipe,
  moveRecipe,
  searchIngredients,
  createOwnIngredient,
  uploadRecipeThumbnail,
} from "./actions";

// Client wrapper around BoardView (#124) — `renderItem` is a function prop
// and can't cross the Server->Client boundary, so `page.tsx` stays a Server
// Component that only fetches serialisable `CategoryWithRecipes[]` (#122)
// and this file is the lowest point the client boundary can start. Same
// split as app/(app)/te-doen/TeDoenBoard.tsx. #125 also moved `PageHeader`
// (with its now-wired "Categorie" trigger) and `CategoryPanel` in here,
// deliberately NOT following te-doen's TeDoenHeader/TeDoenBoard split: that
// split works there because BoardPanel (header-only) and CardDetailPanel
// (board-only) never target the same entity, but the header's Plus button
// and every column's pencil button both open the same CategoryPanel here —
// one shared `panel` state, one owner.
//
// #155: drag & drop between (and within) category columns, reversing #124's
// `dragDisabled` now that `recipes.position` exists to persist a drop
// against. Local-copy/pending-count/queue/revert machinery below is the
// same optimistic-update story as TeDoenBoard.tsx's own `handleMove`, just
// keyed on `localCategories` (this page has no separate "board" wrapper —
// a recipe category IS the column) instead of a nested `localBoard.columns`.
// Full reasoning for every decision below: design/notes/ReceptenBoard.md.
export interface ReceptenBoardProps {
  categories: CategoryWithRecipes[];
  /** Recepten page title (`nav.recipes`) — PageHeader now renders here, not in page.tsx. */
  title: string;
  /** Header "Categorie" trigger label (`components.pageHeader.recipes.addCategoryLabel`). */
  addCategoryLabel: string;
}

// `recipe_categories.icon` is free-text at the schema layer (deviation (a),
// same gap `board_columns.icon` already has — design/notes/TeDoenBoard.md).
// A category whose icon isn't a real `IconName` falls back to `FolderClosed`
// — the same icon Figma's own Sidebar already uses for the whole Recepten
// section (components/organisms/Sidebar.tsx's NAV_ITEMS) — a neutral
// "recipe folder" glyph, deliberately not a breakfast-specific icon like
// `Croissant` (which is only correct for the real Ontbijt category). See
// design/notes/ReceptenBoard.md.
const FALLBACK_CATEGORY_ICON = "FolderClosed";

export function ReceptenBoard({
  categories,
  title,
  addCategoryLabel,
}: ReceptenBoardProps) {
  const t = useTranslations("components.cardContainer");
  const tRecipe = useTranslations("components.cardContentRecipe");
  const tErrors = useTranslations("recipes.errors");
  const router = useRouter();

  // Local optimistic copy of `categories` (#155) — same "render from local
  // state, only re-sync from fetched data when nothing is pending" story as
  // TeDoenBoard.tsx's `localBoard`/`pendingMoves`, see that file's own
  // comment for the full Context7 citation. `pendingMoves` is a *count*, not
  // a boolean, for the same reason: two quick drags queued must not have the
  // first settling flip this back to "nothing pending" while the second is
  // still outstanding.
  const [localCategories, setLocalCategories] = useState(categories);
  const pendingMoves = useRef(0);
  useEffect(() => {
    if (pendingMoves.current === 0) setLocalCategories(categories);
  }, [categories]);

  // Serializes moveRecipe() calls one at a time — same reasoning as
  // TeDoenBoard.tsx's `moveQueue`: a second drag dropped before the first
  // request settles must not compute its target position against sibling
  // rows the first move hasn't persisted yet.
  const moveQueue = useRef<Promise<unknown>>(Promise.resolve());
  const [moveError, setMoveError] = useState<string | null>(null);

  function handleMove(move: CardMove) {
    setMoveError(null);
    const preMoveSnapshot = localCategories;
    pendingMoves.current += 1;
    setLocalCategories((current) =>
      applyItemMove<RecipeRow, "recipes", CategoryWithRecipes>(current, move, "recipes"),
    );

    moveQueue.current = moveQueue.current
      .then(() =>
        moveRecipe({
          recipeId: move.itemId,
          categoryId: move.toColumnId,
          targetIndex: move.toIndex,
        }),
      )
      .then((result) => {
        if (!result.success) {
          // Reverts to this specific move's own pre-drop snapshot — see
          // TeDoenBoard.tsx's `handleMove` for why this stays correct even
          // when a later drag already landed on top of it.
          setLocalCategories(preMoveSnapshot);
          setMoveError(tErrors(result.error));
        }
        // Success: no `router.refresh()` here, same "the optimistic state
        // already IS the landed state" reasoning as TeDoenBoard.tsx.
      })
      .catch(() => {
        setLocalCategories(preMoveSnapshot);
        setMoveError(tErrors("generic"));
      })
      .finally(() => {
        pendingMoves.current -= 1;
      });
  }

  const columns: BoardColumn<RecipeRow>[] = localCategories.map((category) => ({
    id: category.id,
    name: category.name,
    icon: isIconName(category.icon) ? category.icon : FALLBACK_CATEGORY_ICON,
    items: category.recipes,
  }));

  // `open`/`target` independent, same convention as TeDoenHeader.tsx's own
  // `panel` state: closing (X/overlay/Escape) only flips `open`, leaving
  // `target` in place so the close transition has real content to animate
  // away from.
  const [panel, setPanel] = useState<{ open: boolean; target: CategoryPanelTarget }>({
    open: false,
    target: { mode: "create" },
  });

  // Recipe add/edit panel (#126) — same independent open/target convention
  // as `panel` above. Only `create` has a wired trigger today (each
  // column's `+`, via `onAddItem` below); `edit` has no host UI yet
  // (Card-content/Recipe draws no pencil affordance) — see
  // design/notes/RecipePanel.md.
  const [recipePanel, setRecipePanel] = useState<{ open: boolean; target: RecipePanelTarget }>({
    open: false,
    target: { mode: "create", categoryId: localCategories[0]?.id ?? "" },
  });

  return (
    <>
      <PageHeader
        title={title}
        actions={
          <Button icon="Plus" onClick={() => setPanel({ open: true, target: { mode: "create" } })}>
            {addCategoryLabel}
          </Button>
        }
      />
      {/* Drag-persist failure only (create/update/delete errors surface
          inside CategoryPanel/RecipePanel's own forms) — same inline
          convention as TeDoenBoard.tsx (`recipes.errors.*`, no toast
          component exists in this design system yet). */}
      {moveError && <p className="text-base font-semibold text-priority-urgent">{moveError}</p>}
      <BoardView
        columns={columns}
        onMove={handleMove}
        addLabel={t("addLabel")}
        editLabel={t("editLabel")}
        emptyLabel={t("addItemLabel")}
        onItemClick={(recipe) => router.push(`/recepten/${recipe.id}`)}
        onEditColumn={(columnId) => {
          const category = localCategories.find((c) => c.id === columnId);
          if (category) setPanel({ open: true, target: { mode: "edit", category } });
        }}
        onAddItem={(columnId) =>
          setRecipePanel({ open: true, target: { mode: "create", categoryId: columnId } })
        }
        renderItem={(recipe) => (
          <CardContentRecipe
            name={recipe.title}
            // #171: `/api/recipe-thumbnail` route, not a resolved signed
            // URL — a recipe with no `thumbnail_path` gets no `imageUrl` at
            // all (decided here, not by letting the request 404), so
            // CardContentRecipe still renders its "no photo" placeholder.
            // See design/notes/CardContentRecipe.md.
            imageUrl={
              recipe.thumbnail_path
                ? `/api/recipe-thumbnail/${recipe.id}?v=${recipe.updated_at}&size=card`
                : undefined
            }
            duration={
              recipe.time_minutes != null
                ? tRecipe("durationMinutes", { minutes: recipe.time_minutes })
                : undefined
            }
          />
        )}
      />
      <CategoryPanel
        open={panel.open}
        onClose={() => setPanel((current) => ({ ...current, open: false }))}
        target={panel.target}
        icons={CATEGORY_ICONS}
        translationNamespace="components.categoryPanel"
        errorsNamespace="recipes.errors"
        onCreateCategory={createCategory}
        onUpdateCategory={updateCategory}
        onDeleteCategory={deleteCategory}
        onMutated={() => router.refresh()}
      />
      <RecipePanel
        open={recipePanel.open}
        onClose={() => setRecipePanel((current) => ({ ...current, open: false }))}
        target={recipePanel.target}
        categories={localCategories}
        onCreateRecipe={createRecipe}
        onUpdateRecipe={updateRecipe}
        onDeleteRecipe={deleteRecipe}
        onSearchIngredients={searchIngredients}
        onCreateOwnIngredient={createOwnIngredient}
        onUploadThumbnail={uploadRecipeThumbnail}
        onMutated={() => router.refresh()}
      />
    </>
  );
}
