# AiSettingsPanel
Figma: none. Claude-designed (ADR-0034) · Code: `app/(app)/_components/AiSettingsPanel.tsx`

## Anatomy
Level-2 `SidePanel` opened from `SettingsPanel`'s "Verbanden en slim zoeken" button. Page-level composition from the `Checkbox` atom and text, no new component or token. One `<section>` labelled by its `h3` (`components.settingsPanel.ai.title`, also the panel's accessible name):
- A "Nog niet beschikbaar" line, only when the AI provider is not configured.
- `Checkbox` with the label "Verbanden, slim zoeken en de Assistent gebruiken". Disabled (and shown unchecked) when unavailable, and while a save is pending.
- A second `Checkbox` under the opt-in, "Assistent zoekt patronen", with one help line. Disabled (shown as is) while the opt-in is off or a save is pending.
- Four explanation lines: what is sent, who receives it, the log (only visible to you, kept 90 days, wiped when switched off), what turning it off does.
- A `Button` (white, `ArrowRight`) "Assistent-logboek" opening `AssistantLogPanel`; shown only while the opt-in is on. `logOpen` lives here and resets when this panel closes.
- Inline error `<p>` (`text-priority-urgent`) from `profile.errors.*`.
- Footer: none, except `DeleteConfirm` (stacked) while turning off is being confirmed.

## Deliberate decisions
- The opt-in saves immediately through `setAiEnabled` (ADR-0043 §2): it is a consent, not a form field, so it never waits for the base panel's Opslaan. Turning on is immediate; the checkbox only flips after the action succeeded.
- The pattern pause saves immediately through `setAssistantPatternsEnabled` (ADR-0060 §1), flips only after success and asks nothing: it deletes nothing. `patternsEnabled` is `getAssistantPatternsEnabled` (true on error, the column default).
- Turning off asks first, in the footer, because it deletes the index and the Assistant's pattern notices (the notes stay). The panel owns that state (`useDeleteConfirm`) and cancels it whenever the panel closes.
- `aiAvailable` is `isEmbeddingConfigured()` and `aiEnabled` is `getAiEnabled` (error-swallowing), both resolved in the layout. `pendingAi` re-syncs via `useEffect` when `aiEnabled` changes.
- No footer when there is nothing to confirm; `SidePanel` then draws no footer strip.

## Gotchas
- Never `key` or remount the `SidePanel` (see `SidePanel.md`).
- `SettingsPanel` passes `open={open && aiOpen}`, so closing the base panel closes this one.
- Ladle aliases `@/lib/profile/actions` to `.ladle/mocks/profile-actions.ts`; keep its exports in step with the real module.
