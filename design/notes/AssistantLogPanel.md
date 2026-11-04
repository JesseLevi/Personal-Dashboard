# AssistantLogPanel
Figma: none. Claude-designed (ADR-0034, ADR-0060 §5) · Code: `app/(app)/_components/AssistantLogPanel.tsx`

## Anatomy
Level-2 `SidePanel` opened from `AiSettingsPanel`'s "Assistent-logboek" button. Composed from `SidePanel`, `Tag`, `Button` and text, no new component or token. In order:
- `h3` title (also the panel's accessible name), an intro line (only you see it, content kept 90 days) and an export line.
- "Runs van de laatste 30 dagen": per day (a bold date plus the run count) a list of runs: time and path (opened Atlas / nightly check), the outcome as a sentence, and the funnel as one small line.
- "Wat de Assistent zag": one bordered row per trace, newest first:
  - `Tag`s for the status (Gevraagd `medium`, Gepauzeerd `neutral`) and the outcome (Nieuw `highlight`, Weggeklikt `neutral`, Geopend `low`, Niet gezegd `neutral`), the date, and "n× gezien" when it was seen more than once;
  - "Verstuurd" (or "Zou zijn verstuurd" while paused) with each item's title, fragment and a note for stale cards;
  - for asked traces, the answer: helpful or not, Haiku's raw message, why the cleaner dropped it, and the tokens.
- Loading, load-error and empty lines.
- Footer: one full-width filled `Download` Button "Exporteer voor analyse".

## Deliberate decisions
- Everything that came from a note, card or the model is a React text node: plain text, never HTML.
- The panel reads on every open through the server action `getAssistantLog` (RLS client, last 30 days of runs); traces are not limited by day. The outcome comes from `agent_signals.status` through the embedded relation; `skipped`, a missing signal and every paused trace read "Niet gezegd".
- The export is `window.location.assign("/api/assistant-log/export")`: the route answers with `Content-Disposition: attachment`, so the page stays. The route runs under the member's session and never uses `service_role`. Format: `docs/guides/assistant-tuning.md`.
- Dates use a fixed `Europe/Amsterdam` zone so server and browser group the same days.
- The panel is level 2 like `AiSettingsPanel` and is rendered after it, so it stacks on top at the same z-index. `AiSettingsPanel` passes `open={open && logOpen}` and resets the flag when it closes.
- Run and funnel wording lives in `components.assistantLogPanel.*`, one catalog string per outcome.

## Gotchas
- Never `key` or remount the `SidePanel` (see `SidePanel.md`).
- Ladle aliases `@/lib/assistant/log-actions` to `.ladle/mocks/assistant-log-actions.ts` (a fixed fixture, also exported for the stories). `initialLog` seeds the panel and skips the read; it is for stories only.
