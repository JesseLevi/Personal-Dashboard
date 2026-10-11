import { Extension, type Editor } from "@tiptap/react";
import Suggestion from "@tiptap/suggestion";
import { PluginKey } from "@tiptap/pm/state";
import { isInsideCode } from "./slash-command";
import { NOTE_LINK_NODE_TYPE } from "./document";

// The "[[" note-link menu (#341, ADR-0023), built on the official
// @tiptap/suggestion like the "/" menu (lib/notes/slash-command.ts). This
// module owns the editor side (trigger, debounced search, keyboard, inserting
// the `noteLink` node); components/organisms/NoteLinkMenu.tsx renders the
// store. Editor-only UI, so it is added at the useEditor() call site, not in
// the content whitelist (lib/notes/extensions.ts has the node itself).

export interface NoteLinkSuggestionItem {
  id: string;
  title: string;
  category_name: string;
}

export interface NoteLinkMenuState {
  open: boolean;
  items: NoteLinkSuggestionItem[];
  selectedIndex: number;
  /** A search is in flight (the previous items stay visible meanwhile). */
  loading: boolean;
  /** Live viewport rect of the "[[query" text; null when closed. */
  anchor: (() => DOMRect | null) | null;
}

const CLOSED: NoteLinkMenuState = { open: false, items: [], selectedIndex: 0, loading: false, anchor: null };

export class NoteLinkStore {
  private state: NoteLinkMenuState = CLOSED;
  private listeners = new Set<() => void>();
  select: (item: NoteLinkSuggestionItem) => void = () => {};

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.state;

  set(patch: Partial<NoteLinkMenuState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }

  move(delta: number) {
    const count = this.state.items.length;
    if (count > 0) this.set({ selectedIndex: (this.state.selectedIndex + delta + count) % count });
  }
}

export interface NoteLinkSuggestionOptions {
  /** Candidate notes for the query (a server action in the app). */
  search: (query: string) => Promise<NoteLinkSuggestionItem[]>;
  /** Wait after the last keystroke before searching. */
  debounce: number;
}

export interface NoteLinkSuggestionStorage {
  store: NoteLinkStore;
}

/** The store of an editor that carries the NoteLinkSuggestion extension, else null. */
export function getNoteLinkStore(editor: Editor | null): NoteLinkStore | null {
  const storage = editor?.storage as unknown as { noteLinkSuggestion?: NoteLinkSuggestionStorage } | undefined;
  return storage?.noteLinkSuggestion?.store ?? null;
}

export const NoteLinkPluginKey = new PluginKey("noteLinkSuggestion");

export const NOTE_LINK_TRIGGER = "[[";
// A "[[" followed by a whole sentence is not a search any more.
const MAX_QUERY_LENGTH = 80;

export const NoteLinkSuggestion = Extension.create<NoteLinkSuggestionOptions, NoteLinkSuggestionStorage>({
  name: "noteLinkSuggestion",

  addOptions() {
    return { search: async () => [], debounce: 200 };
  },

  addStorage() {
    return { store: new NoteLinkStore() };
  },

  addProseMirrorPlugins() {
    const { editor, options } = this;
    const store = this.storage.store;

    store.select = (item) => {
      const range = NoteLinkPluginKey.getState(editor.state)?.range;
      if (range) insertNoteLink(editor, range, item);
    };

    return [
      Suggestion<NoteLinkSuggestionItem, NoteLinkSuggestionItem>({
        pluginKey: NoteLinkPluginKey,
        editor,
        char: NOTE_LINK_TRIGGER,
        // Titles have spaces; the menu ends on Escape, a selection, or when
        // the query grows past MAX_QUERY_LENGTH.
        allowSpaces: true,
        allowedPrefixes: null,
        debounce: options.debounce,
        allow: ({ state, range }) =>
          !isInsideCode(state.doc.resolve(range.from)) &&
          range.to - range.from - NOTE_LINK_TRIGGER.length <= MAX_QUERY_LENGTH,
        items: ({ query }) => options.search(query),
        command: ({ editor: current, range, props: item }) => insertNoteLink(current, range, item),
        render: () => {
          const update = (props: { items: NoteLinkSuggestionItem[]; loading?: boolean; clientRect?: (() => DOMRect | null) | null }) => {
            const current = store.getSnapshot();
            // While a search is in flight the previous results stay (no flash of an empty list).
            const items = props.loading ? current.items : props.items;
            store.set({
              open: true,
              items,
              loading: props.loading ?? false,
              selectedIndex: props.loading ? current.selectedIndex : 0,
              anchor: props.clientRect ?? null,
            });
          };
          return {
            onStart: update,
            onUpdate: update,
            onExit: () => store.set({ ...CLOSED }),
            onKeyDown: ({ event }) => {
              const { items, selectedIndex, loading } = store.getSnapshot();
              if (event.key === "ArrowDown") store.move(1);
              else if (event.key === "ArrowUp") store.move(-1);
              else if (event.key === "Enter" || event.key === "Tab") {
                // The list still belongs to the previous query: wait for the new one.
                if (loading) return true;
                // Nothing to pick: let Enter/Tab behave normally (and end the menu).
                const item = items[selectedIndex];
                if (!item) return false;
                store.select(item);
              } else return false;
              return true;
            },
          };
        },
      }),
    ];
  },
});

function insertNoteLink(editor: Editor, range: { from: number; to: number }, item: NoteLinkSuggestionItem) {
  editor
    .chain()
    .focus()
    .insertContentAt(range, [
      { type: NOTE_LINK_NODE_TYPE, attrs: { noteId: item.id, label: item.title.trim() } },
      { type: "text", text: " " },
    ])
    .run();
}
