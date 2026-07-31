"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { BoardView, type BoardColumn } from "@/components/organisms/BoardView";
import { CardContentRecipe } from "@/components/molecules/CardContentRecipe";
import { isIconName } from "@/components/atoms/Icon";
import type { CategoryWithRecipes, RecipeRow } from "@/lib/recipes/types";

// Client wrapper around BoardView (#124) — `renderItem` is a function prop
// and can't cross the Server->Client boundary, so `page.tsx` stays a Server
// Component that only fetches serialisable `CategoryWithRecipes[]` (#122)
// and this file is the lowest point the client boundary can start. Same
// split as app/(app)/te-doen/TeDoenBoard.tsx. Full reasoning for every
// decision below: design/notes/ReceptenBoard.md.
export interface ReceptenBoardProps {
  categories: CategoryWithRecipes[];
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

export function ReceptenBoard({ categories }: ReceptenBoardProps) {
  const t = useTranslations("components.cardContainer");
  const tRecipe = useTranslations("components.cardContentRecipe");
  const router = useRouter();

  const columns: BoardColumn<RecipeRow>[] = categories.map((category) => ({
    id: category.id,
    name: category.name,
    icon: isIconName(category.icon) ? category.icon : FALLBACK_CATEGORY_ICON,
    items: category.recipes,
  }));

  return (
    <BoardView
      columns={columns}
      // recipes carry no `position` column by design (see the recipe-schema
      // migration's own file header) — a drop's target index would have
      // nothing real to persist against, the same "meaningless index"
      // reasoning TeDoenBoard.tsx applies to a sorted view. See
      // design/notes/ReceptenBoard.md for the alternative considered.
      dragDisabled
      addLabel={t("addLabel")}
      editLabel={t("editLabel")}
      emptyLabel={t("addItemLabel")}
      onItemClick={(recipe) => router.push(`/recepten/${recipe.id}`)}
      renderItem={(recipe) => (
        <CardContentRecipe
          name={recipe.title}
          // `imageUrl` left unset: `recipes.thumbnail_path` has no real value
          // yet (#121 storage bucket not built) and CardContentRecipe itself
          // now renders the "no photo" placeholder when absent — see
          // design/notes/CardContentRecipe.md's "#124" entry.
          duration={
            recipe.time_minutes != null
              ? tRecipe("durationMinutes", { minutes: recipe.time_minutes })
              : undefined
          }
        />
      )}
    />
  );
}
