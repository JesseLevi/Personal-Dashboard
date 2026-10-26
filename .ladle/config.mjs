/**
 * Orders the sidebar: `Basis` first, then the app `Sidebar` module order, `Account` last;
 * sub-groups follow the table in docs/guides/ui-components.md ("Ladle"), not the alphabet;
 * inside a component `Overview`, `Playground`, `Interactive` lead, the rest is alphabetical.
 *
 * Only reorders: Ladle hides every story ID this function does not return, so the output
 * is always a permutation of the input (tests/ladle-story-order.test.ts).
 *
 * Self-contained on purpose: Ladle serialises this function with `toString()` into the
 * client bundle, so it cannot reference anything outside its own body.
 */
export const storyOrder = (stories) => {
  const groups = ["basis", "te-doen", "agenda", "notities", "recepten", "winkelmand", "account"];
  const subgroups = {
    basis: ["fundament", "invoer", "kaarten", "panelen"],
    notities: ["editor", "blokken", "rondom"],
  };
  const leading = ["overview", "playground", "interactive"];
  const rank = (list, key) => {
    const i = list.indexOf(key);
    return i === -1 ? list.length : i;
  };
  return [...stories].sort((a, b) => {
    const aParts = a.split("--");
    const bParts = b.split("--");
    const aStory = aParts.pop();
    const bStory = bParts.pop();
    const depth = Math.min(aParts.length, bParts.length);
    for (let i = 0; i < depth; i++) {
      if (aParts[i] === bParts[i]) continue;
      const list = i === 0 ? groups : i === 1 ? subgroups[aParts[0]] : undefined;
      return (list ? rank(list, aParts[i]) - rank(list, bParts[i]) : 0) || aParts[i].localeCompare(bParts[i]);
    }
    if (aParts.length !== bParts.length) return aParts.length - bParts.length;
    return rank(leading, aStory) - rank(leading, bStory) || aStory.localeCompare(bStory);
  });
};

/** @type {import('@ladle/react').UserConfig} */
export default {
  // #94 added the first story outside components/ (CardDetailPanel.tsx
  // lives in app/(app)/te-doen/ since it's page-level composition, not a
  // new atomic-design leaf — design/notes/CardDetailPanel.md) — broadened
  // from a components/-only glob so it's still picked up.
  stories: "{components,app}/**/*.stories.{js,jsx,ts,tsx}",
  // #49: the chrome stylesheet is injected via a real Vite plugin
  // (.ladle/vite.config.mjs), not `appendToHead` — see that file's header
  // for why appendToHead's tag never survives `pnpm ladle:build`.
  viteConfig: ".ladle/vite.config.mjs",
  storyOrder,
  defaultStory: "basis--invoer--button--state-matrix",
  // Groups start collapsed; the active story's branch opens by itself.
  expandStoryTree: false,
  addons: {
    rtl: { enabled: false },
    a11y: { enabled: true },
    // Mobile (design width) plus the app's `md` (768px) and `lg` (1024px) breakpoints.
    width: { options: { mobiel: 390, tablet: 768, desktop: 1024 }, defaultState: 0 },
  },
};
