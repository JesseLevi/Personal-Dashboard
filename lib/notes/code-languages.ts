import { createLowlight } from "lowlight";
import type { LanguageFn } from "highlight.js";
import type { Editor } from "@tiptap/react";

// #336 (ADR-0021 s3): the fixed language set for note code blocks. The stored
// `language` attribute is the id below (`null`/"plain" = no highlighting), so
// #337 (markdown) can use it as the fence info string as-is.
//
// Grammars are the heavy part of highlighting, so none is imported up front:
// each is a dynamic import() (its own async chunk) that runs the first time a
// code block uses that language. Until then a block simply renders uncoloured;
// `loadCodeLanguage` + `rehighlightCodeBlocks` colour it once the chunk lands.
// There is deliberately no auto-detection: `highlightAuto` is a no-op so a
// block without a chosen language stays plain and nothing needs to be loaded.
export const CODE_LANGUAGE_IDS = [
  "plain",
  "javascript",
  "typescript",
  "json",
  "css",
  "html",
  "bash",
  "sql",
  "python",
  "markdown",
] as const;

export type CodeLanguageId = (typeof CODE_LANGUAGE_IDS)[number];

const GRAMMARS: Record<Exclude<CodeLanguageId, "plain">, () => Promise<{ default: LanguageFn }>> = {
  javascript: () => import("highlight.js/lib/languages/javascript"),
  typescript: () => import("highlight.js/lib/languages/typescript"),
  json: () => import("highlight.js/lib/languages/json"),
  css: () => import("highlight.js/lib/languages/css"),
  // highlight.js ships HTML as its `xml` grammar.
  html: () => import("highlight.js/lib/languages/xml"),
  bash: () => import("highlight.js/lib/languages/bash"),
  sql: () => import("highlight.js/lib/languages/sql"),
  python: () => import("highlight.js/lib/languages/python"),
  markdown: () => import("highlight.js/lib/languages/markdown"),
};

export function isCodeLanguageId(value: unknown): value is CodeLanguageId {
  return typeof value === "string" && (CODE_LANGUAGE_IDS as readonly string[]).includes(value);
}

const registry = createLowlight();
const inflight = new Map<string, Promise<boolean>>();

type Highlighted = ReturnType<typeof registry.highlight>;

function emptyTree(): Highlighted {
  return { type: "root", children: [], data: { language: undefined, relevance: 0 } };
}

// The `lowlight` instance handed to CodeBlockLowlight: registered grammars
// highlight, everything else (not loaded yet, plain, unknown) is an empty tree.
export const noteLowlight = {
  highlight(language: string, value: string): Highlighted {
    return registry.registered(language) ? registry.highlight(language, value) : emptyTree();
  },
  highlightAuto: (): Highlighted => emptyTree(),
  listLanguages: () => registry.listLanguages(),
  registered: (language: string) => registry.registered(language),
};

/** Loads and registers one grammar. Resolves true when it was newly registered. */
export function loadCodeLanguage(language: string | null | undefined): Promise<boolean> {
  if (!isCodeLanguageId(language) || language === "plain" || registry.registered(language)) {
    return Promise.resolve(false);
  }
  let pending = inflight.get(language);
  if (!pending) {
    pending = GRAMMARS[language]().then((module) => {
      registry.register({ [language]: module.default });
      return true;
    });
    inflight.set(language, pending);
  }
  return pending;
}

/**
 * The highlight plugin only recomputes on a document change, so after a grammar
 * registers we dispatch one content-neutral, history-less, update-less
 * transaction that re-sets each code block's own (unchanged) attributes.
 */
export function rehighlightCodeBlocks(editor: Editor): void {
  if (editor.isDestroyed) return;
  const tr = editor.state.tr;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== "codeBlock") return;
    tr.setNodeMarkup(pos, undefined, node.attrs);
  });
  if (!tr.docChanged) return;
  tr.setMeta("addToHistory", false).setMeta("preventUpdate", true);
  editor.view.dispatch(tr);
}
