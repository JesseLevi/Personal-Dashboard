// Client-safe route URL for a recipe thumbnail (fallback for an expired presigned URL).
// `v` is the stem's uuid, which changes only when the photo does (#391).
export function recipeThumbnailRouteUrl(
  recipeId: string,
  stem: string,
  size: "card" | "full",
): string {
  const version = stem.slice(stem.lastIndexOf("/") + 1);
  return `/api/recipe-thumbnail/${recipeId}?v=${version}&size=${size}`;
}
