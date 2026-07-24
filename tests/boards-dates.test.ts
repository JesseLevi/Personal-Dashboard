import { describe, expect, it } from "vitest";
import { parseDueAtText } from "../lib/boards/dates";

describe("parseDueAtText", () => {
  it("parses dd-mm-yyyy to UTC-midnight ISO", () => {
    expect(parseDueAtText("23-07-2026")).toBe("2026-07-23T00:00:00.000Z");
  });

  it("parses dd/mm/yyyy the same way", () => {
    expect(parseDueAtText("23/07/2026")).toBe("2026-07-23T00:00:00.000Z");
  });

  it("accepts one-digit day/month", () => {
    expect(parseDueAtText("1-4-2026")).toBe("2026-04-01T00:00:00.000Z");
  });

  it("tolerates surrounding whitespace", () => {
    expect(parseDueAtText("  23-07-2026  ")).toBe("2026-07-23T00:00:00.000Z");
  });

  it("rejects a calendar-invalid date instead of letting it roll over", () => {
    expect(parseDueAtText("31-02-2026")).toBeNull();
  });

  it("rejects garbage text", () => {
    expect(parseDueAtText("tomorrow")).toBeNull();
  });

  it("rejects an empty string", () => {
    expect(parseDueAtText("")).toBeNull();
  });

  it("rejects an ISO datetime (that's the other schema branch, not this parser's job)", () => {
    expect(parseDueAtText("2026-07-23T00:00:00.000Z")).toBeNull();
  });
});
