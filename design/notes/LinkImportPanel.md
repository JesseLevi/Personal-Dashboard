# LinkImportPanel ("Via link")

- **Code:** `app/(app)/recepten/LinkImportPanel.tsx` (page-level composition of `SidePanel` + `InputField` + `Button`, not in `figma-map.json`)
- **Node IDs:** `4164:23722` desktop, `4164:23777` mobile pull-up

Built #318. Fetched: `Pull-up panel` (400 wide desktop, bound padding-lg, `surface/primary`), `Top` with the X Button, one `Input-field` "Link" (placeholder "Voeg een receptpagina toe"), `Bottom` with a full-width filled `Button` + `Icon/Save` "Opslaan" (grey because the field is empty). The Input-field instance in the frames still carries a stray chevron (a leftover of the Dropdown variant); not built.

Behaviour: zod `importUrlSchema` (https only, no credentials, max 2048) with an inline error under the field; Save closes the panel once `startRecipeImport` has inserted the row (the pipeline itself runs after the response). A server error (`rate-limited`, ...) shows inline instead. Reset-on-open like `CategoryPanel`.

Deviations: `SidePanel` places the X Button and fields about 24px higher than these frames (shared `SidePanel` geometry, see `SidePanel.md`, untouched). The visual gate baselines only the desktop shape (single fixed viewport); the mobile pull-up was checked by screenshot at 402px.
