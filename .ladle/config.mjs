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
};
