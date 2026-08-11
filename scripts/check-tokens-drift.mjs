#!/usr/bin/env node
// pnpm check:tokens-drift — ticket #203 (ADR-0010 amendment).
//
// design/tokens.json is a *curated mirror* of the DTCG export committed at
// design/figma-variables/*.json (see that directory's README for provenance).
// This gate catches the two ways the mirror can silently rot:
//   1. NAME drift — a semantic token's `figma` path / `figmaVariableId` no
//      longer matches what's actually in the export (renamed/re-pointed in
//      Figma, tokens.json not updated).
//   2. VALUE drift — tokens.json's light/dark value no longer matches the
//      export's resolved hex for that variable, and nothing says that's
//      expected.
//
// The one sanctioned way to have value drift is `$pendingFigmaValue` (#203's
// escape hatch for the 13 dark + 2 light deviations ticket #204 owns) — a
// token carrying `$pendingFigmaValue.light` / `.dark` is exempted from the
// VALUE check on exactly the modes it names, never from the NAME check.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { resolveRef } from "./tokens-lib.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const readJSON = (p) => JSON.parse(readFileSync(p, "utf8"));

const tokens = readJSON(join(root, "design/tokens.json"));
const figmaLight = readJSON(join(root, "design/figma-variables/Semantics _ Style_Light.tokens.json"));
const figmaDark = readJSON(join(root, "design/figma-variables/Semantics _ Style_Dark.tokens.json"));

/** Flatten a DTCG color tree into { "color/a/b/c": { hex, variableId } }. */
function flattenColor(dtcg) {
  const out = {};
  function walk(node, path) {
    if (node && typeof node === "object" && node.$type === "color") {
      out[path.join("/")] = {
        hex: node.$value.hex.toUpperCase(),
        variableId: node.$extensions?.["com.figma.variableId"],
      };
      return;
    }
    if (node && typeof node === "object") {
      for (const [key, child] of Object.entries(node)) {
        if (key.startsWith("$")) continue;
        walk(child, [...path, key]);
      }
    }
  }
  walk(dtcg.color ?? {}, ["color"]);
  return out;
}

const lightByPath = flattenColor(figmaLight);
const darkByPath = flattenColor(figmaDark);

const errors = [];
const warnings = [];

function isAliasRef(ref) {
  const m = /^\{([^}]+)\}$/.exec(ref);
  return m && m[1].startsWith("semantic.color.");
}

for (const [name, def] of Object.entries(tokens.semantic.color)) {
  // Documented no-Figma-counterpart exception (surface-hover, #203/#204).
  if (def.figma === null) {
    if (!def.$comment) {
      errors.push(`${name}: figma is null but carries no $comment explaining why.`);
    }
    continue;
  }

  if (!def.figma || !def.figmaVariableId) {
    errors.push(`${name}: missing figma / figmaVariableId (every semantic token needs traceability, ADR-0010/#203).`);
    continue;
  }

  const figmaEntry = lightByPath[def.figma];
  if (!figmaEntry) {
    errors.push(`${name}: figma path "${def.figma}" not found in design/figma-variables/Semantics _ Style_Light.tokens.json (renamed/removed in Figma?).`);
    continue;
  }
  if (figmaEntry.variableId !== def.figmaVariableId) {
    errors.push(
      `${name}: figmaVariableId mismatch — tokens.json says ${def.figmaVariableId}, export says ${figmaEntry.variableId} for "${def.figma}".`,
    );
  }

  if (isAliasRef(def.light)) {
    // Alias tier (priority-*, tag-highlight*): value comes from the target
    // semantic token, not directly from this path — name/id traceability
    // above is the whole check for these.
    continue;
  }

  const pending = def.$pendingFigmaValue ?? {};

  const lightVal = resolveRef(tokens, def.light).value.toUpperCase();
  if (!pending.light && lightVal !== figmaEntry.hex) {
    errors.push(
      `${name}: light value drift — tokens.json ${lightVal} vs Figma ${figmaEntry.hex} ("${def.figma}"). Either re-sync the value or mark it with $pendingFigmaValue (see #204).`,
    );
  }

  const darkFigmaEntry = darkByPath[def.figma];
  if (darkFigmaEntry && !pending.dark) {
    // Effective dark value: this token's own "dark" override if it declares
    // one, else its light value (that's what the browser actually renders —
    // an undeclared dark override falls through to the light declaration).
    const darkVal = def.dark ? resolveRef(tokens, def.dark).value.toUpperCase() : lightVal;
    if (darkVal !== darkFigmaEntry.hex) {
      errors.push(
        `${name}: dark value drift — effective dark ${darkVal} vs Figma ${darkFigmaEntry.hex} ("${def.figma}"). Either re-sync the value or mark it with $pendingFigmaValue (see #204).`,
      );
    }
  }
}

// Sanity check the escape hatch itself isn't silently growing unnoticed.
let pendingCount = 0;
for (const def of Object.values(tokens.semantic.color)) {
  if (def.$pendingFigmaValue) pendingCount += 1;
}
if (pendingCount > 0) {
  warnings.push(`${pendingCount} token(s) carry $pendingFigmaValue (ticket #204 to resolve) — drift-checked on name/id, exempted on the marked value(s) only.`);
}

for (const w of warnings) console.warn(`WARN: ${w}`);

if (errors.length > 0) {
  console.error(`FAIL: ${errors.length} tokens.json drift issue(s) vs design/figma-variables/*.json:\n`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(`OK: design/tokens.json matches design/figma-variables/*.json (name + value, ${pendingCount} deviation(s) exempted via $pendingFigmaValue for #204).`);
