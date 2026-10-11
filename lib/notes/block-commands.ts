import { Extension, type Editor } from "@tiptap/react";
import { Fragment, type Node as PMNode } from "@tiptap/pm/model";
import { Selection, TextSelection } from "@tiptap/pm/state";

// Top-level block commands behind the drag handle and block menu (#335).
// Generic on purpose: they move, copy and remove any child of the document
// without looking at its type, so tables, code blocks and later nodes work
// unchanged. Each command is one transaction, so a single undo restores it.
export interface TopLevelBlock {
  node: PMNode;
  index: number;
  from: number;
  to: number;
}

/** The document child containing `pos` (or starting at it, between blocks). */
export function topLevelBlockAt(doc: PMNode, pos: number): TopLevelBlock | null {
  if (doc.childCount === 0) return null;
  const clamped = Math.max(0, Math.min(pos, doc.content.size));
  const index = Math.min(doc.resolve(clamped).index(0), doc.childCount - 1);
  let from = 0;
  for (let i = 0; i < index; i += 1) from += doc.child(i).nodeSize;
  const node = doc.child(index);
  return { node, index, from, to: from + node.nodeSize };
}

function resolvePos(editor: Editor, pos?: number): number {
  return pos ?? editor.state.selection.from;
}

export function canMoveBlock(editor: Editor, direction: "up" | "down", pos?: number): boolean {
  const block = topLevelBlockAt(editor.state.doc, resolvePos(editor, pos));
  if (!block) return false;
  return direction === "up" ? block.index > 0 : block.index < editor.state.doc.childCount - 1;
}

/** Swaps the block with its neighbour; the selection travels with it. */
export function moveBlock(editor: Editor, direction: "up" | "down", pos?: number): boolean {
  const { state } = editor;
  const block = topLevelBlockAt(state.doc, resolvePos(editor, pos));
  if (!block || !canMoveBlock(editor, direction, pos)) return false;

  const neighbour = state.doc.child(direction === "up" ? block.index - 1 : block.index + 1);
  const start = direction === "up" ? block.from - neighbour.nodeSize : block.from;
  const end = direction === "up" ? block.to : block.to + neighbour.nodeSize;
  const moved = direction === "up" ? Fragment.from([block.node, neighbour]) : Fragment.from([neighbour, block.node]);
  const newFrom = direction === "up" ? start : block.from + neighbour.nodeSize;

  const tr = state.tr.replaceWith(start, end, moved);
  const { anchor, head } = state.selection;
  const inside = (value: number) => value >= block.from && value <= block.to;
  if (state.selection instanceof TextSelection && inside(anchor) && inside(head)) {
    const shift = newFrom - block.from;
    tr.setSelection(TextSelection.create(tr.doc, anchor + shift, head + shift));
  } else {
    tr.setSelection(Selection.near(tr.doc.resolve(newFrom + 1)));
  }
  editor.view.dispatch(tr.scrollIntoView());
  return true;
}

/** Moves the block to `toIndex` (its index in the document after the move), in one transaction. */
export function moveBlockToIndex(editor: Editor, toIndex: number, pos?: number): boolean {
  const { state } = editor;
  const block = topLevelBlockAt(state.doc, resolvePos(editor, pos));
  if (!block || toIndex === block.index || toIndex < 0 || toIndex > state.doc.childCount - 1) return false;
  const tr = state.tr.delete(block.from, block.to);
  let at = 0;
  for (let i = 0; i < toIndex; i += 1) at += tr.doc.child(i).nodeSize;
  tr.insert(at, block.node);
  tr.setSelection(Selection.near(tr.doc.resolve(at + 1)));
  editor.view.dispatch(tr.scrollIntoView());
  return true;
}

/** Inserts a copy right after the block and puts the cursor in the copy. */
export function duplicateBlock(editor: Editor, pos?: number): boolean {
  const { state } = editor;
  const block = topLevelBlockAt(state.doc, resolvePos(editor, pos));
  if (!block) return false;
  const tr = state.tr.insert(block.to, block.node);
  tr.setSelection(Selection.near(tr.doc.resolve(block.to + 1)));
  editor.view.dispatch(tr.scrollIntoView());
  return true;
}

/** Removes the block; the last remaining block is replaced by an empty paragraph. */
export function deleteBlock(editor: Editor, pos?: number): boolean {
  const { state } = editor;
  const block = topLevelBlockAt(state.doc, resolvePos(editor, pos));
  if (!block) return false;
  const tr = state.tr;
  if (state.doc.childCount === 1) {
    const empty = state.schema.topNodeType.contentMatch.defaultType?.createAndFill();
    if (!empty) return false;
    tr.replaceWith(block.from, block.to, empty);
  } else {
    tr.delete(block.from, block.to);
  }
  tr.setSelection(Selection.near(tr.doc.resolve(Math.min(block.from, tr.doc.content.size)), -1));
  editor.view.dispatch(tr.scrollIntoView());
  return true;
}

/** Puts the cursor inside the block so the editor's "turn into" commands act on it. */
export function selectBlockStart(editor: Editor, pos: number): boolean {
  const block = topLevelBlockAt(editor.state.doc, pos);
  if (!block) return false;
  const tr = editor.state.tr.setSelection(Selection.near(editor.state.doc.resolve(block.from + 1)));
  editor.view.dispatch(tr);
  return true;
}

// Blocks whose type "Turn into" can change. Tables, rules and anything
// structural stay out: converting their first cell would corrupt them.
const CONVERTIBLE_CONTAINERS = ["bulletList", "orderedList", "taskList", "blockquote"];

export function isConvertibleBlock(node: PMNode): boolean {
  return node.isTextblock || CONVERTIBLE_CONTAINERS.includes(node.type.name);
}

/** Block-menu option id for the node ("heading2", "bulletList", ...), or null. */
export function blockTypeId(node: PMNode): string | null {
  if (node.type.name === "heading") return `heading${node.attrs.level}`;
  return isConvertibleBlock(node) ? node.type.name : null;
}

// Mod-Shift-Up/Down: the keyboard alternative to dragging.
export const BlockShortcuts = Extension.create({
  name: "blockShortcuts",
  addKeyboardShortcuts() {
    return {
      "Mod-Shift-ArrowUp": () => moveBlock(this.editor, "up"),
      "Mod-Shift-ArrowDown": () => moveBlock(this.editor, "down"),
    };
  },
});
