// #337 (ADR-0021 s3/s4): markdown <-> TipTap JSON, editor-side only. Storage
// stays TipTap JSON; markdown is only a paste / copy / export format.
//
// LAZY BY CONSTRUCTION: this module statically imports `@tiptap/markdown`
// (marked + the manager), so it must only ever be reached through
// `await import("@/lib/notes/markdown")` (paste handler, note menu). A static
// import anywhere in the `/notities` graph would put the parser in the initial
// chunk -- tests/notes-markdown.test.ts keeps a guard on that.
import { MarkdownManager } from "@tiptap/markdown";
import { Mark, Node, getSchema, type AnyExtension, type JSONContent } from "@tiptap/react";
import type { Node as PMNode, Schema } from "@tiptap/pm/model";
import { noteExtensions } from "./extensions";
import { isAllowedLinkUri } from "./link-url";

// ---------------------------------------------------------------------------
// Serializer entries. @tiptap/markdown reads `renderMarkdown` /
// `parseMarkdown` off each extension; most of our nodes already ship them.
// One entry per node/mark whose own extension has none -- add a new node as
// ONE clearly delimited block here (e.g. #336's details/detailsSummary/
// detailsContent), and add it to the round-trip test.
// ---------------------------------------------------------------------------
function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function unescapeHtml(text: string): string {
  return text.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

const MARKDOWN_ENTRIES: AnyExtension[] = [
  // --- details / detailsSummary / detailsContent (#336): one HTML block that
  // every markdown renderer understands. The summary is one line of text; the
  // body is ordinary markdown between a blank line and `</details>`.
  Node.create({
    name: "details",
    markdownTokenName: "details",
    markdownTokenizer: {
      name: "details",
      level: "block",
      start: (src) => src.search(/<details[\s>]/),
      tokenize(src, _tokens, lexer) {
        const head = /^<details(\s+open)?\s*>[ \t]*\n\s*<summary>([^\n]*?)<\/summary>[ \t]*(?:\n|$)/.exec(src);
        if (!head) return undefined;
        // Find the matching close, counting nested <details>.
        const tag = /<(\/?)details[\s>]/g;
        tag.lastIndex = head[0].length;
        let depth = 1;
        for (let m = tag.exec(src); m; m = tag.exec(src)) {
          depth += m[1] ? -1 : 1;
          if (depth === 0) {
            const end = src.indexOf(">", m.index) + 1;
            return {
              type: "details",
              raw: src.slice(0, end),
              open: Boolean(head[1]),
              summary: unescapeHtml(head[2] ?? ""),
              tokens: lexer.blockTokens(src.slice(head[0].length, m.index).trim()),
            };
          }
        }
        return undefined;
      },
    },
    parseMarkdown: (token, h) => {
      const body = h.parseChildren(token.tokens ?? []);
      const summary = String(token.summary ?? "").trim();
      return h.createNode("details", { open: Boolean(token.open) }, [
        h.createNode("detailsSummary", undefined, summary ? [h.createNode("text", { text: summary })] : []),
        h.createNode("detailsContent", undefined, body.length > 0 ? body : [{ type: "paragraph" }]),
      ]);
    },
    renderMarkdown: (node, h) => {
      const [summary, content] = node.content ?? [];
      const title = escapeHtml((summary?.content ?? []).map((child) => child.text ?? "").join(""));
      const body = h.renderChildren(content?.content ?? [], "\n\n").trim();
      return `<details${node.attrs?.open ? " open" : ""}>\n<summary>${title}</summary>\n\n${body}\n\n</details>`;
    },
  }),
  // --- superscript: no markdown syntax exists; export as inline HTML, which
  // every markdown renderer passes through. One-way (parse drops the tags and
  // keeps the text).
  Mark.create({
    name: "superscript",
    renderMarkdown: (node, h) => `<sup>${h.renderChildren(node)}</sup>`,
  }),
  // --- subscript: same reasoning as superscript.
  Mark.create({
    name: "subscript",
    renderMarkdown: (node, h) => `<sub>${h.renderChildren(node)}</sub>`,
  }),
];

let schemaCache: Schema | null = null;
function noteSchema(): Schema {
  schemaCache ??= getSchema(noteExtensions);
  return schemaCache;
}

function createManager(): MarkdownManager {
  const manager = new MarkdownManager({ extensions: noteExtensions });
  for (const entry of MARKDOWN_ENTRIES) manager.registerExtension(entry);
  return manager;
}

let managerCache: MarkdownManager | null = null;
function manager(): MarkdownManager {
  managerCache ??= createManager();
  return managerCache;
}

type JsonMark = NonNullable<JSONContent["marks"]>[number];

function sanitizeMarks(marks: JsonMark[] | undefined, schema: Schema): JsonMark[] | undefined {
  if (!marks) return undefined;
  const kept = marks.filter((mark) => {
    if (!schema.marks[mark.type]) return false;
    // Link hrefs go through the one validator (lib/notes/link-url.ts): drops
    // javascript:, data:, vbscript:, relative and malformed URLs.
    if (mark.type === "link") return isAllowedLinkUri(String(mark.attrs?.href ?? ""));
    return true;
  });
  return kept.length > 0 ? kept : undefined;
}

function sanitizeNode(node: JSONContent, schema: Schema): JSONContent[] {
  if (node.type === "text") {
    if (!node.text) return [];
    const marks = sanitizeMarks(node.marks, schema);
    return [marks ? { type: "text", text: node.text, marks } : { type: "text", text: node.text }];
  }
  const children = (node.content ?? []).flatMap((child) => sanitizeNode(child, schema));
  // Unknown node types are dropped, but their (already sanitised) content
  // survives so no text is silently lost.
  if (!node.type || !schema.nodes[node.type]) return children;
  const next: JSONContent = { type: node.type };
  if (node.attrs) next.attrs = node.attrs;
  if (children.length > 0) next.content = children;
  return [next];
}

/**
 * Forces parsed JSON through the app's ProseMirror schema (the single
 * extension whitelist): unknown nodes/marks dropped, disallowed link hrefs
 * dropped, and the result must pass `Node.check()` (content expressions) or
 * `null` is returned.
 */
export function sanitizeToSchema(doc: JSONContent): JSONContent | null {
  const schema = noteSchema();
  const content = (doc.content ?? []).flatMap((child) => sanitizeNode(child, schema));
  const candidate: JSONContent = { type: "doc", content };
  try {
    const node: PMNode = schema.nodeFromJSON(candidate);
    node.check();
    return node.toJSON() as JSONContent;
  } catch {
    return null;
  }
}

/** Markdown text -> schema-valid TipTap JSON (`null` when it cannot be made valid). */
export function markdownToDoc(markdown: string): JSONContent | null {
  return sanitizeToSchema(manager().parse(markdown));
}

/** TipTap JSON -> markdown text. */
export function docToMarkdown(doc: JSONContent): string {
  return `${manager().serialize(doc).trim()}\n`;
}
