// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { Editor } from "@tiptap/react";
import { noteExtensions } from "../lib/notes/extensions";
import {
  MAX_NOTE_IMAGE_BYTES,
  NoteImageUpload,
  imageInsertTarget,
  isNoteImageSrc,
  requestImageUpload,
  validateImageFile,
} from "../lib/notes/image-upload";
import { SLASH_ITEMS } from "../lib/notes/slash-items";
import type { ActionResult } from "../lib/notes/types";

// #339: validation, the placeholder lifecycle and the guarded image node,
// against the real extension whitelist.

const SRC = "/api/note-image/11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222";
const png = () => new File([new Uint8Array(16)], "a.png", { type: "image/png" });
const failing = () => Promise.resolve<ActionResult<{ src: string }>>({ success: false, error: "generic" });

let editor: Editor | null = null;

function make(upload: (file: File) => Promise<ActionResult<{ src: string }>>, onError = vi.fn()) {
  editor = new Editor({
    extensions: [...noteExtensions, NoteImageUpload.configure({ upload, onError, uploadingLabel: "Uploading" })],
    content: "<p>Eerste</p><p></p>",
  });
  return { editor, onError };
}

afterEach(() => {
  editor?.destroy();
  editor = null;
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const placeholders = (target: Editor) => target.view.dom.querySelectorAll(".note-image-uploading").length;
const imageNodes = (target: Editor) => target.getJSON().content?.filter((node) => node.type === "image") ?? [];

describe("validateImageFile / isNoteImageSrc", () => {
  it("accepts the four image types and rejects anything else", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp", "image/gif"]) {
      expect(validateImageFile({ type, size: 10 })).toBeNull();
    }
    expect(validateImageFile({ type: "application/pdf", size: 10 })).toBe("invalid-file-type");
    expect(validateImageFile({ type: "image/svg+xml", size: 10 })).toBe("invalid-file-type");
  });

  it("rejects files over the server limit", () => {
    expect(validateImageFile({ type: "image/png", size: MAX_NOTE_IMAGE_BYTES + 1 })).toBe("file-too-large");
    expect(validateImageFile({ type: "image/png", size: MAX_NOTE_IMAGE_BYTES })).toBeNull();
  });

  it("only accepts the same-origin delivery route", () => {
    expect(isNoteImageSrc(SRC)).toBe(true);
    expect(isNoteImageSrc("https://example.com/a.png")).toBe(false);
    expect(isNoteImageSrc("/api/note-image/x/y")).toBe(false);
    expect(isNoteImageSrc(null)).toBe(false);
  });
});

describe("imageInsertTarget", () => {
  it("goes after a filled paragraph and replaces an empty one", () => {
    const { editor: target } = make(failing);
    const doc = target.state.doc;
    const type = target.schema.nodes.image;
    expect(imageInsertTarget(doc, 2, type)).toEqual({ pos: doc.child(0).nodeSize, replaceEmpty: false });
    expect(imageInsertTarget(doc, doc.content.size - 1, type)).toEqual({ pos: doc.content.size, replaceEmpty: true });
  });
});

describe("uploading", () => {
  it("shows a placeholder while uploading, then an image node in place of the empty paragraph", async () => {
    let resolve!: (value: ActionResult<{ src: string }>) => void;
    const { editor: target } = make(() => new Promise((r) => (resolve = r)));
    target.commands.focus("end");

    requestImageUpload(target, [png()]);
    await flush();
    expect(placeholders(target)).toBe(1);
    expect(imageNodes(target)).toHaveLength(0);

    resolve({ success: true, data: { src: SRC } });
    await flush();
    expect(placeholders(target)).toBe(0);
    // The empty paragraph was replaced; StarterKit's trailing node adds a fresh one after the image.
    const content = target.getJSON().content ?? [];
    expect(content.map((node) => node.type)).toEqual(["paragraph", "image", "paragraph"]);
    expect(content[1].attrs).toEqual({ src: SRC, alt: null });
    expect(content[2].content).toBeUndefined();
  });

  it("removes the placeholder and reports the error when the upload fails", async () => {
    const { editor: target, onError } = make(() =>
      Promise.resolve({ success: false, error: "upload-failed" }),
    );
    const before = JSON.stringify(target.getJSON());
    requestImageUpload(target, [png()]);
    await flush();
    expect(placeholders(target)).toBe(0);
    expect(onError).toHaveBeenCalledWith("upload-failed");
    expect(JSON.stringify(target.getJSON())).toBe(before);
  });

  it("treats a thrown upload as upload-failed", async () => {
    const { editor: target, onError } = make(() => Promise.reject(new Error("network")));
    requestImageUpload(target, [png()]);
    await flush();
    expect(onError).toHaveBeenCalledWith("upload-failed");
    expect(placeholders(target)).toBe(0);
  });

  it("rejects an invalid file before uploading", async () => {
    const upload = vi.fn();
    const { editor: target, onError } = make(upload);
    requestImageUpload(target, [new File(["x"], "a.pdf", { type: "application/pdf" })]);
    await flush();
    expect(onError).toHaveBeenCalledWith("invalid-file-type");
    expect(upload).not.toHaveBeenCalled();
    expect(placeholders(target)).toBe(0);
  });

  it("never stores an upload result that is not a note-image route", async () => {
    const { editor: target, onError } = make(() =>
      Promise.resolve({ success: true, data: { src: "https://evil.example/x.png" } }),
    );
    requestImageUpload(target, [png()]);
    await flush();
    expect(imageNodes(target)).toHaveLength(0);
    expect(onError).toHaveBeenCalledWith("upload-failed");
  });

  it("keeps the placeholder in place when text is typed above it", async () => {
    let resolve!: (value: ActionResult<{ src: string }>) => void;
    const { editor: target } = make(() => new Promise((r) => (resolve = r)));
    requestImageUpload(target, [png()], 3);
    await flush();
    target.commands.insertContentAt(1, "Nieuw ");
    resolve({ success: true, data: { src: SRC } });
    await flush();
    expect(target.getJSON().content?.map((node) => node.type)).toEqual(["paragraph", "image", "paragraph"]);
  });
});

describe("image node", () => {
  it("loads a note image from stored JSON and keeps alt", () => {
    const { editor: target } = make(failing);
    target.commands.setContent({ type: "doc", content: [{ type: "image", attrs: { src: SRC, alt: "Fiets" } }] });
    expect(target.getJSON().content?.[0]).toEqual({ type: "image", attrs: { src: SRC, alt: "Fiets" } });
  });

  it("drops pasted HTML images that are not note images", () => {
    const { editor: target } = make(failing);
    target.commands.setContent(
      `<img src="https://example.com/a.png"><img src="data:image/png;base64,AAAA"><img src="${SRC}" alt="ok">`,
    );
    expect(imageNodes(target)).toEqual([{ type: "image", attrs: { src: SRC, alt: "ok" } }]);
  });
});

describe("slash item", () => {
  it("is appended to the list", () => {
    expect(SLASH_ITEMS.at(-1)?.id).toBe("image");
  });
});
