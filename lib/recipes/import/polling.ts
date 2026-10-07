import type { RecipeRow } from "@/lib/recipes/types";

// Board polling while an import runs (#318). Pure and framework-free so it is
// unit-testable without a DOM; app/(app)/recepten/use-import-polling.ts wraps
// it in a hook. Polls only while at least one card is `importing` and only
// while the tab is visible; coming back to a visible tab refreshes at once.

export const IMPORT_POLL_INTERVAL_MS = 2500;

export const hasImportingRecipe = (categories: Array<{ recipes: Pick<RecipeRow, "import_status">[] }>): boolean =>
  categories.some((category) => category.recipes.some((recipe) => recipe.import_status === "importing"));

export type PollingDocument = {
  readonly visibilityState: string;
  addEventListener: (type: "visibilitychange", listener: () => void) => void;
  removeEventListener: (type: "visibilitychange", listener: () => void) => void;
};

/** Starts polling; returns the stop function. `onPoll` is never called while the tab is hidden. */
export function startImportPolling(options: {
  doc: PollingDocument;
  onPoll: () => void;
  intervalMs?: number;
}): () => void {
  const { doc, onPoll, intervalMs = IMPORT_POLL_INTERVAL_MS } = options;
  const visible = () => doc.visibilityState === "visible";
  const timer = setInterval(() => {
    if (visible()) onPoll();
  }, intervalMs);
  const onVisibility = () => {
    if (visible()) onPoll();
  };
  doc.addEventListener("visibilitychange", onVisibility);
  return () => {
    clearInterval(timer);
    doc.removeEventListener("visibilitychange", onVisibility);
  };
}
