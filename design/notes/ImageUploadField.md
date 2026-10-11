# ImageUploadField
Figma: `Atom/Input-field` instance (component `3705:4386`, set `3705:4402`) · nodes `3968:11192` (desktop "Add recipi/Desktop") / `3953:9875` (mobile) · Code: `components/molecules/ImageUploadField.tsx`

## Anatomy
Not a distinct Figma component: a specific `Atom/Input-field` instance (`figma-map.json` lists it under `molecules_composed`). Props: `Leading-icon` `Image`, `Trekking-icon` `Plus`, Content "Selecteer afbeelding". Code layers a transparent, full-box `<input type="file">` (`z-10`, `accept` jpeg/png/webp) over an `aria-hidden`, `readOnly`, `tabIndex={-1}` `InputField` instance. The component only selects a `File` and hands it to the caller via `onFileSelect`; validation, re-encoding and the R2 upload live in `lib/recipes/thumbnail-validation.ts`, `thumbnail-processing.ts` and `thumbnails.ts` (server-only).

## Deliberate decisions
- A client molecule wrapping the atom, not a new atom or a `type="file"` branch on `InputField`: that atom's scope is text/textarea (#121).
- No visible label. Figma's bound Title reads "Personen" in both breakpoints (the instance was copied from the servings input and only `Content` was edited). Rendering it would be wrong and inventing a label is not ours to do, so the accessible name comes from the caller's `ariaLabel` on the real file input (`components.imageUploadField.selectImage`) (#121).
- The selected file's name replaces the placeholder in the same box. Figma samples only the empty state, so this is our own interpretation (#121).
- Native OS picker satisfies the ticket's "files or Photos app" ask: the image-only `accept` already makes iOS Safari and Android Chrome show Photo Library / Take Photo / Files. No custom dropdown exists in Figma, so none was built (#121).
- Hover/active/focus use `group-*`, not `peer-*`: the outer `relative` div is `group` and `InputField`'s `boxClassName` carries `group-hover:border-stroke-primary-hover group-active:border-stroke-primary-active group-focus-within:border-stroke-primary-selected`. The file input and `InputField` are siblings and the bordered box is a grandchild of the sibling, so `peer-*`'s sibling combinator can never reach it (tried, did not work); `group-*` compiles to a descendant selector that does (#166).

## Gotchas
- `group-focus-within`, not `group-focus`: the group is a `<div>`, never focusable itself. `group-active` works because `:active` bubbles to ancestors while the pointer is held on the transparent input.
- Keep the wrapper as the only unnamed `group` in this subtree; a nested `group` would hijack the variants.
- The transparent input is what the browser hit-tests, so the `InputField` box's own `:hover`/`:active` never fire; do not rely on them.

## Open
- `docs/open-questions.md#recipe-image-field-personen-label`
