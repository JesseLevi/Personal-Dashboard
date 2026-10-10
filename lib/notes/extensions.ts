import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import Superscript from "@tiptap/extension-superscript";
import Subscript from "@tiptap/extension-subscript";
import { TableKit } from "@tiptap/extension-table";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { Details, DetailsContent, DetailsSummary } from "@tiptap/extension-details";
import { ReactNodeViewRenderer, type AnyExtension } from "@tiptap/react";
import { CodeBlockView } from "@/components/organisms/CodeBlockView";
import { noteLowlight } from "./code-languages";
import { detailsToggleLabel } from "./details-labels";
import { LINK_PROTOCOLS, isAllowedLinkUri } from "./link-url";

// The fixed TipTap extension whitelist Architecture §133 requires (#233):
// used by the editor (app/(app)/notities/[noteId]/NoteEditor.tsx) AND every
// future renderer of stored `notes.content` -- never `dangerouslySetInnerHTML`
// on it. #234 (toolbar) and #235 (tables) both add commands/UI against
// extensions already listed here, never against a second, drifted list --
// see this module's own doc comment on why table extensions belong in THIS
// array, not a second one.
//
// Editor-only concerns (Placeholder, its translated copy) are NOT here --
// they're UI, not content structure, and a future read-only renderer has no
// empty state to show. They're added at the useEditor() call site instead
// (NoteEditor.tsx).
//
// StarterKit 3.30 (checked against the installed package's own
// `dist/index.d.ts`, not a doc example -- the split shifts between majors)
// already bundles `@tiptap/extension-link` and `@tiptap/extension-underline`
// as part of its own StarterKitOptions, alongside paragraph/heading/lists/
// blockquote/code(Block)/bold/italic/strike/hardBreak/horizontalRule/
// dropcursor/gapcursor/undoRedo -- none of those needed a separate package.
// Only four marks/nodes the ticket names (uitlijning, markeerstift,
// super-/subscript) are genuinely absent from StarterKit and installed
// separately: TextAlign, Highlight, Superscript, Subscript.
//
// Tables (#234/#235, resizable since #330): `TableKit` (`@tiptap/extension-table`
// 3.30, one package in v3) registers Table/TableRow/TableCell/TableHeader.
// Column resize and `colwidth` persistence come from `table.resizable`; the
// stable fixed layout is `app/globals.css`. Rationale: design/notes/NoteEditor.md.
// `cellMinWidth` is the narrowest a column may be dragged and the unit a
// mobile table scrolls in.
export const TABLE_CELL_MIN_WIDTH = 96;

// #329 (ADR-0021 s1/s3): headings are limited to H1-H3 (StarterKit's default
// is H1-H6, but only three levels are designed and reachable from the
// block-type menu), and `TaskList`/`TaskItem` come from `@tiptap/extension-
// list` (pinned to @tiptap/core's version; NOT bundled in StarterKit 3.30).
// `a11y.checkboxLabel` is overridden because TaskItem's default label is a
// hard-coded English string and this static whitelist has no access to
// next-intl: the checkbox is named after the task text itself instead.
export const noteExtensions: AnyExtension[] = [
  // #331: links are limited to http/https/mailto (lib/notes/link-url.ts is the
  // one validator); the link popover, not a click, opens/edits a link.
  StarterKit.configure({
    // #336: replaced by CodeBlockLowlight below (same node name `codeBlock`).
    codeBlock: false,
    heading: { levels: [1, 2, 3] },
    link: {
      autolink: true,
      openOnClick: false,
      protocols: LINK_PROTOCOLS,
      isAllowedUri: (url) => isAllowedLinkUri(url),
    },
  }),
  TaskList,
  TaskItem.configure({
    nested: true,
    a11y: { checkboxLabel: (node) => node.textContent },
  }),
  // `types` must be listed explicitly (TipTap has no default) -- paragraph
  // and heading are the block types StarterKit registers; `tableCell`/
  // `tableHeader` are #235's own addition so alignment set inside a cell
  // survives, same as any other block.
  TextAlign.configure({ types: ["paragraph", "heading", "tableCell", "tableHeader"] }),
  Highlight,
  Superscript,
  Subscript,
  TableKit.configure({ table: { resizable: true, cellMinWidth: TABLE_CELL_MIN_WIDTH } }),
  // #336 (ADR-0021 s3): code blocks keep the node name `codeBlock` (and its
  // `language` attribute), so every stored block loads unchanged. Highlighting
  // runs on lib/notes/code-languages.ts's lazily-loaded grammars; the chrome
  // (language selector, copy button) is components/organisms/CodeBlockView.tsx.
  CodeBlockLowlight.extend({
    addNodeView() {
      return ReactNodeViewRenderer(CodeBlockView);
    },
  }).configure({ lowlight: noteLowlight, defaultLanguage: null }),
  // #336: collapsible section. Node names: `details` (attr `open`, persisted),
  // `detailsSummary` (inline text), `detailsContent` (block+).
  Details.configure({
    persist: true,
    renderToggleButton: ({ element, isOpen }) => {
      element.setAttribute("aria-label", detailsToggleLabel(isOpen));
      element.setAttribute("aria-expanded", String(isOpen));
      element.textContent = "▸";
    },
  }),
  DetailsSummary,
  DetailsContent,
];
