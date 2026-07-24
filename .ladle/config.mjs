import path from "node:path";

// Absolute path so Vite's dev server can resolve it via /@fs/ even though Ladle's
// own Vite `root` is @ladle/react's bundled app folder, not this repo (see
// .ladle/ladle-theme.css header for why this file — and not .ladle/components.tsx —
// is where the outer chrome gets its design-system tokens).
const chromeThemeHref = `/@fs/${path.resolve(process.cwd(), ".ladle/ladle-theme.css").split(path.sep).join("/")}`;

/** @type {import('@ladle/react').UserConfig} */
export default {
  // #94 added the first story outside components/ (CardDetailPanel.tsx
  // lives in app/(app)/te-doen/ since it's page-level composition, not a
  // new atomic-design leaf — design/notes/CardDetailPanel.md) — broadened
  // from a components/-only glob so it's still picked up.
  stories: "{components,app}/**/*.stories.{js,jsx,ts,tsx}",
  appendToHead: `<link rel="stylesheet" href="${chromeThemeHref}" />`,
};
