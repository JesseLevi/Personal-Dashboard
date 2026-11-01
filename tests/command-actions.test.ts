import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isIconName } from "@/components/atoms/Icon";
import { COMMAND_ACTIONS } from "@/lib/command/actions";
import { COMMAND_ACTION_IDS } from "@/lib/command/types";

// The shell's own route table, read from source so the two cannot drift apart.
function shellRoutes(): string[] {
  const source = readFileSync(join(process.cwd(), "app/(app)/_components/AppShellNav.tsx"), "utf8");
  const block = /const ROUTES[^{]*\{([^}]*)\}/.exec(source)?.[1] ?? "";
  return [...block.matchAll(/"(\/[^"]*)"/g)].map((match) => match[1]);
}

describe("COMMAND_ACTIONS", () => {
  it("has one action per id, in the contract's order", () => {
    expect(COMMAND_ACTIONS.map((action) => action.id)).toEqual([...COMMAND_ACTION_IDS]);
    expect(new Set(COMMAND_ACTIONS.map((action) => action.id)).size).toBe(COMMAND_ACTION_IDS.length);
  });

  it("pins the create actions and Settings, not the go-to actions", () => {
    for (const action of COMMAND_ACTIONS) {
      expect(action.pinned).toBe(action.kind !== "navigate");
    }
  });

  it("gives create and navigate actions an href and settings none", () => {
    for (const action of COMMAND_ACTIONS) {
      if (action.kind === "settings") expect(action.href).toBeUndefined();
      else expect(action.href).toBeTruthy();
    }
  });

  it("uses existing icons", () => {
    for (const action of COMMAND_ACTIONS) expect(isIconName(action.icon)).toBe(true);
  });

  it("targets routes the shell knows; create actions add ?nieuw=1", () => {
    const routes = shellRoutes();
    expect(routes.length).toBeGreaterThan(0);
    for (const action of COMMAND_ACTIONS) {
      if (!action.href) continue;
      const url = new URL(action.href, "https://atlas.test");
      expect(routes).toContain(url.pathname);
      expect(url.searchParams.get("nieuw")).toBe(action.kind === "create" ? "1" : null);
    }
  });
});
