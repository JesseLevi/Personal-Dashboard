// #337: pasting plain text that looks like markdown becomes rich blocks.
// HTML pastes (anything with a text/html flavour) keep ProseMirror's default
// path, which the schema + link validator already filter. The markdown parser
// is loaded on demand (dynamic import), never in the initial /notities chunk.
import { Extension } from "@tiptap/react";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Fragment, Slice } from "@tiptap/pm/model";
import type { EditorView } from "@tiptap/pm/view";
import { looksLikeMarkdown } from "./markdown-detect";

async function pasteMarkdown(view: EditorView, text: string): Promise<void> {
  let replacement: Slice | null = null;
  try {
    const { markdownToDoc } = await import("./markdown");
    const doc = markdownToDoc(text);
    if (doc) {
      const fragment = Fragment.fromJSON(view.state.schema, doc.content ?? []);
      replacement = Slice.maxOpen(fragment);
    }
  } catch {
    // Chunk failed to load or the markdown could not be made schema-valid:
    // fall through to inserting the text unchanged.
  }
  if (view.isDestroyed) return;
  const { tr } = view.state;
  if (replacement) tr.replaceSelection(replacement);
  else tr.insertText(text);
  view.dispatch(tr.scrollIntoView().setMeta("paste", true).setMeta("uiEvent", "paste"));
}

export const MarkdownPaste = Extension.create({
  name: "markdownPaste",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("markdownPaste"),
        props: {
          handlePaste: (view, event) => {
            const data = event.clipboardData;
            if (!data || data.types.includes("text/html")) return false;
            // Code blocks keep pasted text literal.
            if (view.state.selection.$from.parent.type.spec.code) return false;
            const text = data.getData("text/plain");
            if (!looksLikeMarkdown(text)) return false;
            void pasteMarkdown(view, text);
            return true;
          },
        },
      }),
    ];
  },
});
