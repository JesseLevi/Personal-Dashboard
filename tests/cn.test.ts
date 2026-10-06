import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cn } from "@/lib/ui/cn";
import { tokenScales } from "@/lib/ui/token-scales.generated";
import { themeScales } from "../scripts/tokens-lib.mjs";

/** Every token paired with its successor, so each one is proven to conflict. */
function pairs(names: readonly string[]) {
  return names.map((name, i) => [name, names[(i + 1) % names.length]] as const);
}

describe("cn (clsx + tailwind-merge, #289)", () => {
  it("lets a caller's hidden beat a base inline-flex", () => {
    expect(cn("inline-flex shrink-0", "hidden")).toBe("shrink-0 hidden");
    expect(cn("inline-flex", "hidden md:inline-flex")).toBe("hidden md:inline-flex");
  });

  it("keeps clsx semantics for falsy and conditional values", () => {
    expect(cn("a", false && "b", undefined, null, { c: true, d: false }, ["e"])).toBe("a c e");
  });

  it("generated scales match app/theme.css exactly", () => {
    expect(tokenScales).toEqual(themeScales(readFileSync("app/theme.css", "utf8")));
  });

  describe("colour tokens", () => {
    const utilities = ["bg", "text", "border", "ring", "fill", "stroke", "outline", "divide", "accent", "caret"];
    it("covers a real set of tokens", () => {
      expect(tokenScales.color.length).toBeGreaterThan(20);
    });
    it.each(utilities)("%s: a later colour token replaces an earlier one", (u) => {
      for (const [name, other] of pairs(tokenScales.color)) {
        expect(cn(`${u}-${name}`, `${u}-${other}`)).toBe(`${u}-${other}`);
      }
      expect(cn(`${u}-text-primary`, `${u}-red-500`)).toBe(`${u}-red-500`);
      expect(cn(`${u}-red-500`, `${u}-text-primary`)).toBe(`${u}-text-primary`);
    });
    it("text colour tokens never conflict with font-size or font-weight", () => {
      for (const name of tokenScales.color) {
        expect(cn("text-sm font-semibold", `text-${name}`)).toBe(`text-sm font-semibold text-${name}`);
        expect(cn(`text-${name}`, "text-base")).toBe(`text-${name} text-base`);
      }
    });
    it("border colour tokens never conflict with border width", () => {
      for (const name of tokenScales.color) {
        expect(cn("border", `border-${name}`)).toBe(`border border-${name}`);
        expect(cn(`border-${name}`, "border-2")).toBe(`border-${name} border-2`);
      }
    });
    it("state variants merge independently", () => {
      expect(cn("hover:bg-surface-secondary-hover", "hover:bg-surface-primary")).toBe("hover:bg-surface-primary");
      expect(cn("hover:bg-surface-primary", "active:bg-surface-secondary")).toBe(
        "hover:bg-surface-primary active:bg-surface-secondary",
      );
    });
  });

  describe("spacing tokens", () => {
    const utilities = [
      "p", "px", "py", "pt", "pr", "pb", "pl", "m", "mx", "my", "mt", "mr", "mb", "ml",
      "gap", "gap-x", "gap-y", "space-x", "space-y", "inset", "top", "left", "w", "h", "size",
    ];
    it.each(utilities)("%s: a later spacing token replaces an earlier one", (u) => {
      for (const [name, other] of pairs(tokenScales.spacing)) {
        expect(cn(`${u}-${name}`, `${u}-${other}`)).toBe(`${u}-${other}`);
      }
      expect(cn(`${u}-component-md`, `${u}-4`)).toBe(`${u}-4`);
      expect(cn(`${u}-4`, `${u}-component-md`)).toBe(`${u}-component-md`);
    });
    it("axis and side utilities resolve like stock Tailwind", () => {
      expect(cn("p-component-sm", "px-inline-md")).toBe("p-component-sm px-inline-md");
      expect(cn("px-inline-md", "p-component-sm")).toBe("p-component-sm");
      expect(cn("gap-inline-sm", "gap-x-inline-md")).toBe("gap-inline-sm gap-x-inline-md");
      expect(cn("gap-x-inline-md", "gap-inline-sm")).toBe("gap-inline-sm");
      expect(cn("gap-x-inline-md", "gap-y-stack-sm")).toBe("gap-x-inline-md gap-y-stack-sm");
    });
    it("does not clash with unrelated utilities", () => {
      expect(cn("p-component-xs", "gap-inline-xs", "rounded-card", "text-sm", "md:p-component-lg")).toBe(
        "p-component-xs gap-inline-xs rounded-card text-sm md:p-component-lg",
      );
      expect(cn("md:gap-inline-sm", "md:gap-inline-xl")).toBe("md:gap-inline-xl");
    });
  });

  describe("radius tokens", () => {
    const utilities = ["rounded", "rounded-t", "rounded-b", "rounded-l", "rounded-r", "rounded-tl", "rounded-br"];
    it.each(utilities)("%s: a later radius token replaces an earlier one", (u) => {
      for (const [name, other] of pairs(tokenScales.radius)) {
        expect(cn(`${u}-${name}`, `${u}-${other}`)).toBe(`${u}-${other}`);
      }
      expect(cn(`${u}-card`, `${u}-lg`)).toBe(`${u}-lg`);
      expect(cn(`${u}-lg`, `${u}-card`)).toBe(`${u}-card`);
    });
    it("corner utilities resolve against the all-corners token", () => {
      expect(cn("rounded-t-card", "rounded-control")).toBe("rounded-control");
      expect(cn("rounded-control", "rounded-t-card")).toBe("rounded-control rounded-t-card");
      expect(cn("rounded-t-card", "rounded-b-card")).toBe("rounded-t-card rounded-b-card");
    });
  });

  describe("easing tokens", () => {
    it("ease-base conflicts with stock easings only", () => {
      expect(cn("ease-in", "ease-base")).toBe("ease-base");
      expect(cn("ease-base", "ease-out")).toBe("ease-out");
      expect(cn("ease-base", "transition-colors", "duration-[var(--duration-base)]")).toBe(
        "ease-base transition-colors duration-[var(--duration-base)]",
      );
    });
  });

  describe("typography (stock Tailwind, no custom tokens)", () => {
    it("merges the Figma text-style pairs", () => {
      expect(cn("text-sm font-semibold", "text-xl font-normal")).toBe("text-xl font-normal");
      expect(cn("text-base font-semibold text-text-secondary", "text-text-primary")).toBe(
        "text-base font-semibold text-text-primary",
      );
    });
  });

  describe("shadow tokens (none defined; stock shadows)", () => {
    it("merges stock shadows and leaves colours alone", () => {
      expect(cn("shadow-sm", "shadow-md")).toBe("shadow-md");
      expect(cn("shadow-sm", "bg-surface-primary")).toBe("shadow-sm bg-surface-primary");
    });
  });
});
