// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { Editor } from "@tiptap/react";
import { noteExtensions } from "../lib/notes/extensions";
import { isAllowedLinkUri, normalizeLinkUrl } from "../lib/notes/link-url";

describe("normalizeLinkUrl", () => {
  it.each([
    ["https://example.com", "https://example.com"],
    ["http://example.com/a?b=1#c", "http://example.com/a?b=1#c"],
    ["  example.com  ", "https://example.com"],
    ["www.example.com/pad", "https://www.example.com/pad"],
    ["example.com:8080/x", "https://example.com:8080/x"],
    ["localhost:3000", "https://localhost:3000"],
    ["mailto:jesse@example.com", "mailto:jesse@example.com"],
    ["jesse@example.com", "mailto:jesse@example.com"],
    ["HTTPS://Example.com", "HTTPS://Example.com"],
  ])("accepts %s", (input, expected) => {
    expect(normalizeLinkUrl(input)).toBe(expected);
  });

  it.each([
    "",
    "   ",
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    " java\nscript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "ftp://example.com",
    "file:///etc/passwd",
    "tel:+31612345678",
    "//example.com",
    "https://",
    "mailto:",
    "not a url",
    "justaword",
    "https://exa mple.com",
    "https:\\\\example.com",
  ])("rejects %j", (input) => {
    expect(normalizeLinkUrl(input)).toBeNull();
  });
});

describe("isAllowedLinkUri", () => {
  it("allows http, https and mailto only", () => {
    expect(isAllowedLinkUri("https://a.nl")).toBe(true);
    expect(isAllowedLinkUri("http://a.nl")).toBe(true);
    expect(isAllowedLinkUri("mailto:a@b.nl")).toBe(true);
    expect(isAllowedLinkUri("javascript:alert(1)")).toBe(false);
    expect(isAllowedLinkUri("/relative")).toBe(false);
    expect(isAllowedLinkUri(undefined)).toBe(false);
  });
});

let editor: Editor | null = null;
afterEach(() => {
  editor?.destroy();
  editor = null;
});

describe("Link extension config", () => {
  it("refuses a javascript: href through setLink", () => {
    editor = new Editor({ extensions: noteExtensions, content: "<p>tekst</p>" });
    editor.commands.selectAll();
    editor.commands.setLink({ href: "javascript:alert(1)" });
    expect(editor.getHTML()).not.toContain("javascript:");
    editor.commands.setLink({ href: "https://example.com" });
    expect(editor.getHTML()).toContain('href="https://example.com"');
  });

  it("drops a stored javascript: link when loading", () => {
    editor = new Editor({
      extensions: noteExtensions,
      content: '<p><a href="javascript:alert(1)">x</a></p>',
    });
    expect(editor.getHTML()).not.toContain("javascript:");
  });
});
