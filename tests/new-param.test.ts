import { describe, expect, it } from "vitest";
import { hasNewParam, withoutNewParam } from "@/lib/dom/new-param";

describe("hasNewParam", () => {
  it("is true only for nieuw=1", () => {
    expect(hasNewParam(new URLSearchParams("nieuw=1"))).toBe(true);
    expect(hasNewParam(new URLSearchParams("a=b&nieuw=1"))).toBe(true);
    expect(hasNewParam(new URLSearchParams("nieuw=0"))).toBe(false);
    expect(hasNewParam(new URLSearchParams("nieuw"))).toBe(false);
    expect(hasNewParam(new URLSearchParams(""))).toBe(false);
  });
});

describe("withoutNewParam", () => {
  it("returns the bare path when nieuw was the only param", () => {
    expect(withoutNewParam("/te-doen", new URLSearchParams("nieuw=1"))).toBe("/te-doen");
  });

  it("keeps the other params", () => {
    expect(withoutNewParam("/agenda", new URLSearchParams("date=2026-11-01&nieuw=1"))).toBe("/agenda?date=2026-11-01");
    expect(withoutNewParam("/te-doen/abc", new URLSearchParams("nieuw=1&sort=size"))).toBe("/te-doen/abc?sort=size");
  });

  it("leaves a URL without nieuw unchanged", () => {
    expect(withoutNewParam("/notities", new URLSearchParams("q=soep"))).toBe("/notities?q=soep");
  });
});
