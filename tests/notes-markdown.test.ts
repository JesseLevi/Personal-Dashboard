// @vitest-environment jsdom
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { Editor } from "@tiptap/react";
import type { JSONContent } from "@tiptap/react";
import { noteExtensions } from "../lib/notes/extensions";
import { docToMarkdown, markdownToDoc, sanitizeToSchema } from "../lib/notes/markdown";
import { looksLikeMarkdown } from "../lib/notes/markdown-detect";
import { markdownFilename } from "../lib/notes/markdown-export";
import { MarkdownPaste } from "../lib/notes/markdown-paste";
import { toPlainText, type TipTapDocument } from "../lib/notes/document";

// #337: markdown paste / copy / export against the real extension whitelist.

let editor: Editor | null = null;
afterEach(() => {
  editor?.destroy();
  editor = null;
});

/** Normalises a doc through the real schema (fills attr defaults) for comparison. */
function normalise(doc: JSONContent): JSONContent {
  editor?.destroy();
  editor = new Editor({ extensions: noteExtensions, content: doc });
  return editor.getJSON();
}

const t = (text: string, marks?: JSONContent["marks"]): JSONContent =>
  marks ? { type: "text", text, marks } : { type: "text", text };
const p = (...content: JSONContent[]): JSONContent => ({ type: "paragraph", content });

// One entry per block type on main. When a node is added (e.g. #336 details),
// add its fixture here: the round-trip test below picks it up.
const FIXTURES: Record<string, JSONContent[]> = {
  paragraph: [p(t("Just a paragraph."))],
  "heading 1-3": [1, 2, 3].map((level) => ({ type: "heading", attrs: { level }, content: [t(`Heading ${level}`)] })),
  "bullet list (nested)": [
    {
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [
            p(t("one")),
            { type: "bulletList", content: [{ type: "listItem", content: [p(t("nested"))] }] },
          ],
        },
        { type: "listItem", content: [p(t("two"))] },
      ],
    },
  ],
  "ordered list": [
    { type: "orderedList", content: [1, 2].map((n) => ({ type: "listItem", content: [p(t(`item ${n}`))] })) },
  ],
  "task list (checked and nested)": [
    {
      type: "taskList",
      content: [
        {
          type: "taskItem",
          attrs: { checked: true },
          content: [
            p(t("done")),
            { type: "taskList", content: [{ type: "taskItem", attrs: { checked: false }, content: [p(t("sub"))] }] },
          ],
        },
        { type: "taskItem", attrs: { checked: false }, content: [p(t("todo"))] },
      ],
    },
  ],
  blockquote: [{ type: "blockquote", content: [p(t("quoted"))] }],
  "code block with language": [
    { type: "codeBlock", attrs: { language: "ts" }, content: [t("const a = 1;\n\nconst b = 2;")] },
  ],
  "code block without language": [{ type: "codeBlock", content: [t("plain code")] }],
  "horizontal rule": [p(t("above")), { type: "horizontalRule" }, p(t("below"))],
  table: [
    {
      type: "table",
      content: [
        {
          type: "tableRow",
          content: ["Product", "Aantal"].map((h) => ({ type: "tableHeader", content: [p(t(h))] })),
        },
        {
          type: "tableRow",
          content: ["Melk", "2"].map((c) => ({ type: "tableCell", content: [p(t(c))] })),
        },
      ],
    },
  ],
  "inline marks": [
    p(
      t("bold", [{ type: "bold" }]),
      t(" "),
      t("italic", [{ type: "italic" }]),
      t(" "),
      t("strike", [{ type: "strike" }]),
      t(" "),
      t("code", [{ type: "code" }]),
      t(" "),
      t("mark", [{ type: "highlight" }]),
      t(" "),
      t("link", [{ type: "link", attrs: { href: "https://example.com/a" } }]),
    ),
  ],
};

describe("round trip: document -> markdown -> document", () => {
  it.each(Object.entries(FIXTURES))("%s", (_name, content) => {
    const original = normalise({ type: "doc", content });
    const markdown = docToMarkdown(original);
    const parsed = markdownToDoc(markdown);
    expect(parsed).not.toBeNull();
    const back = normalise(parsed as JSONContent);
    expect(back).toEqual(original);
  });

  it("the whole kitchen-sink document survives in one piece", () => {
    const original = normalise({ type: "doc", content: Object.values(FIXTURES).flat() });
    const back = normalise(markdownToDoc(docToMarkdown(original)) as JSONContent);
    expect(toPlainText(back as TipTapDocument)).toBe(toPlainText(original as TipTapDocument));
  });

  it("keeps a code block's language", () => {
    const markdown = docToMarkdown({
      type: "doc",
      content: [{ type: "codeBlock", attrs: { language: "python" }, content: [t("print(1)")] }],
    });
    expect(markdown).toContain("```python");
  });

  it("exports sub/superscript as inline HTML and keeps the text when read back", () => {
    const doc = {
      type: "doc",
      content: [p(t("x"), t("2", [{ type: "superscript" }]), t("y"), t("i", [{ type: "subscript" }]))],
    };
    const markdown = docToMarkdown(doc);
    expect(markdown).toContain("<sup>2</sup>");
    expect(markdown).toContain("<sub>i</sub>");
  });
});

describe("parsing real markdown", () => {
  it("produces task list, table and code block nodes", () => {
    const doc = markdownToDoc("- [ ] a\n- [x] b\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n```js\nlet x\n```\n");
    const types = doc?.content?.map((node) => node.type);
    expect(types).toEqual(["taskList", "table", "codeBlock"]);
    expect(doc?.content?.[2]?.attrs?.language).toBe("js");
  });
});

describe("hostile markdown is stripped", () => {
  it("drops <script> tags and event-handler HTML", () => {
    const doc = markdownToDoc("# Hi\n\n<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\ntext");
    const json = JSON.stringify(doc);
    expect(json).not.toContain("<script");
    expect(json).not.toContain("onerror");
    expect(json).toContain("Hi");
  });

  it.each(["javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html;base64,AAAA", "vbscript:x", " javascript:alert(1)"])(
    "drops a link to %s but keeps its text",
    (href) => {
      const doc = markdownToDoc(`[click me](${href})`);
      const json = JSON.stringify(doc);
      expect(json).not.toMatch(/javascript:|data:|vbscript:/i);
      expect(json).toContain("click me");
      expect(json).not.toContain('"link"');
    },
  );

  it("keeps http, https and mailto links", () => {
    const doc = markdownToDoc("[a](https://a.nl) [b](mailto:x@y.nl)");
    expect(JSON.stringify(doc).match(/"link"/g)).toHaveLength(2);
  });

  it("sanitizeToSchema drops unknown nodes and marks but keeps their text", () => {
    const doc = sanitizeToSchema({
      type: "doc",
      content: [
        { type: "iframe", content: [p(t("inside", [{ type: "bogus" }]))] },
        p(t("bad", [{ type: "link", attrs: { href: "javascript:alert(1)" } }])),
      ],
    });
    const json = JSON.stringify(doc);
    expect(json).not.toContain("iframe");
    expect(json).not.toContain("bogus");
    expect(json).not.toContain("javascript:");
    expect(json).toContain("inside");
  });
});

describe("looksLikeMarkdown", () => {
  it.each(["# Title", "- item", "* item", "1. one", "- [ ] task", "> quote", "```js\ncode\n```", "| a | b |\n|---|---|\n| 1 | 2 |"])(
    "detects %j",
    (text) => expect(looksLikeMarkdown(text)).toBe(true),
  );
  it.each(["", "just a sentence.", "price is 5 - 3", "a * b = c", "#hashtag", "-5 degrees"])(
    "leaves %j alone",
    (text) => expect(looksLikeMarkdown(text)).toBe(false),
  );
});

describe("markdownFilename", () => {
  it("appends .md and keeps a normal title", () => {
    expect(markdownFilename("Boodschappen deze week", "Naamloos")).toBe("Boodschappen deze week.md");
  });
  it.each([
    ["../../etc/passwd", "etc passwd.md"],
    ['a<b>:c"d|e?f*g', "a b c d e f g.md"],
    ["...hidden", "hidden.md"],
    ["trailing dots...", "trailing dots.md"],
    ["", "Naamloos.md"],
    ["///", "Naamloos.md"],
    ["CON", "CON_.md"],
  ])("sanitises %j", (title, expected) => {
    expect(markdownFilename(title, "Naamloos")).toBe(expected);
  });
  it("caps the length", () => {
    expect(markdownFilename("x".repeat(500), "n").length).toBeLessThanOrEqual(103);
  });
});

describe("paste handler", () => {
  function pasteInto(target: Editor, data: Record<string, string>): boolean {
    const clipboardData = {
      types: Object.keys(data),
      getData: (type: string) => data[type] ?? "",
    } as unknown as DataTransfer;
    const event = { clipboardData, preventDefault() {} } as unknown as ClipboardEvent;
    return Boolean(
      target.view.someProp("handlePaste", (handler) => handler(target.view, event, target.state.doc.slice(0, 0))),
    );
  }

  async function settle() {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  function make(): Editor {
    editor = new Editor({ extensions: [...noteExtensions, MarkdownPaste], content: "<p></p>" });
    editor.commands.focus("end");
    return editor;
  }

  it("turns pasted markdown plain text into real blocks", async () => {
    const target = make();
    const handled = pasteInto(target, {
      "text/plain": "# Plan\n\n- [ ] one\n- [x] two\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n```ts\nlet x = 1\n```",
    });
    expect(handled).toBe(true);
    await settle();
    const types = target.getJSON().content?.map((node) => node.type);
    expect(types).toEqual(expect.arrayContaining(["heading", "taskList", "table", "codeBlock"]));
  });

  it("strips script and javascript: links from a markdown paste", async () => {
    const target = make();
    pasteInto(target, { "text/plain": "- [x](javascript:alert(1))\n- <script>alert(1)</script>\n- ok" });
    await settle();
    const json = JSON.stringify(target.getJSON());
    expect(json).not.toContain("javascript:");
    expect(json).not.toContain("<script");
    expect(json).toContain("ok");
  });

  it("leaves HTML pastes to ProseMirror", () => {
    const target = make();
    expect(pasteInto(target, { "text/html": "<h1>x</h1>", "text/plain": "# x" })).toBe(false);
  });

  it("leaves non-markdown plain text to ProseMirror", () => {
    const target = make();
    expect(pasteInto(target, { "text/plain": "hello world" })).toBe(false);
  });

  it("keeps pasted text literal inside a code block", () => {
    const target = make();
    target.commands.setCodeBlock();
    expect(pasteInto(target, { "text/plain": "# not a heading" })).toBe(false);
  });
});

describe("lazy loading guard", () => {
  // The parser (marked + @tiptap/markdown) may only be reached through a
  // dynamic import(), never a static one, or it lands in the initial chunk.
  function sources(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
      const full = path.join(dir, entry);
      if (entry === "node_modules" || entry === ".next") return [];
      if (statSync(full).isDirectory()) return sources(full);
      return /\.(ts|tsx)$/.test(entry) && !/\.stories\.tsx$/.test(entry) ? [full] : [];
    });
  }

  it("only lib/notes/markdown.ts imports @tiptap/markdown or is statically imported", () => {
    const root = path.resolve(__dirname, "..");
    for (const dir of ["app", "components", "lib"]) {
      for (const file of sources(path.join(root, dir))) {
        const source = readFileSync(file, "utf8");
        const rel = path.relative(root, file);
        if (rel !== path.join("lib", "notes", "markdown.ts")) {
          expect(source, rel).not.toMatch(/from\s+["']@tiptap\/markdown["']/);
          expect(source, rel).not.toMatch(/from\s+["'](@\/lib\/notes|\.)\/markdown["']/);
        }
      }
    }
  });
});
