// Retired-token gate over the WHOLE repo (#285). After #203 renamed the
// semantic tokens, `.ladle/` still used `bg-surface` / `--color-surface`;
// Tailwind silently emitted nothing and dark mode broke. check:server-only only
// greps components/ app/ lib/, so this walks every tracked/untracked-but-not-
// ignored file (dotfolders and config files included).
//
// The list lives in design/retired-tokens.json. Only COLOUR-token usage forms
// are flagged, never the bare word, so live names and non-colour utilities
// stay clean:
//   - CSS var:  `--color-<name>`
//   - utility:  `<prefix>-<name>`, prefix = a Tailwind colour-taking utility
//               (bg, text, border, border-x, ring, divide, fill, ...), with
//               any variants (`hover:`, `dark:`) and `/opacity` allowed.
// Boundaries: the match must not be preceded or followed by [A-Za-z0-9_-], so
// `surface-secondary` never matches retired `surface`, `text-text-primary`
// never matches `text-text`, `context-text` never matches, and a bare
// `border` / `border-2` (width utilities) never match since `border-border`
// (prefix + retired name) is required.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const PREFIXES = [
  "bg", "text", "border", "border-[xytblrse]", "ring", "ring-offset", "inset-ring",
  "outline", "divide", "fill", "stroke", "shadow", "inset-shadow", "from", "via",
  "to", "decoration", "accent", "caret", "placeholder",
];

// Docs history, generated/raw exports and the list itself are exempt.
const EXCLUDE = [
  /^design\/retired-tokens\.json$/,
  /^docs\/(incidents\.md|HANDOFF\.md|phase-log\.md|decisions\/)/,
  /^design\/(notes\/|figma-variables\/)/,
  /^(screenshots|test-results|\.claude\/worktrees|node_modules|\.next|\.git)\//,
  /(^|\/)pnpm-lock\.yaml$/,
  /\.(png|jpe?g|webp|gif|ico|woff2?|ttf|pdf|svg)$/i,
  /^scripts\/check-retired-tokens\.mjs$/,
  /^tests\/retired-tokens\.test\.ts$/,
  /^tests\/tokens\.test\.ts$/, // asserts the retired names are gone
  /^playwright-report\//, // generated, untracked
];

const B = "(?<![A-Za-z0-9_-])";
const E = "(?![A-Za-z0-9_-])";

export function buildPattern(names) {
  const n = [...names].sort((a, b) => b.length - a.length).join("|");
  return new RegExp(`(?:${B}--color-(?:${n})${E})|(?:${B}(?:${PREFIXES.join("|")})-(?:${n})${E})`, "g");
}

export function findHits(text, pattern) {
  const hits = [];
  text.split("\n").forEach((line, i) => {
    for (const m of line.matchAll(pattern)) hits.push({ line: i + 1, match: m[0] });
  });
  return hits;
}

function main() {
  const { retired } = JSON.parse(readFileSync("design/retired-tokens.json", "utf8"));
  const pattern = buildPattern(retired);
  const files = execFileSync("git", ["ls-files", "-co", "--exclude-standard"], { encoding: "utf8", maxBuffer: 64 << 20 })
    .split("\n").filter((f) => f && !EXCLUDE.some((re) => re.test(f)));
  let fail = 0;
  for (const f of files) {
    let text;
    try { text = readFileSync(f, "utf8"); } catch { continue; }
    if (text.includes("\0")) continue;
    for (const h of findHits(text, pattern)) {
      console.log(`${f}:${h.line}: ${h.match}`);
      fail = 1;
    }
  }
  if (fail) {
    console.error("FAIL: retired token name in use (design/retired-tokens.json) — use the Figma-path token from app/theme.css.");
    process.exit(1);
  }
  console.log(`OK: no retired token names (${retired.length}) in ${files.length} files.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
