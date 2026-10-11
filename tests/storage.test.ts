import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getObjectStore, keyBelongsTo, objectKey, setObjectStoreForTesting } from "@/lib/storage";
import { readR2Config } from "@/lib/storage/env";
import { createFakeObjectStore } from "@/lib/storage/fake";
import { createR2Store } from "@/lib/storage/r2";

const USER = "0b9f6d3e-7d5a-4c1e-9a52-3f6f2f1c8a11";
const OTHER = "7c1d0a52-1b3e-4f0a-8c44-9d2e5b6a7f10";

describe("objectKey", () => {
  it("builds <user>/<module>/parts", () => {
    expect(objectKey(USER, "recipes", "abc", "thumb.webp")).toBe(`${USER}/recipes/abc/thumb.webp`);
  });
  it.each([
    ["..", "x"],
    [".", "x"],
    ["", "x"],
    ["a/b", "x"],
    ["a", "../x"],
    ["a", ""],
  ])("rejects segments %j %j", (module, part) => {
    expect(() => objectKey(USER, module, part)).toThrow();
  });
  it("rejects a non-uuid user id", () => {
    expect(() => objectKey("not-a-uuid", "recipes")).toThrow();
    expect(() => objectKey("../" + USER, "recipes")).toThrow();
    expect(() => objectKey("", "recipes")).toThrow();
  });
});

describe("keyBelongsTo", () => {
  const key = objectKey(USER, "recipes", "a.webp");
  it("accepts own keys, rejects other users and malformed keys", () => {
    expect(keyBelongsTo(USER, key)).toBe(true);
    expect(keyBelongsTo(OTHER, key)).toBe(false);
    expect(keyBelongsTo(USER, `${USER}/recipes/../${OTHER}/x`)).toBe(false);
    expect(keyBelongsTo(USER, `${USER}/recipes`)).toBe(false);
    expect(keyBelongsTo(USER, `${USER}//a`)).toBe(false);
    expect(keyBelongsTo("nope", key)).toBe(false);
  });
});

describe("R2 presignGet", () => {
  const store = createR2Store({
    accountId: "acct",
    accessKeyId: "AKIAFAKE",
    secretAccessKey: "fake-secret",
    bucket: "bkt",
  });
  const key = objectKey(USER, "recipes", "a b.webp");

  it("is byte-identical within an hour and differs in the next", async () => {
    const a = await store.presignGet(key, new Date("2026-10-10T10:00:01Z"));
    const b = await store.presignGet(key, new Date("2026-10-10T10:59:59Z"));
    const c = await store.presignGet(key, new Date("2026-10-10T11:00:00Z"));
    expect(a).toBe(b);
    expect(c).not.toBe(a);
    const u = new URL(a);
    expect(u.host).toBe("acct.r2.cloudflarestorage.com");
    expect(u.pathname.startsWith("/bkt/")).toBe(true);
    expect(u.searchParams.get("X-Amz-Expires")).toBe("7200");
    expect(u.searchParams.get("X-Amz-Date")).toBe("20261010T100000Z");
  });
});

describe("readR2Config / getObjectStore", () => {
  afterEach(() => setObjectStoreForTesting(null));
  it("names the missing variable", () => {
    expect(() => readR2Config({ R2_ACCOUNT_ID: "a" })).toThrow(
      /R2_ACCESS_KEY_ID/,
    );
  });
  it("returns an injected store", () => {
    const fake = createFakeObjectStore();
    setObjectStoreForTesting(fake);
    expect(getObjectStore()).toBe(fake);
  });
});

describe("fake store", () => {
  it("round-trips and returns null for missing", async () => {
    const s = createFakeObjectStore();
    await s.put("k/a/b", new Uint8Array([1, 2]), { contentType: "image/webp" });
    expect(await s.get("k/a/b")).toEqual({
      bytes: new Uint8Array([1, 2]),
      contentType: "image/webp",
    });
    expect(await s.get("k/a/missing")).toBeNull();
  });
  it("deletePrefix pages through more than one page and spares other prefixes", async () => {
    const s = createFakeObjectStore({ pageSize: 2 });
    const bytes = new Uint8Array([0]);
    for (let i = 0; i < 5; i++) await s.put(`${USER}/recipes/${i}`, bytes, { contentType: "x" });
    await s.put(`${OTHER}/recipes/0`, bytes, { contentType: "x" });
    expect(await s.deletePrefix(`${USER}/`)).toBe(5);
    expect(s.lastListPages).toBe(3);
    expect([...s.objects.keys()]).toEqual([`${OTHER}/recipes/0`]);
  });
  it("presignGet is deterministic per hour", async () => {
    const s = createFakeObjectStore();
    const a = await s.presignGet("k/a/b", new Date("2026-10-10T10:05:00Z"));
    expect(a).toBe(await s.presignGet("k/a/b", new Date("2026-10-10T10:55:00Z")));
    expect(a).not.toBe(await s.presignGet("k/a/b", new Date("2026-10-10T11:05:00Z")));
  });
});

describe("check:server-only R2 guard", () => {
  const script = path.resolve(__dirname, "../scripts/check-server-only.sh");
  const run = (root: string) => spawnSync("bash", [script, root], { encoding: "utf8" });
  const fixture = (file: string, body: string) => {
    const root = mkdtempSync(path.join(tmpdir(), "cso-"));
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), body);
    return root;
  };

  it("passes when R2_ lives under lib/storage", () => {
    expect(run(fixture("lib/storage/env.ts", "process.env.R2_BUCKET_NAME\n")).status).toBe(0);
  });
  it("fails on an R2_ reference outside lib/storage", () => {
    const r = run(fixture("lib/recipes/x.ts", "process.env.R2_BUCKET_NAME\n"));
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("lib/storage");
  });
  it("fails on an S3 client import outside lib/storage", () => {
    expect(run(fixture("app/page.tsx", 'import { AwsClient } from "aws4fetch";\n')).status).toBe(1);
  });
  it("passes on the real repo", () => {
    execFileSync("bash", [script, path.resolve(__dirname, "..")]);
  });
});
