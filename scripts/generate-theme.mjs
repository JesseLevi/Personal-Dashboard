#!/usr/bin/env node
// pnpm sync:tokens — regenerates app/theme.css (+ the tailwind-merge scales module, #289) from design/tokens.json (ADR-0010).
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { generateScalesModule, generateTheme } from "./tokens-lib.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tokens = JSON.parse(readFileSync(join(root, "design/tokens.json"), "utf8"));
const css = generateTheme(tokens);
writeFileSync(join(root, "app/theme.css"), css);
writeFileSync(join(root, "lib/ui/token-scales.generated.ts"), generateScalesModule(css));
console.log("app/theme.css + lib/ui/token-scales.generated.ts regenerated from design/tokens.json");
