// design: Claude-designed on request (#318)
import { hostOf, isHttpsUrl } from "@/lib/recipes/import/url";

// "Bron: example.com" under the recipe title of an imported recipe. Plain
// text host, link opens in a new tab with `noopener noreferrer`; renders
// nothing unless the stored URL is a valid https URL. Notes:
// design/notes/RecipeDetailPage.md.
export function SourceLink({ url, label }: { url: string | null; label: string }) {
  if (!url || !isHttpsUrl(url)) return null;
  return (
    <p className="text-base font-semibold text-text-secondary">
      {label}{" "}
      <a href={url} target="_blank" rel="noopener noreferrer" className="underline hover:text-text-primary">
        {hostOf(url)}
      </a>
    </p>
  );
}
