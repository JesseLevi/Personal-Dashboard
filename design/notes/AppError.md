# AppError

No Figma node — `app/(app)/error.tsx` is a route-group-level error boundary (Next.js `error.tsx` convention) catching anything a page/layout throws below `AppShellNav`. See the file's own header comment: no Figma error state exists for this; it reuses the same plain-text, no-toast convention already used for drag-persist/move failures elsewhere (`TeDoenBoard.tsx`, `ReceptenBoard.tsx`).

## #219

Both raw spacing utilities stay raw — flagged, not converted. There is no Figma node to measure a `boundVariables` entry against, so a token pick (`gap-4` = 16px could be `spacing/stack/stack-lg` or `spacing/component/padding-lg`; `gap-2` = 8px could be `spacing/inline/gap-sm`, `spacing/stack/stack-sm` or `spacing/component/padding-sm`) would be guessing from the number, not measuring — exactly what this ticket forbids.

- `error.tsx:18` (outer wrapper, `gap-4`)
- `error.tsx:19` (title block, `gap-2`)

No Figma frame node-id applies to either.
