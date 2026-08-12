#!/usr/bin/env node
// pnpm check:tokens-drift — ticket #203 (ADR-0010 amendment), extended by
// #205 to also cover the Semantics / Responsive collection (radius/spacing).
//
// design/tokens.json is a *curated mirror* of the DTCG export committed at
// design/figma-variables/*.json (see that directory's README for provenance).
// This gate catches the two ways the mirror can silently rot:
//   1. NAME drift — a semantic token's `figma` path / `figmaVariableId` no
//      longer matches what's actually in the export (renamed/re-pointed in
//      Figma, tokens.json not updated).
//   2. VALUE drift — tokens.json's light/dark (color) or value/mobile/desktop
//      (radius/spacing) no longer matches the export's resolved figure for
//      that variable, and nothing says that's expected.
//
// The one sanctioned way to have color VALUE drift is `$pendingFigmaValue`
// (#203's escape hatch for the 13 dark + 2 light deviations ticket #204
// owns) — a token carrying `$pendingFigmaValue.light` / `.dark` is exempted
// from the VALUE check on exactly the modes it names, never from the NAME
// check. Radius/spacing (#205) has no such escape hatch yet — none of that
// collection shipped with a known deviation, so any drift there is a real
// re-sync, not an open ticket.
//
// TICKET #213 added a third direction: everything above walks tokens.json
// -> Figma (does a token this file already declares still match the
// export?). That loop is structurally blind to a real Figma variable that
// was never given a token at all — #213 found 19 of those this way while
// the old gate reported "0 deviations". The bidirectional check at the
// bottom of this file walks Figma -> tokens.json instead: every variable in
// the committed export must either back a semantic.* token (by its `figma`
// path) or be named on `design/tokens.json`'s top-level `$notMirrored` with
// a reason. No escape hatch needed here — `$notMirrored` *is* the escape
// hatch, and an empty/missing reason is itself an error.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { resolveRef } from "./tokens-lib.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const readJSON = (p) => JSON.parse(readFileSync(p, "utf8"));

const tokens = readJSON(join(root, "design/tokens.json"));
const figmaLight = readJSON(join(root, "design/figma-variables/Semantics _ Style_Light.tokens.json"));
const figmaDark = readJSON(join(root, "design/figma-variables/Semantics _ Style_Dark.tokens.json"));
const figmaResponsiveDesktop = readJSON(join(root, "design/figma-variables/Semantics _ Responsive_Desktop.tokens.json"));
const figmaResponsiveMobile = readJSON(join(root, "design/figma-variables/Semantics _ Responsive_Mobile.tokens.json"));

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

// --- Semantics / Responsive (radius + spacing), ticket #205 ---------------
//
// Same flatten-and-compare shape as flattenColor above, but for the DTCG
// number leaves (`$type: "number"`) this collection uses instead of color.
function flattenNumber(dtcg, rootKey) {
  const out = {};
  function walk(node, path) {
    if (node && typeof node === "object" && node.$type === "number") {
      out[path.join("/")] = {
        value: node.$value,
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
  walk(dtcg[rootKey] ?? {}, [rootKey]);
  return out;
}

const radiusDesktopByPath = flattenNumber(figmaResponsiveDesktop, "radius");
const radiusMobileByPath = flattenNumber(figmaResponsiveMobile, "radius");
const spacingDesktopByPath = flattenNumber(figmaResponsiveDesktop, "spacing");
const spacingMobileByPath = flattenNumber(figmaResponsiveMobile, "spacing");

/** "8px" -> 8. Throws on anything else — same closed-scale posture as resolveRef's dangling-ref throw. */
function pxNumber(value) {
  const m = /^(-?\d+(?:\.\d+)?)px$/.exec(value);
  if (!m) throw new Error(`Not a px value: ${value}`);
  return Number(m[1]);
}

/** semantic.radius entries and semantic.spacing.{component,inline,stack} entries: single `value` ref, expected identical between Figma's Mobile/Desktop modes (confirmed at #205 authoring time — see design/tokens.json's semantic.spacing $comment). */
function checkUniformEntry(name, def, desktopByPath, mobileByPath, collectionLabel) {
  if (!def.figma || !def.figmaVariableId) {
    errors.push(`${name}: missing figma / figmaVariableId (${collectionLabel}).`);
    return;
  }
  const desktopEntry = desktopByPath[def.figma];
  const mobileEntry = mobileByPath[def.figma];
  if (!desktopEntry || !mobileEntry) {
    errors.push(
      `${name}: figma path "${def.figma}" not found in Semantics / Responsive ${!desktopEntry ? "Desktop" : "Mobile"} export (renamed/removed in Figma?).`,
    );
    return;
  }
  if (desktopEntry.variableId !== def.figmaVariableId || mobileEntry.variableId !== def.figmaVariableId) {
    errors.push(
      `${name}: figmaVariableId mismatch — tokens.json says ${def.figmaVariableId}, export says ${desktopEntry.variableId} (Desktop) / ${mobileEntry.variableId} (Mobile) for "${def.figma}".`,
    );
  }
  if (desktopEntry.value !== mobileEntry.value) {
    errors.push(
      `${name}: tokens.json models this as a single value (identical Mobile/Desktop), but the export now differs (Mobile ${mobileEntry.value} vs Desktop ${desktopEntry.value}) for "${def.figma}" — give it a mobile/desktop split like semantic.spacing.layout's page-top/page-left/page-right-equal.`,
    );
    return;
  }
  const tokenVal = pxNumber(resolveRef(tokens, def.value).value);
  if (tokenVal !== desktopEntry.value) {
    errors.push(`${name}: value drift — tokens.json ${tokenVal}px vs Figma ${desktopEntry.value}px ("${def.figma}").`);
  }
}

for (const [name, def] of Object.entries(tokens.semantic.radius ?? {})) {
  if (name.startsWith("$")) continue; // skip the "$comment" doc field, not a token
  checkUniformEntry(name, def, radiusDesktopByPath, radiusMobileByPath, "Semantics / Responsive radius");
}

for (const groupName of ["component", "inline", "stack"]) {
  for (const [name, def] of Object.entries(tokens.semantic.spacing?.[groupName] ?? {})) {
    checkUniformEntry(name, def, spacingDesktopByPath, spacingMobileByPath, `Semantics / Responsive spacing.${groupName}`);
  }
}

// spacing.layout: mixed shape — page-top/page-left/page-right-equal carry a
// real mobile/desktop split; page-bottom/page-right-full/page-stack are
// single-valued like the groups above.
for (const [name, def] of Object.entries(tokens.semantic.spacing?.layout ?? {})) {
  if (!def.figma || !def.figmaVariableId) {
    errors.push(`${name}: missing figma / figmaVariableId (Semantics / Responsive spacing.layout).`);
    continue;
  }
  const desktopEntry = spacingDesktopByPath[def.figma];
  const mobileEntry = spacingMobileByPath[def.figma];
  if (!desktopEntry || !mobileEntry) {
    errors.push(
      `${name}: figma path "${def.figma}" not found in Semantics / Responsive ${!desktopEntry ? "Desktop" : "Mobile"} export.`,
    );
    continue;
  }
  if (desktopEntry.variableId !== def.figmaVariableId || mobileEntry.variableId !== def.figmaVariableId) {
    errors.push(
      `${name}: figmaVariableId mismatch — tokens.json says ${def.figmaVariableId}, export says ${desktopEntry.variableId} (Desktop) / ${mobileEntry.variableId} (Mobile) for "${def.figma}".`,
    );
  }
  if ("desktop" in def) {
    if (desktopEntry.value === mobileEntry.value) {
      errors.push(
        `${name}: tokens.json models this as a mobile/desktop split, but the export now gives the SAME value (${desktopEntry.value}) in both modes for "${def.figma}" — collapse it to a single \`value\` like page-bottom/page-right-full/page-stack.`,
      );
    }
    const mobileVal = pxNumber(resolveRef(tokens, def.mobile).value);
    if (mobileVal !== mobileEntry.value) {
      errors.push(`${name}: mobile value drift — tokens.json ${mobileVal}px vs Figma ${mobileEntry.value}px ("${def.figma}").`);
    }
    const desktopVal = pxNumber(resolveRef(tokens, def.desktop).value);
    if (desktopVal !== desktopEntry.value) {
      errors.push(`${name}: desktop value drift — tokens.json ${desktopVal}px vs Figma ${desktopEntry.value}px ("${def.figma}").`);
    }
  } else {
    if (desktopEntry.value !== mobileEntry.value) {
      errors.push(
        `${name}: expected identical Mobile/Desktop value for "${def.figma}" but the export now differs (Mobile ${mobileEntry.value} vs Desktop ${desktopEntry.value}) — needs a mobile/desktop split.`,
      );
      continue;
    }
    const val = pxNumber(resolveRef(tokens, def.value).value);
    if (val !== desktopEntry.value) {
      errors.push(`${name}: value drift — tokens.json ${val}px vs Figma ${desktopEntry.value}px ("${def.figma}").`);
    }
  }
}

// --- Bidirectional coverage (#213) -----------------------------------------
//
// Figma -> tokens.json: every real variable in the committed export must
// either back a semantic.* token (by `figma` path) or be named on
// `$notMirrored` with a non-empty reason. Additive only — this never touches
// a value, only whether a variable is accounted for at all.
const notMirrored = tokens.$notMirrored ?? {};
for (const [path, reason] of Object.entries(notMirrored)) {
  if (path.startsWith("$")) continue;
  if (typeof reason !== "string" || reason.trim() === "") {
    errors.push(`$notMirrored["${path}"]: carries no reason string.`);
  }
}

const mirroredColorPaths = new Set(
  Object.values(tokens.semantic.color)
    .map((def) => def.figma)
    .filter((figma) => typeof figma === "string"),
);
for (const path of Object.keys(lightByPath)) {
  if (mirroredColorPaths.has(path)) continue;
  if (path in notMirrored) continue;
  errors.push(
    `${path}: real Figma color variable (Semantics / Style) has no semantic.color token and is not on $notMirrored.`,
  );
}

const mirroredResponsivePaths = new Set();
for (const def of Object.values(tokens.semantic.radius ?? {})) {
  if (def && typeof def === "object" && typeof def.figma === "string") mirroredResponsivePaths.add(def.figma);
}
for (const groupName of ["component", "inline", "stack"]) {
  for (const def of Object.values(tokens.semantic.spacing?.[groupName] ?? {})) {
    if (typeof def.figma === "string") mirroredResponsivePaths.add(def.figma);
  }
}
for (const def of Object.values(tokens.semantic.spacing?.layout ?? {})) {
  if (typeof def.figma === "string") mirroredResponsivePaths.add(def.figma);
}

const responsivePaths = new Set([
  ...Object.keys(radiusDesktopByPath),
  ...Object.keys(spacingDesktopByPath),
  ...Object.keys(flattenNumber(figmaResponsiveDesktop, "text")),
]);
for (const path of responsivePaths) {
  if (mirroredResponsivePaths.has(path)) continue;
  if (path in notMirrored) continue;
  errors.push(
    `${path}: real Figma Semantics / Responsive variable has no semantic.radius/spacing token and is not on $notMirrored.`,
  );
}

for (const w of warnings) console.warn(`WARN: ${w}`);

if (errors.length > 0) {
  console.error(`FAIL: ${errors.length} tokens.json drift issue(s) vs design/figma-variables/*.json:\n`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(
  `OK: design/tokens.json matches design/figma-variables/*.json — color (name + value, ${pendingCount} deviation(s) exempted via $pendingFigmaValue for #204) and Semantics / Responsive radius+spacing (name + value + mobile/desktop split, #205), and is now bidirectional (#213): every export variable is either a token or an explained $notMirrored entry.`,
);
