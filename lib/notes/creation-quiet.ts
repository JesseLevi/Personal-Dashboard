import { Extension } from "@tiptap/react";
import { Plugin, PluginKey } from "@tiptap/pm/state";

// #342: TableOfContents and UniqueID assign heading ids in the editor's deferred
// `create` handlers. Those transactions would also make StarterKit's TrailingNode
// append its empty paragraph at load (it reacts to every transaction), which moves
// "end of the document" and the caret off the last real block. While the create
// handlers run, every transaction is marked `skipTrailingNode`, so the paragraph
// still appears with the first real edit, exactly as before.
const KEY = new PluginKey("creationQuiet");

export const CreationQuiet = Extension.create<Record<string, never>, { creating: boolean }>({
  name: "creationQuiet",
  priority: 10000,
  addStorage() {
    return { creating: false };
  },
  onCreate() {
    this.storage.creating = true;
    queueMicrotask(() => {
      this.storage.creating = false;
    });
  },
  addProseMirrorPlugins() {
    const storage = this.storage;
    return [
      new Plugin({
        key: KEY,
        filterTransaction(tr) {
          if (storage.creating) tr.setMeta("skipTrailingNode", true);
          return true;
        },
      }),
    ];
  },
});
