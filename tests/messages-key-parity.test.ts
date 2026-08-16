import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// #162: en.json was fully maintained (ADR-0007 requires both catalogs in
// every PR) but unreachable in the app until i18n/request.ts read
// profiles.locale -- nothing ever caught the two catalogs drifting apart
// because nothing ever exercised the English tree. This makes that
// mechanical: any future PR that adds/renames a key in one catalog without
// mirroring it in the other now fails CI instead of silently shipping a
// half-translated string (a missing key falls back to next-intl's raw key
// path, e.g. "notes.errors.generic", rendered to the user).
//
// Deliberately compares fully-qualified dotted key *paths* (not just
// top-level namespaces) and in both directions, so a key present in nl but
// missing in en is caught the same as the reverse. Unused-but-present-in-
// both keys (e.g. components.sidebar.items.clothes, #226) are fine -- this
// only fails on a set difference, never on dead-but-mirrored keys.

const nl = JSON.parse(readFileSync("messages/nl.json", "utf8"));
const en = JSON.parse(readFileSync("messages/en.json", "utf8"));

function flatten(value: unknown, prefix = ""): Set<string> {
  const keys = new Set<string>();
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    keys.add(prefix);
    return keys;
  }
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    for (const k of flatten(child, path)) keys.add(k);
  }
  return keys;
}

describe("messages/nl.json and messages/en.json key parity (ADR-0007)", () => {
  it("have identical dotted key-path sets", () => {
    const nlKeys = flatten(nl);
    const enKeys = flatten(en);

    const missingFromEn = [...nlKeys].filter((k) => !enKeys.has(k)).sort();
    const missingFromNl = [...enKeys].filter((k) => !nlKeys.has(k)).sort();

    const details = [
      missingFromEn.length > 0
        ? `Present in nl.json, missing from en.json:\n  ${missingFromEn.join("\n  ")}`
        : null,
      missingFromNl.length > 0
        ? `Present in en.json, missing from nl.json:\n  ${missingFromNl.join("\n  ")}`
        : null,
    ]
      .filter(Boolean)
      .join("\n");

    expect(details, details).toBe("");
  });
});
