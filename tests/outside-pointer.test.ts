import { describe, expect, it } from "vitest";
import { isOutsideAllContainers, type ContainmentCheck } from "../lib/dom/outside-pointer";

// Fake node objects — `isOutsideAllContainers` only ever calls `.contains()`,
// so a real DOM (jsdom/RTL) isn't needed; this project's test infra is
// Vitest's node environment (tests/**/*.test.ts).
function containerContaining(...members: unknown[]): ContainmentCheck {
  return { contains: (node) => members.includes(node) };
}

describe("isOutsideAllContainers", () => {
  const targetInA = { name: "inside A" };
  const targetInB = { name: "inside B" };
  const targetOutside = { name: "outside both" };
  const containerA = containerContaining(targetInA);
  const containerB = containerContaining(targetInB);

  it("does not report outside for a click inside container A", () => {
    expect(isOutsideAllContainers(targetInA as unknown as Node, [containerA, containerB])).toBe(
      false,
    );
  });

  it("does not report outside for a click inside container B", () => {
    expect(isOutsideAllContainers(targetInB as unknown as Node, [containerA, containerB])).toBe(
      false,
    );
  });

  it("reports outside for a click outside both containers", () => {
    expect(
      isOutsideAllContainers(targetOutside as unknown as Node, [containerA, containerB]),
    ).toBe(true);
  });

  it("skips null containers rather than treating them as inside or outside", () => {
    expect(isOutsideAllContainers(targetInA as unknown as Node, [null, containerA])).toBe(false);
    expect(isOutsideAllContainers(targetOutside as unknown as Node, [null, containerA])).toBe(
      true,
    );
    expect(isOutsideAllContainers(targetOutside as unknown as Node, [null, null])).toBe(true);
  });
});
