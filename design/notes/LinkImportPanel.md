# LinkImportPanel ("Via link")
Figma: `Add recipi dropdown 02/Desktop` node `4164:23722` (mobile pull-up `4164:23777`) · Code: `app/(app)/recepten/LinkImportPanel.tsx` (page-level composition of `SidePanel` + `InputField` + `Button`, not in `figma-map.json`)

## Anatomy
`SidePanel` (400px desktop, pull-up on mobile) with one `Link` `InputField` (placeholder "Voeg een receptpagina toe") and a footer filled `Button` + `Save` icon "Opslaan" (disabled while the field is empty).

## Deliberate decisions
- Validation uses the shared zod `importUrlSchema` (`lib/recipes/import/url.ts`: https only, no credentials, max 2048) with an inline error under the field; a server error (`rate-limited`, ...) replaces it inline (#318).
- Save closes the panel as soon as `startRecipeImport` has inserted the `importing` row; the pipeline runs after the response. The action is a prop so Ladle can mock it (#318).
- Reset-on-open, same pattern as `CategoryPanel` (#318).

## Token gaps and flags
- The `Input-field` instance in the Figma frames carries a stray chevron (a leftover of the Dropdown variant); deliberately not built.
- `SidePanel` places the X Button and fields about 24px higher than these frames. That is shared `SidePanel` geometry (`design/notes/SidePanel.md`), left untouched.

## Gotchas
- The visual gate baselines only the desktop shape (single fixed viewport); the mobile pull-up was checked by screenshot at 402px.
- The story wraps the panel in `min-h-screen` because the panel is `position: fixed`; without it the screenshot crop collapses.
