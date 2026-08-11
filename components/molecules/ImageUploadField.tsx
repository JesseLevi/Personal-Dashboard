"use client";

// figma: node-id=3968:11192 (desktop "Add recipi" panel) / 3953:9875 (mobile,
// identical instance) -- both are `Atom/Input-field` instances (already
// mapped, node-id=3705:4402), not a distinct Figma component: this file
// wraps that atom with real file-picking behaviour rather than duplicating
// its visual shell. Full record: design/notes/ImageUploadField.md.
import clsx from "clsx";
import { useState, type ChangeEvent } from "react";
import { InputField } from "../atoms/InputField";

const ACCEPTED_MIME_TYPES = "image/jpeg,image/png,image/webp";

export interface ImageUploadFieldProps {
  /** Associates an external `<label>`, if the caller renders one. */
  id: string;
  /** `<input name>` so a plain `<form>`/`FormData` submit carries the file. */
  name: string;
  /** Placeholder shown when no file is selected (Figma Content "Selecteer afbeelding" -- caller-translated, see messages/*.json `components.imageUploadField`). */
  placeholder: string;
  /** Accessible name for the file input (no visible label is rendered -- see design/notes/ImageUploadField.md). */
  ariaLabel: string;
  /** Pre-selected file's display name, e.g. when re-opening an edit form. */
  selectedFileName?: string | null;
  onFileSelect?: (file: File | null) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Selecteer-afbeelding field for the recipe add/edit flow: a real
 * `<input type="file">`, layered transparently over the `InputField` atom.
 * `accept` is image-only so mobile browsers already surface their native
 * "Photos/Files" chooser -- no custom dropdown was built (none in Figma).
 * #166: the outer wrapper is `group` and `InputField`'s `boxClassName`
 * carries `group-hover:`/`group-active:`/`group-focus-within:` variants --
 * see design/notes/ImageUploadField.md for why a `peer-*` attempt (same
 * ticket, same PR) did not work and `group-*` does.
 */
export function ImageUploadField({
  id,
  name,
  placeholder,
  ariaLabel,
  selectedFileName = null,
  onFileSelect,
  disabled,
  className,
}: ImageUploadFieldProps) {
  const [fileName, setFileName] = useState<string | null>(selectedFileName);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setFileName(file?.name ?? null);
    onFileSelect?.(file);
  }

  return (
    <div className={clsx("group relative", className)}>
      {/* `group` on this wrapper (not `peer` on the input): InputField's
          bordered box is a grandchild of this div, not a sibling of the file
          input, so `peer-*`'s sibling combinator can't reach it -- `group-*`'s
          descendant selector can, regardless of nesting depth. See
          design/notes/ImageUploadField.md. */}
      <input
        id={id}
        type="file"
        name={name}
        accept={ACCEPTED_MIME_TYPES}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={handleChange}
        className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
      />
      <InputField
        leadingIcon="Image"
        trailingIcon="Plus"
        value={fileName ?? ""}
        placeholder={placeholder}
        readOnly
        tabIndex={-1}
        aria-hidden="true"
        disabled={disabled}
        boxClassName="group-hover:border-stroke-primary-hover group-active:border-stroke-primary-active group-focus-within:border-stroke-primary-selected"
      />
    </div>
  );
}
