// figma: node-id=4164:25190 (Skeleton/Mobile) / 4164:25197 (Skeleton/Desktop)
import type { ReactNode } from "react";
import { BoardSkeleton } from "./BoardSkeleton";

// Stands in for AppShellNav's <main>, which supplies the left padding and the
// page-stack gap the skeleton's own wrapper sits inside.
const Page = ({ children }: { children: ReactNode }) => (
  <div className="flex flex-col gap-page-stack pl-page-left">{children}</div>
);

export const Recipes = () => (
  <Page>
    <BoardSkeleton variant="recipes" counts={[4, 3, 2]} />
  </Page>
);

export const Todo = () => (
  <Page>
    <BoardSkeleton variant="todo" counts={[4, 3, 2]} />
  </Page>
);

export const Notes = () => (
  <Page>
    <BoardSkeleton variant="notes" counts={[4, 3, 2]} />
  </Page>
);

export const RecipesMixedCounts = () => (
  <Page>
    <BoardSkeleton variant="recipes" counts={[4, 1, 0]} />
  </Page>
);

export const HeaderOnly = () => (
  <Page>
    <BoardSkeleton variant="todo" />
  </Page>
);
