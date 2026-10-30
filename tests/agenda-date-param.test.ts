import { describe, expect, it } from "vitest";
import { parseDateParam } from "@/lib/agenda/date-param";

describe("parseDateParam", () => {
  it("accepts a valid day", () => {
    expect(parseDateParam("2026-10-31")).toBe("2026-10-31");
    expect(parseDateParam("2028-02-29")).toBe("2028-02-29");
  });
  it("rejects malformed values", () => {
    expect(parseDateParam("31-10-2026")).toBeNull();
    expect(parseDateParam("2026-13-01")).toBeNull();
    expect(parseDateParam("2026-10-31T10:00")).toBeNull();
  });
  it("rejects days that do not exist", () => {
    expect(parseDateParam("2026-02-30")).toBeNull();
    expect(parseDateParam("2027-02-29")).toBeNull();
  });
  it("rejects empty and missing values", () => {
    expect(parseDateParam("")).toBeNull();
    expect(parseDateParam(undefined)).toBeNull();
  });
  it("rejects a repeated param", () => {
    expect(parseDateParam(["2026-10-31", "2026-11-01"])).toBeNull();
  });
});
