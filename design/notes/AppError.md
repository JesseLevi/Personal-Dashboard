# AppError
No Figma node (Claude-designed on request, #170) · Code: `app/(app)/error.tsx`

## Anatomy
Route-group `error.tsx` boundary: title (`text-xl font-semibold`), body in `text-priority-urgent`, outline `Button` calling `reset`. It catches anything a page or layout throws below `AppShellNav`, so the sidebar shell stays mounted.

## Deliberate decisions
- Plain text plus a retry button, no toast. It reuses the convention of the drag-persist/move failures in `TeDoenBoard.tsx` and `ReceptenBoard.tsx` instead of inventing a new look (#170).

## Token gaps and flags
- `gap-4` (outer wrapper, 16px) and `gap-2` (title block, 8px) stay raw and flagged in `error.tsx`. There is no Figma node to read a `boundVariables` entry from, and picking a token from the number alone is forbidden (`gap-4` could be `spacing/stack/stack-lg` or `spacing/component/padding-lg`, `gap-2` could be `spacing/inline/gap-sm`, `spacing/stack/stack-sm` or `spacing/component/padding-sm`) (#219)
