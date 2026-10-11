import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const script = path.resolve(__dirname, "../scripts/check-doc-budget.sh");
const dirs: string[] = [];

function run(files: Record<string, number>) {
  const root = mkdtempSync(path.join(tmpdir(), "doc-budget-"));
  dirs.push(root);
  mkdirSync(path.join(root, "docs/guides"), { recursive: true });
  for (const [rel, bytes] of Object.entries(files)) {
    writeFileSync(path.join(root, rel), "x".repeat(bytes));
  }
  return spawnSync("bash", [script, root], { encoding: "utf8" });
}

afterEach(() => {
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
});

describe("check-doc-budget", () => {
  it("passes within budget", () => {
    expect(run({ "docs/HANDOFF.md": 100, "docs/guides/data-layer.md": 100 }).status).toBe(0);
  });

  it("fails an oversized HANDOFF with the append hint", () => {
    const r = run({ "docs/HANDOFF.md": 7000 });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("docs/HANDOFF.md");
    expect(r.stderr).toContain("don't append");
  });

  it("fails an oversized Architecture.md", () => {
    const r = run({ "Architecture.md": 20000 });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("Architecture.md");
  });

  it("fails an oversized guide", () => {
    const r = run({ "docs/guides/ticket-workflow.md": 9000 });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("ticket-workflow.md");
  });

  it("fails a guide without a budget entry", () => {
    const r = run({ "docs/guides/new-guide.md": 10 });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("no budget entry");
  });
});
