// Client-side image insertion for the notes editor (#339). Pure helpers plus
// the editor-only `NoteImageUpload` extension: paste, drop, the slash item and
// the EditingBar all end in `requestImageUpload`, which shows a
// placeholder (a ProseMirror widget, never a node) while the #338 server action
// runs. On success the placeholder becomes an `image` node; on failure it is
// removed and the error code goes to `onError` -- nothing optimistic is stored.
// Rationale: design/notes/NoteEditor.md (#339).
import { Extension, type Editor } from "@tiptap/react";
import { Plugin, PluginKey, type EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as PMNode, NodeType } from "@tiptap/pm/model";
import type { ActionResult } from "./types";

export const MAX_NOTE_IMAGE_BYTES = 10 * 1024 * 1024;
export const NOTE_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const NOTE_IMAGE_ACCEPT = NOTE_IMAGE_MIME_TYPES.join(",");

const NOTE_IMAGE_SRC = /^\/api\/note-image\/[0-9a-f-]{36}\/[0-9a-f-]{36}$/i;

/** True for the same-origin delivery route of #338 -- the only `src` the editor accepts from outside. */
export function isNoteImageSrc(src: unknown): src is string {
  return typeof src === "string" && NOTE_IMAGE_SRC.test(src);
}

export type ImageFileError = "invalid-file-type" | "file-too-large";

/** The error code (a `notes.errors` key) for a file that must not be uploaded, else null. */
export function validateImageFile(file: { type: string; size: number }): ImageFileError | null {
  if (!NOTE_IMAGE_MIME_TYPES.includes(file.type)) return "invalid-file-type";
  if (file.size > MAX_NOTE_IMAGE_BYTES) return "file-too-large";
  return null;
}

/**
 * Where a block image goes for a cursor at `pos`: after the nearest enclosing
 * block that can be followed by an image, and in place of the block itself
 * when it is an empty paragraph. Falls back to the end of the document.
 */
export function imageInsertTarget(
  doc: PMNode,
  pos: number,
  imageType: NodeType,
): { pos: number; replaceEmpty: boolean } {
  const clamped = Math.max(0, Math.min(pos, doc.content.size));
  const $pos = doc.resolve(clamped);
  for (let depth = $pos.depth; depth >= 1; depth -= 1) {
    const after = $pos.after(depth);
    const $after = doc.resolve(after);
    if (!$after.parent.canReplaceWith($after.index(), $after.index(), imageType)) continue;
    const block = $pos.node(depth);
    const replaceEmpty =
      depth === $pos.depth && block.type.name === "paragraph" && block.content.size === 0;
    return { pos: after, replaceEmpty };
  }
  if (doc.canReplaceWith(doc.childCount, doc.childCount, imageType)) {
    return { pos: doc.content.size, replaceEmpty: false };
  }
  return { pos: clamped, replaceEmpty: false };
}

export interface NoteImageUploadOptions {
  /** Runs the #338 action for one file. */
  upload: (file: File) => Promise<ActionResult<{ src: string }>>;
  /** Called with a `notes.errors` key when a file was rejected or its upload failed. */
  onError: (code: string) => void;
  /** Shrinks a file before upload (lib/images/downscale-client.ts); identity by default. */
  prepare?: (file: File) => Promise<File>;
  /** Accessible text of the upload placeholder. */
  uploadingLabel: string;
}

interface PlaceholderSpec {
  id: object;
  replaceEmpty: boolean;
}

type PlaceholderMeta = { add: { pos: number; spec: PlaceholderSpec; label: string } } | { remove: object };

const placeholderKey = new PluginKey<DecorationSet>("noteImageUpload");

function placeholderElement(label: string): HTMLElement {
  const element = document.createElement("div");
  element.className = "note-image-uploading";
  element.setAttribute("role", "status");
  element.contentEditable = "false";
  element.textContent = label;
  return element;
}

function findPlaceholder(state: EditorState, id: object): Decoration | undefined {
  return placeholderKey.getState(state)?.find(undefined, undefined, (spec) => spec.id === id)[0];
}

async function uploadOne(editor: Editor, file: File, pos: number, options: NoteImageUploadOptions) {
  const imageType = editor.schema.nodes.image;
  const rejected = validateImageFile(file);
  if (rejected) {
    options.onError(rejected);
    return;
  }

  const spec: PlaceholderSpec = { id: {}, replaceEmpty: false };
  const target = imageInsertTarget(editor.state.doc, pos, imageType);
  spec.replaceEmpty = target.replaceEmpty;
  const add: PlaceholderMeta = { add: { pos: target.pos, spec, label: options.uploadingLabel } };
  editor.view.dispatch(editor.state.tr.setMeta(placeholderKey, add));

  const removePlaceholder = () => {
    if (editor.isDestroyed) return;
    const remove: PlaceholderMeta = { remove: spec.id };
    editor.view.dispatch(editor.state.tr.setMeta(placeholderKey, remove));
  };

  let result: ActionResult<{ src: string }>;
  try {
    const prepared = options.prepare ? await options.prepare(file) : file;
    result = await options.upload(prepared);
  } catch {
    result = { success: false, error: "upload-failed" };
  }
  if (editor.isDestroyed) return;

  if (!result.success || !isNoteImageSrc(result.data.src)) {
    removePlaceholder();
    options.onError(result.success ? "upload-failed" : result.error);
    return;
  }

  const found = findPlaceholder(editor.state, spec.id);
  if (!found) return;
  const { tr } = editor.state;
  const node = imageType.create({ src: result.data.src });
  // The placeholder sits at a block boundary; re-check it still accepts an image.
  const $found = tr.doc.resolve(found.from);
  const at = $found.parent.canReplaceWith($found.index(), $found.index(), imageType)
    ? found.from
    : imageInsertTarget(tr.doc, found.from, imageType).pos;
  tr.insert(at, node);
  if (spec.replaceEmpty) {
    const before = tr.doc.resolve(at).nodeBefore;
    if (before && before.type.name === "paragraph" && before.content.size === 0) {
      tr.delete(at - before.nodeSize, at);
    }
  }
  const remove: PlaceholderMeta = { remove: spec.id };
  editor.view.dispatch(tr.setMeta(placeholderKey, remove));
}

export const NoteImageUpload = Extension.create<NoteImageUploadOptions>({
  name: "noteImageUpload",

  addStorage() {
    return { upload: null as null | ((files: File[], pos?: number) => void) };
  },

  onBeforeCreate() {
    this.storage.upload = (files: File[], pos?: number) => {
      const at = pos ?? this.editor.state.selection.from;
      for (const file of files) void uploadOne(this.editor, file, at, this.options);
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: placeholderKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, set) {
            const mapped = set.map(tr.mapping, tr.doc);
            const meta = tr.getMeta(placeholderKey) as PlaceholderMeta | undefined;
            if (!meta) return mapped;
            if ("add" in meta) {
              const { pos, spec, label } = meta.add;
              return mapped.add(tr.doc, [
                Decoration.widget(pos, () => placeholderElement(label), { ...spec, side: 1 }),
              ]);
            }
            return mapped.remove(mapped.find(undefined, undefined, (spec) => spec.id === meta.remove));
          },
        },
        props: {
          decorations: (state) => placeholderKey.getState(state),
        },
      }),
    ];
  },
});

/** Uploads `files` as images at `pos` (default: the cursor). A no-op in editors without NoteImageUpload (stories). */
export function requestImageUpload(editor: Editor, files: File[], pos?: number): void {
  const storage = editor.storage as unknown as Record<string, { upload?: ((files: File[], pos?: number) => void) | null } | undefined>;
  storage.noteImageUpload?.upload?.(files, pos);
}

/** Opens the system file picker and uploads the chosen images at the cursor. */
export function openImagePicker(editor: Editor): void {
  const pos = editor.state.selection.from;
  const input = document.createElement("input");
  input.type = "file";
  input.accept = NOTE_IMAGE_ACCEPT;
  input.multiple = true;
  input.hidden = true;
  // Attached while the dialog is open: a detached input can be collected before `change` fires.
  document.body.append(input);
  const finish = () => input.remove();
  input.addEventListener("cancel", finish);
  input.addEventListener("change", () => {
    const files = Array.from(input.files ?? []);
    finish();
    editor.commands.focus();
    if (files.length > 0) requestImageUpload(editor, files, pos);
  });
  input.click();
}
