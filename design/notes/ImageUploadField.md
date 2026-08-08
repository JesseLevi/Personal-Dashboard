# ImageUploadField

- **Code:** `components/molecules/ImageUploadField.tsx`
- **Node ID:** `3968:11192` (desktop, "Add recipi/Desktop" #3717:2493) / `3953:9875` (mobile, "Add recipi/Mobile" #3717:2844) — both are the same `Atom/Input-field` instance (component `3705:4386`, set `3705:4402`, already mapped as `Atom/Input-field`), not a separate Figma component. `figma-map.json`'s `molecules_composed` section (not `molecules`) reflects that: there is no distinct componentId to point at, only a specific instance's props.

Built #121 (`recipe-thumbnails` storage ticket). Instance properties fetched from both breakpoints: `Leading-icon: true` (`Icon/Image`, confirmed by rendering the candidate lucide `Image` export and comparing its path against the Figma glyph — rounded square, circle "sun", mountain triangle — before adding it to `Icon.tsx`'s union), `Trekking-icon: true` (`Icon/Plus`, already mapped), `Content: "Selecteer afbeelding"`, `Title: true`, `Field: "Personen"`.

## DEVIATION flagged — the bound Title text is wrong, not rendered

The `Field` property driving the visible Title text is `"Personen"` in **both** breakpoints — not a locale/translation issue, the instance was duplicated from the adjacent "Personen" (servings) input and its `Content` was edited to `"Selecteer afbeelding"` without also fixing `Field`. Rendering "Personen" above an image picker would be actively wrong, not merely undesigned, so this component renders **no visible label at all** rather than either (a) trusting the broken bound text or (b) inventing a replacement label Figma never specified — both would violate "never silently redesign". The accessible name instead comes from `ariaLabel` on the real `<input type="file">` (caller-supplied, `components.imageUploadField.selectImage` in both catalogs). Flagged in `docs/open-questions.md#recipe-image-field-personen-label` for a real label from design.

## No "file selected" state modeled

The fetched node only samples one static state (empty, placeholder text visible). Showing the selected file's name in the same box in place of the placeholder is this component's own interpretation — same "omit/replace the unmodeled state" treatment `CardContentRecipe.md` already applies to its `imageUrl`/`duration` props, not a guess dressed up as a Figma fact.

## Why a client molecule wrapping the atom, not a new atom

`Atom/Input-field` (`InputField.tsx`) mostly stays untouched — a Server Component, `<input type="text">`. A file picker needs a real `<input type="file">`, which `InputField` doesn't support and shouldn't grow a `type="file"` branch for (its whole scope elsewhere is text/textarea). `ImageUploadField` layers a transparent, full-box `<input type="file">` over an `aria-hidden`, `readOnly`, `tabIndex={-1}` `InputField` instance instead of reimplementing the visual shell.

## TICKET #166 (2026-08-08) — hover/active/focus states were never actually reaching the box

**Corrects this note's own prior claim.** The line just above used to say `InputField`'s `hover:`/`active:`/`focus-within:` CSS "keeps working unmodified because the real focusable element ... sits inside the same box." That was never verified and is wrong: the file input and `InputField` are **siblings** under the outer `relative` div (`InputField` renders its own separate subtree), not ancestor/descendant — so `:focus-within` on `InputField`'s bordered box cannot see a sibling's focus, and `:hover`/`:active` on that box never fire either, since the transparent file input (`z-10`) is the element the browser hit-tests, not the box beneath it. The ticket's bug report ("geef afbeelding input field zelfde hover/active/focus states als text input field") is exactly this — confirmed by reasoning about the DOM structure, not by re-fetching Figma (no new geometry involved, this is a CSS-selector bug in existing code).

**Fix: `InputField` gained an opt-in `boxClassName` prop** (merged onto the bordered box alongside its own hardcoded state classes — see `InputField.tsx`'s own doc comment), and this component now marks the real file input `peer` and renders it BEFORE `InputField` in the JSX (peer/general-sibling-combinator requires that DOM order; z-index still controls visual stacking independently). `boxClassName="peer-hover:border-border-hover peer-active:border-border-input-active peer-focus:border-border-selected"` reuses the exact same tokens `InputField`'s own dead `hover:`/`active:`/`focus-within:` classes already declare — both class sets coexist harmlessly (identical property+value, different trigger), so nothing in `InputField`'s default behaviour changed for any other caller (every other `InputField` in the app leaves `boxClassName` unset). No new token; `peer-focus` (not `peer-focus-within`) is correct here since the peer itself is the single focusable element, not a container.

## Native OS picker satisfies the ticket's "Photos/Files" ask

The ticket text: "if possible, input an image from files or the Apple/Google Photos app on phone; if that's more convenient, use a dropdown first to choose between files or the Apple/Google Photos app." `accept="image/jpeg,image/png,image/webp"` on a real `<input type="file">` already makes iOS Safari and Android Chrome present their native Photo Library / Take Photo / Files chooser — no custom dropdown exists in the fetched node for this control, and Figma shows no such UI, so none was built. This is the "if possible" branch of the ticket resolved by platform behaviour, not the fallback dropdown.

## Upload/signing logic lives elsewhere

Validation, EXIF-stripping and the actual storage upload/signed-URL calls are `lib/recipes/thumbnail-validation.ts` (pure, tested in `tests/recipes-thumbnails.test.ts`) and `lib/recipes/thumbnails.ts` (`server-only`) — this component only selects a `File` and hands it to the caller via `onFileSelect`; it does not call the upload action itself, so it stays reusable from any future form (`#126`'s add-recipe flow is the first expected caller, not built by this ticket).
