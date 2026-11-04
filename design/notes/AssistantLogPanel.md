# AssistantLogPanel
Figma: none. Claude-designed (ADR-0034) · Code: `app/(app)/_components/AssistantLogPanel.tsx`

## Anatomy
Level-2 `SidePanel` opened from `AiSettingsPanel`'s "Assistent-logboek" button. Composed from `Button`, `Tag` and text, no new component or token. One `<section>` labelled by its `h3` (`settings.assistantLog.title`, also the panel's accessible name):
- Intro line (only visible to you, kept 90 days, wiped when switched off) and the "Exporteer voor analyse" `Button` (outline, `Download`) with a help line and an inline error.
- "Runs, laatste 30 dagen": one bordered block per day (Europe/Amsterdam), newest first. Per day: run count, a `Tag` per outcome with its count, one funnel sentence (verbanden, groepen, al bekend, niet vers genoeg, kandidaten, gevraagd, nuttig, afgekeurd) and token totals when Haiku was called.
- "Wat Haiku zag en antwoordde": one bordered block per trace, newest first. Status `Tag` (Gevraagd/Gepauzeerd), last seen and seen count, the sent titles and fragments, the answer (nuttig or niet, the cleaned message, the rejection reason, tokens) or "Niet gestuurd", and the outcome `Tag` (Nieuw, Weggeklikt, Geopend, Niet gezegd).

## Deliberate decisions
- Content is rendered as React text: titles, fragments and messages are never interpreted as markup.
- Data is read through the server action `loadAssistantLog` (RLS client) every time the panel opens. The layout does not load it, because most visits never open the panel. `initialLog` seeds stories and skips the read.
- The export is a `fetch` of `GET /api/assistant-log/export` (session cookie, RLS client) turned into a blob download, so a failure shows an inline error instead of saving an error body. Serializer: `lib/assistant/log-export.ts`.
- Outcome of a trace comes from the linked `agent_signals.status`: `new`, `dismissed` (Weggeklikt), `acted` (Geopend). `skipped`, no signal and every paused trace read "Niet gezegd".
- Opened from `AiSettingsPanel`, which owns `logOpen`. Both panels are level 2 and the log is later in the DOM, so it covers the AI panel; closing returns to it. The button only shows while the opt-in is on.

## Gotchas
- Never `key` or remount the `SidePanel` (see `SidePanel.md`).
- Ladle aliases `@/lib/assistant/log-actions` to `.ladle/mocks/assistant-log-actions.ts`; keep its export in step with the real module.
- The mobile and desktop shape are `SidePanel`'s own; the blocks stack in one column on both.
