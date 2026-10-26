import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { storyOrder } from "../.ladle/config.mjs";

const order = storyOrder as (stories: string[]) => string[];

const IDS = [
  "account--login-form--default",
  "winkelmand--winkelmand-header--default",
  "recepten--recipe-panel--filled",
  "notities--rondom--note-backlinks--default",
  "notities--blokken--note-table--default",
  "notities--editor--editing-bar--at-rest",
  "notities--editor--editing-bar--playground",
  "notities--editor--editing-bar--interactive",
  "notities--editor--editing-bar--overview",
  "agenda--agenda-header--desktop",
  "te-doen--board-panel--default",
  "basis--panelen--sidebar--variants",
  "basis--kaarten--card--all-content-types",
  "basis--invoer--button--state-matrix",
  "basis--fundament--icon--all-icons",
  "zzz-unknown--thing--default",
  "basis--onbekend--thing--default",
];

describe("ladle storyOrder", () => {
  it("returns a permutation: every ID kept, none added, input untouched", () => {
    const input = [...IDS];
    const out = order(input);
    expect(out).toHaveLength(IDS.length);
    expect([...out].sort()).toEqual([...IDS].sort());
    expect(input).toEqual(IDS);
  });

  it("orders groups Basis, app Sidebar modules, Account; unknown groups last", () => {
    const groups = [...new Set(order(IDS).map((id) => id.split("--")[0]))];
    expect(groups).toEqual(["basis", "te-doen", "agenda", "notities", "recepten", "winkelmand", "account", "zzz-unknown"]);
  });

  it("orders sub-groups by the table, not the alphabet", () => {
    const basis = [...new Set(order(IDS).filter((id) => id.startsWith("basis--")).map((id) => id.split("--")[1]))];
    expect(basis).toEqual(["fundament", "invoer", "kaarten", "panelen", "onbekend"]);
    const notities = [...new Set(order(IDS).filter((id) => id.startsWith("notities--")).map((id) => id.split("--")[1]))];
    expect(notities).toEqual(["editor", "blokken", "rondom"]);
  });

  it("puts Overview, Playground, Interactive first, then the rest alphabetically", () => {
    const stories = order(IDS)
      .filter((id) => id.startsWith("notities--editor--editing-bar--"))
      .map((id) => id.split("--").pop());
    expect(stories).toEqual(["overview", "playground", "interactive", "at-rest"]);
  });

  it("serialises through toString() like Ladle does (no outer references)", () => {
    const revived = new Function("return " + storyOrder.toString())() as typeof order;
    expect(revived(IDS)).toEqual(order(IDS));
  });

  it("knows every top-level group used by the real stories", () => {
    const files = readStoryTitles();
    const known = new Set(order(IDS).map((id) => id.split("--")[0]));
    for (const { file, title } of files) {
      const group = title.split(" / ")[0].toLowerCase().replace(/\s+/g, "-");
      expect(known.has(group), `${file}: group "${title}" missing from storyOrder`).toBe(true);
    }
  });
});

function readStoryTitles(): { file: string; title: string }[] {
  const list = execSync("git ls-files -z '*.stories.tsx'", { encoding: "utf8" }).split("\0").filter(Boolean);
  return list.map((file) => {
    const m = readFileSync(file, "utf8").match(/export default \{ title: "([^"]+)" \}/);
    return { file, title: m ? m[1] : "" };
  });
}
