import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Button } from "../components/atoms/Button";
import { Dropdown } from "../components/atoms/Dropdown";
import { Tag } from "../components/atoms/Tag";

// Loosely typed: the atoms' prop unions require `children` in the props
// object, which the lint rule forbids passing that way.
const h = createElement as unknown as (type: unknown, props: object | null, ...children: unknown[]) => ReactElement;

function render(defaultOpen: boolean) {
  return renderToStaticMarkup(
    h(
      Dropdown,
      { id: "status", label: "Status", defaultOpen },
      h(Button, { presentational: true, variant: "filled", align: "left" }, "Open"),
      h(Button, { variant: "white", align: "left" }, "Klaar"),
    ),
  );
}

describe("labelled Dropdown trigger", () => {
  it("owns exactly one button for the selection row, with no nesting", () => {
    const html = render(false);
    const trigger = html.match(/<button[^>]*id="status-trigger"[^>]*>(.*?)<\/button>/s);
    expect(trigger).not.toBeNull();
    const inner = trigger![1]!;
    expect(inner).toContain("Open");
    expect(inner).toContain("<svg");
    expect(inner).not.toContain("<button");
    expect(inner).not.toContain('role="button"');
  });

  it("wires the disclosure ARIA to the panel", () => {
    const closed = render(false);
    expect(closed).toContain('aria-expanded="false"');
    expect(closed).toContain('aria-controls="status-panel"');
    expect(closed).toContain('aria-labelledby="status status-trigger"');
    expect(closed).not.toContain("aria-haspopup");
    expect(render(true)).toContain('aria-expanded="true"');
  });

  it("makes the label a native label of the trigger", () => {
    expect(render(false)).toMatch(/<label[^>]*id="status"[^>]*for="status-trigger"/);
  });

  it("renders a presentational Button as a span with the same classes", () => {
    const pill = renderToStaticMarkup(h(Button, { presentational: true }, "Open"));
    const real = renderToStaticMarkup(h(Button, null, "Open"));
    expect(pill.startsWith("<span")).toBe(true);
    expect(pill).not.toContain("<button");
    const cls = (html: string) => html.match(/class="([^"]*)"/)![1];
    expect(cls(pill)).toBe(cls(real));
  });

  it("accepts a Tag as the selection", () => {
    const html = renderToStaticMarkup(
      h(
        Dropdown,
        { id: "prio", label: "Prioriteit", defaultOpen: false },
        h(Tag, { variant: "urgent" }, "Urgent"),
        h(Tag, { variant: "low" }, "Laag"),
      ),
    );
    expect(html.match(/<button/g)).toHaveLength(1);
  });
});
