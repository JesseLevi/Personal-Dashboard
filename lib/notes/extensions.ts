import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import Superscript from "@tiptap/extension-superscript";
import Subscript from "@tiptap/extension-subscript";
import type { AnyExtension } from "@tiptap/react";

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
export const noteExtensions: AnyExtension[] = [
  StarterKit,
  // `types` must be listed explicitly (TipTap has no default) -- paragraph
  // and heading are the only block types StarterKit registers today. #235
  // adds `tableCell`/`tableHeader` here when tables land, not a second
  // TextAlign instance.
  TextAlign.configure({ types: ["paragraph", "heading"] }),
  Highlight,
  Superscript,
  Subscript,
];
