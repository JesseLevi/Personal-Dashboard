/**
 * Shared story discovery for the visual specs: reads Ladle's own build
 * manifest (`build/meta.json`, produced by `pnpm ladle:build`, which
 * playwright.config.ts's `webServer` runs before collection).
 */
import { readFileSync } from "node:fs";
import path from "node:path";

interface LadleMeta {
  stories: Record<string, { name: string; filePath: string }>;
}

export function loadStoryIds(): string[] {
  const metaPath = path.join(process.cwd(), "build", "meta.json");
  const meta = JSON.parse(readFileSync(metaPath, "utf-8")) as LadleMeta;
  return Object.keys(meta.stories).sort();
}
