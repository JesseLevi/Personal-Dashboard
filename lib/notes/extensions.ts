import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import Superscript from "@tiptap/extension-superscript";
import Subscript from "@tiptap/extension-subscript";
import { TableKit } from "@tiptap/extension-table";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { Details, DetailsContent, DetailsSummary } from "@tiptap/extension-details";
import Image from "@tiptap/extension-image";
import FileHandler from "@tiptap/extension-file-handler";
import { TableOfContents } from "@tiptap/extension-table-of-contents";
import { UniqueID } from "@tiptap/extension-unique-id";
import Mention, { type MentionOptions } from "@tiptap/extension-mention";
import { NodeSelection } from "@tiptap/pm/state";
import { ReactNodeViewRenderer, mergeAttributes, type AnyExtension } from "@tiptap/react";
import { CodeBlockView } from "@/components/organisms/CodeBlockView";
import { NoteImageView } from "@/components/organisms/NoteImageView";
import { NoteLinkView } from "@/components/organisms/NoteLinkView";
import { noteLowlight } from "./code-languages";
import { NOTE_LINK_NODE_TYPE } from "./document";
import { EMPTY_NOTE_LINK_RESOLUTION, type NoteLinkResolution } from "./note-link";
import { detailsToggleLabel } from "./details-labels";
import { LINK_PROTOCOLS, isAllowedLinkUri } from "./link-url";
import { BlockShortcuts } from "./block-commands";
import { NOTE_IMAGE_MIME_TYPES, isNoteImageSrc, requestImageUpload } from "./image-upload";

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
// #339 (ADR-0022): a block `image` with `src` + `alt`. `src` is only ever the
// same-origin /api/note-image route (#338): pasted HTML, markdown and the
// `![](...)` input rule can not introduce an external picture. The node view
// (components/organisms/NoteImageView.tsx) adds the alt-text field, delete and
// the broken-image state; Enter on a selected image moves focus to that field.
const NoteImage = Image.extend({
  addAttributes() {
    return { src: { default: null }, alt: { default: null } };
  },
  parseHTML() {
    return [{ tag: 'img[src^="/api/note-image/"]' }];
  },
  addInputRules() {
    return [];
  },
  parseMarkdown: (token, helpers) =>
    isNoteImageSrc(token.href)
      ? helpers.createNode("image", { src: token.href, alt: token.text || null })
      : helpers.createNode("paragraph", undefined, [helpers.createNode("text", { text: token.raw ?? "" })]),
  addNodeView() {
    return ReactNodeViewRenderer(NoteImageView);
  },
  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        const { selection } = editor.state;
        if (!(selection instanceof NodeSelection) || selection.node.type.name !== "image" || !editor.isEditable) {
          return false;
        }
        const field = (editor.view.nodeDOM(selection.from) as HTMLElement | null)?.querySelector("input");
        field?.focus();
        return Boolean(field);
      },
    };
  },
});

// #341 (ADR-0023): `noteLink`, an inline atom built on the official Mention
// node. Stored attrs: `noteId` (uuid; what lib/notes/document.ts's
// extractNoteLinkIds hands to save_note_content) and `label` (the target's
// title when inserted, the fallback text). The editor shows the target's
// CURRENT title from `resolution` (lib/notes/note-link.ts), set per editor at
// the call site via `noteExtensionsWith`. The `[[` trigger is NOT here: it is
// the editor-only lib/notes/note-link-suggestion.ts, so a read-only renderer
// carries no menu. Mention's own suggestion plugin is therefore switched off,
// and its `:mention[...]` markdown syntax replaced by `[[label]]` on export.
export interface NoteLinkOptions extends MentionOptions {
  resolution: NoteLinkResolution;
}

export const NoteLink = Mention.extend<NoteLinkOptions>({
  name: NOTE_LINK_NODE_TYPE,
  addOptions() {
    return { ...this.parent?.(), resolution: EMPTY_NOTE_LINK_RESOLUTION } as NoteLinkOptions;
  },
  addAttributes() {
    return {
      noteId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-note-id"),
      },
      label: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-label") ?? element.textContent ?? "",
      },
    };
  },
  parseHTML() {
    return [{ tag: `span[data-type="${NOTE_LINK_NODE_TYPE}"]` }];
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-type": NOTE_LINK_NODE_TYPE,
        "data-note-id": node.attrs.noteId,
        "data-label": node.attrs.label,
      }),
      node.attrs.label ?? "",
    ];
  },
  renderText({ node }) {
    return node.attrs.label ?? "";
  },
  markdownTokenName: undefined,
  markdownTokenizer: undefined,
  parseMarkdown: undefined,
  renderMarkdown: (node) => `[[${String(node.attrs?.label ?? "")}]]`,
  addKeyboardShortcuts: () => ({}),
  addProseMirrorPlugins: () => [],
  addNodeView() {
    return ReactNodeViewRenderer(NoteLinkView, { as: "span" });
  },
});

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
    // #335: the drop line while dragging a block is styled with tokens in app/globals.css.
    dropcursor: { color: false, width: 2, class: "note-dropcursor" },
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
  NoteImage,
  // #339: pasted and dropped image files go to the editor-only `requestImageUpload`
  // storage (lib/notes/image-upload.ts), added at the useEditor() call site.
  FileHandler.configure({
    allowedMimeTypes: NOTE_IMAGE_MIME_TYPES,
    onPaste: (editor, files) => {
      requestImageUpload(editor, files);
    },
    onDrop: (editor, files, pos) => {
      requestImageUpload(editor, files, pos);
    },
  }),
  // #335: Mod-Shift-Up/Down move the current top-level block (drag-handle alternative).
  BlockShortcuts,
  // #341: links to other notes.
  NoteLink,
  // #342: heading ids for the table-of-contents rail. `UniqueID` is limited to
  // headings; `TableOfContents` keeps the heading list (`editor.storage.
  // tableOfContents.content`) and adds its own `data-toc-id` attribute. Both
  // are additive attributes: a note without them loads unchanged and gets ids
  // on its next save (lib/notes/toc.ts). `scrollParent: undefined` switches off
  // the extension's own scroll listener -- the rail tracks the active heading
  // itself (components/organisms/NoteTableOfContents.tsx).
  UniqueID.configure({ types: ["heading"] }),
  TableOfContents.configure({ anchorTypes: ["heading"], scrollParent: undefined }),
];

/** The whitelist with this editor's note-link resolution (current titles, deleted targets, navigation). */
export function noteExtensionsWith(resolution: NoteLinkResolution): AnyExtension[] {
  return noteExtensions.map((extension) => (extension === NoteLink ? NoteLink.configure({ resolution }) : extension));
}
