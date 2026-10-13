"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/organisms/PageHeader";
import { Button } from "@/components/atoms/Button";
import { BoardView, type BoardColumn } from "@/components/organisms/BoardView";
import { CardContentRecipe } from "@/components/molecules/CardContentRecipe";
import { CardContentRecipeSkeleton } from "@/components/molecules/CardContentRecipeSkeleton";
import { CardContentRecipeFailed } from "@/components/molecules/CardContentRecipeFailed";
import { SharedRecipeOffer } from "@/components/organisms/SharedRecipeOffer";
import { isIconName } from "@/components/atoms/Icon";
import { isImportErrorCode } from "@/lib/recipes/enums";
import { hasImportingRecipe } from "@/lib/recipes/import/polling";
import { hostOf } from "@/lib/recipes/import/url";
import { recipeThumbnailRouteUrl } from "@/lib/recipes/thumbnail-url";
import { applyItemMove, type CardMove } from "@/lib/boards/optimistic";
import type { CategoryWithRecipes, RecipeRow } from "@/lib/recipes/types";
import type { PendingRecipeShare } from "@/lib/sharing/types";
import { CategoryPanel, type CategoryPanelTarget } from "@/app/(app)/_components/CategoryPanel";
import { CATEGORY_ICONS } from "./category-icons";
import { RecipePanel, type RecipePanelTarget } from "./RecipePanel";
import { AddRecipeMenu } from "./AddRecipeMenu";
import { LinkImportPanel } from "./LinkImportPanel";
import { useImportPolling } from "./use-import-polling";
import { confirmIngredientMatch, retryRecipeImport, startRecipeImport } from "./import-actions";
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
  acceptRecipeOffer,
  declineRecipeOffer,
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
  /** Admin-only "Ingrediënten" link (ADR-0020 §6); omitted for everyone else. */
  ingredientsLabel?: string;
  /** Presigned card-thumbnail URLs by recipe id, minted in the page render (#391). */
  thumbnailUrls?: Record<string, string>;
  /** Recipes offered by others (#467), shown above the first category's cards. */
  offers?: PendingRecipeShare[];
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
  ingredientsLabel,
  thumbnailUrls = {},
  offers = [],
}: ReceptenBoardProps) {
  const t = useTranslations("components.cardContainer");
  const tRecipe = useTranslations("components.cardContentRecipe");
  const tErrors = useTranslations("recipes.errors");
  const tImportErrors = useTranslations("recipes.import.errors");
  const tImport = useTranslations("components.recipeImport");
  const tOfferErrors = useTranslations("sharing.errors");
  const tUnnamed = useTranslations("components.memberSearchPanel");
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

  // #318: column Plus -> "Via link / Handmatig" menu; "Via link" opens the link
  // panel for that column, "Handmatig" is today's RecipePanel (create).
  const [addMenuColumnId, setAddMenuColumnId] = useState<string | null>(null);
  const [linkPanel, setLinkPanel] = useState<{ open: boolean; categoryId: string }>({
    open: false,
    categoryId: localCategories[0]?.id ?? "",
  });

  // Polls (router.refresh) only while a card is importing and the tab is
  // visible; the lazy sweep on the server turns stuck rows into failed cards.
  useImportPolling(hasImportingRecipe(categories), () => router.refresh());

  const [busyRecipeIds, setBusyRecipeIds] = useState<ReadonlySet<string>>(new Set());
  async function runFailedCardAction(recipeId: string, action: () => Promise<{ success: boolean; error?: string }>) {
    setMoveError(null);
    setBusyRecipeIds((current) => new Set(current).add(recipeId));
    try {
      const result = await action();
      if (!result.success) setMoveError(tErrors((result.error ?? "generic") as Parameters<typeof tErrors>[0]));
      router.refresh();
    } catch {
      setMoveError(tErrors("generic"));
    } finally {
      setBusyRecipeIds((current) => {
        const next = new Set(current);
        next.delete(recipeId);
        return next;
      });
    }
  }

  // #467: accept copies the recipe to the top of the first column, decline just
  // removes the offer; both end in a refresh. One request at a time.
  const [respondingOffer, setRespondingOffer] = useState<string | null>(null);
  const [offerError, setOfferError] = useState<string | null>(null);
  async function respondToOffer(offer: PendingRecipeShare, accept: boolean) {
    setOfferError(null);
    setRespondingOffer(offer.shareId);
    try {
      const result = await (accept
        ? acceptRecipeOffer({ shareId: offer.shareId })
        : declineRecipeOffer({ recipeId: offer.recipeId }));
      if (!result.success) setOfferError(tOfferErrors(result.error));
      router.refresh();
    } catch {
      setOfferError(tOfferErrors("generic"));
    } finally {
      setRespondingOffer(null);
    }
  }

  function renderOffers(columnId: string) {
    if (offers.length === 0 || columnId !== localCategories[0]?.id) return null;
    return offers.map((offer) => (
      <SharedRecipeOffer
        key={offer.shareId}
        name={offer.title}
        imageUrl={offer.thumbnailUrl ?? undefined}
        duration={
          offer.timeMinutes != null ? tRecipe("durationMinutes", { minutes: offer.timeMinutes }) : undefined
        }
        inviterName={offer.inviterFirstName ?? tUnnamed("unnamedLabel")}
        pending={respondingOffer !== null}
        onAccept={() => void respondToOffer(offer, true)}
        onDecline={() => void respondToOffer(offer, false)}
      />
    ));
  }

  function renderRecipeCard(recipe: RecipeRow) {
    if (recipe.import_status === "importing") {
      return <CardContentRecipeSkeleton label={tImport("skeleton.loadingLabel")} />;
    }
    if (recipe.import_status === "failed") {
      const code = isImportErrorCode(recipe.import_error) ? recipe.import_error : "import_failed";
      return (
        <CardContentRecipeFailed
          title={tImport("failed.title")}
          name={hostOf(recipe.source_url ?? "") || recipe.title}
          reason={tImportErrors(code)}
          retryLabel={tImport("failed.retryLabel")}
          deleteLabel={tImport("failed.deleteLabel")}
          disabled={busyRecipeIds.has(recipe.id)}
          onRetry={() => void runFailedCardAction(recipe.id, () => retryRecipeImport({ recipeId: recipe.id }))}
          onDelete={() => void runFailedCardAction(recipe.id, () => deleteRecipe({ recipeId: recipe.id }))}
        />
      );
    }
    return (
      <CardContentRecipe
        name={recipe.title}
        // #391: presigned in the page render; the route URL is the onError
        // fallback. See design/notes/CardContentRecipe.md.
        imageUrl={thumbnailUrls[recipe.id]}
        imageFallbackUrl={
          thumbnailUrls[recipe.id] && recipe.thumbnail_path
            ? recipeThumbnailRouteUrl(recipe.id, recipe.thumbnail_path, "card")
            : undefined
        }
        duration={
          recipe.time_minutes != null
            ? tRecipe("durationMinutes", { minutes: recipe.time_minutes })
            : undefined
        }
      />
    );
  }

  return (
    <>
      <PageHeader
        title={title}
        actions={
          <div className="flex items-center gap-inline-sm md:gap-inline-xl">
            {/* Claude-designed (#321): icon-only on mobile, labelled on desktop,
                same split as Notities' sort button. design/notes/ReceptenBoard.md */}
            {ingredientsLabel && (
              <>
                <Button
                  icon="LibraryBig"
                  aria-label={ingredientsLabel}
                  className="md:hidden"
                  onClick={() => router.push("/recepten/ingredienten")}
                />
                <Button
                  icon="LibraryBig"
                  className="hidden md:inline-flex"
                  onClick={() => router.push("/recepten/ingredienten")}
                >
                  {ingredientsLabel}
                </Button>
              </>
            )}
            <Button icon="Plus" onClick={() => setPanel({ open: true, target: { mode: "create" } })}>
              {addCategoryLabel}
            </Button>
          </div>
        }
      />
      {/* Drag-persist failure only (create/update/delete errors surface
          inside CategoryPanel/RecipePanel's own forms) — same inline
          convention as TeDoenBoard.tsx (`recipes.errors.*`, no toast
          component exists in this design system yet). */}
      {moveError && <p className="text-base font-semibold text-priority-urgent">{moveError}</p>}
      {offerError && <p className="text-base font-semibold text-priority-urgent">{offerError}</p>}
      <BoardView
        columns={columns}
        onMove={handleMove}
        addLabel={t("addLabel")}
        editLabel={t("editLabel")}
        emptyLabel={t("addItemLabel")}
        onItemClick={(recipe) => {
          // Importing/failed cards have no detail page to open.
          if (recipe.import_status === "done") router.push(`/recepten/${recipe.id}`);
        }}
        onEditColumn={(columnId) => {
          const category = localCategories.find((c) => c.id === columnId);
          if (category) setPanel({ open: true, target: { mode: "edit", category } });
        }}
        onAddItem={(columnId) => setAddMenuColumnId((current) => (current === columnId ? null : columnId))}
        renderAddMenu={(columnId) => (
          <AddRecipeMenu
            open={addMenuColumnId === columnId}
            onClose={() => setAddMenuColumnId(null)}
            onViaLink={() => {
              setAddMenuColumnId(null);
              setLinkPanel({ open: true, categoryId: columnId });
            }}
            onManual={() => {
              setAddMenuColumnId(null);
              setRecipePanel({ open: true, target: { mode: "create", categoryId: columnId } });
            }}
          />
        )}
        renderItem={renderRecipeCard}
        renderColumnTop={renderOffers}
      />
      <LinkImportPanel
        open={linkPanel.open}
        onClose={() => setLinkPanel((current) => ({ ...current, open: false }))}
        categoryId={linkPanel.categoryId}
        onStartImport={startRecipeImport}
        onStarted={() => router.refresh()}
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
        onConfirmIngredientMatch={confirmIngredientMatch}
        onUploadThumbnail={uploadRecipeThumbnail}
        onMutated={() => router.refresh()}
      />
    </>
  );
}
