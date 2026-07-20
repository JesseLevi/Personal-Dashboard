import path from "node:path";

// Absolute path so Vite's dev server can resolve it via /@fs/ even though Ladle's
// own Vite `root` is @ladle/react's bundled app folder, not this repo (see
// .ladle/ladle-theme.css header for why this file — and not .ladle/components.tsx —
// is where the outer chrome gets its design-system tokens).
const chromeThemeHref = `/@fs/${path.resolve(process.cwd(), ".ladle/ladle-theme.css").split(path.sep).join("/")}`;

/** @type {import('@ladle/react').UserConfig} */
export default {
  stories: "components/**/*.stories.{js,jsx,ts,tsx}",
  appendToHead: `<link rel="stylesheet" href="${chromeThemeHref}" />`,
};
