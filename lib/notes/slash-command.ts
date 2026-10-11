import { Extension, type Editor } from "@tiptap/react";
import Suggestion, { type SuggestionProps } from "@tiptap/suggestion";
import type { ResolvedPos } from "@tiptap/pm/model";
import { PluginKey } from "@tiptap/pm/state";
import { SLASH_ITEMS, filterSlashItems, type SlashItem } from "./slash-items";

// The "/" block menu (#332), built on the official @tiptap/suggestion. This
// module owns the editor side (trigger rules, filtering, keyboard, running
// the command); components/organisms/SlashMenu.tsx renders `SlashStore`.
// Editor-only UI, so it is added at the useEditor() call site like
// Placeholder, not in the content whitelist (lib/notes/extensions.ts).
// The extension reads labels through `labelsFor` so the nl/en label text is
// searchable too without this module touching next-intl.

export interface SlashState {
  open: boolean;
  items: SlashItem[];
  selectedIndex: number;
  /** Live viewport rect of the "/query" text (it moves on scroll); null when closed. */
  anchor: (() => DOMRect | null) | null;
  /** Table size picker (#330) shown at the spot the "/table" was typed. */
  tablePicker: { anchor: DOMRect | null } | null;
}

const CLOSED: SlashState = { open: false, items: [], selectedIndex: 0, anchor: null, tablePicker: null };

export class SlashStore {
  private state: SlashState = CLOSED;
  private listeners = new Set<() => void>();
  select: (item: SlashItem) => void = () => {};

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.state;

  set(patch: Partial<SlashState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }

  move(delta: number) {
    const count = this.state.items.length;
    if (count > 0) this.set({ selectedIndex: (this.state.selectedIndex + delta + count) % count });
  }

  closeTablePicker() {
    this.set({ tablePicker: null });
  }
}

export interface SlashCommandOptions {
  /** Extra searchable text per item, e.g. its translated label. */
  labelsFor: (item: SlashItem) => string[];
  items: SlashItem[];
}

export interface SlashCommandStorage {
  store: SlashStore;
}

/** The store of an editor that carries the SlashCommand extension, else null. */
export function getSlashStore(editor: Editor | null): SlashStore | null {
  const storage = editor?.storage as unknown as { slashCommand?: SlashCommandStorage } | undefined;
  return storage?.slashCommand?.store ?? null;
}

export const SlashCommandPluginKey = new PluginKey("slashCommand");

// A code block, or inline code, is literal text: "/" there stays a "/".
export function isInsideCode($pos: ResolvedPos) {
  return $pos.parent.type.spec.code === true || $pos.marks().some((mark) => mark.type.name === "code");
}

export const SlashCommand = Extension.create<SlashCommandOptions, SlashCommandStorage>({
  name: "slashCommand",

  addOptions() {
    return { labelsFor: () => [], items: SLASH_ITEMS };
  },

  addStorage() {
    return { store: new SlashStore() };
  },

  addProseMirrorPlugins() {
    const { editor, options } = this;
    const store = this.storage.store;

    store.select = (item) => {
      const range = SlashCommandPluginKey.getState(editor.state)?.range;
      if (range) runItem(editor, store, item, range);
    };

    function show(props: SuggestionProps<SlashItem, SlashItem>) {
      if (props.loading) return;
      store.set({ open: true, items: props.items, selectedIndex: 0, anchor: props.clientRect ?? null });
    }

    return [
      Suggestion<SlashItem, SlashItem>({
        pluginKey: SlashCommandPluginKey,
        editor,
        char: "/",
        // A "/" glued to a word ("a/b", a URL) never opens the menu; the
        // default prefix list allows only a space or the start of a block.
        allowedPrefixes: [" "],
        allow: ({ state, range }) => !isInsideCode(state.doc.resolve(range.from)),
        items: ({ query, editor: current }) =>
          filterSlashItems(
            options.items.filter((item) => item.isEnabled?.(current) ?? true),
            query,
            options.labelsFor,
          ),
        command: ({ editor: current, range, props: item }) => runItem(current, store, item, range),
        render: () => ({
          // Items resolve a microtask after the trigger; the menu opens (and
          // updates) only with real items so it never flashes "no results".
          onStart: (props) => show(props),
          onUpdate: (props) => show(props),
          onExit: () => {
            store.set({ open: false, items: [], selectedIndex: 0, anchor: null });
          },
          onKeyDown: ({ event }) => {
            const { items, selectedIndex } = store.getSnapshot();
            if (event.key === "ArrowDown") store.move(1);
            else if (event.key === "ArrowUp") store.move(-1);
            else if (event.key === "Enter" || event.key === "Tab") {
              // No results: swallow the key so Enter does not split the line
              // around the typed "/query".
              const item = items[selectedIndex];
              if (item) store.select(item);
            } else return false;
            return true;
          },
        }),
      }),
    ];
  },
});

function runItem(
  editor: Editor,
  store: SlashStore,
  item: SlashItem,
  range: { from: number; to: number },
) {
  const anchor = store.getSnapshot().anchor?.() ?? null;
  editor.chain().focus().deleteRange(range).run();
  if (item.opensTablePicker) store.set({ tablePicker: { anchor } });
  else item.run?.(editor);
}
