# ADR-0040: Agenda categories are calendars with a colour

**Status**: Accepted (user decision, 2026-10-18, #527).

## Context

- The user wants categories in the Agenda settings, each with its own colour in the grid. Today an own event has the same surface as the calendar frame (`surface-highlight-white`), and the coloured kinds (`surface-highlight-blue/green/yellow`) have no dark values, so they stay pastel at about 3:1 in dark mode.
- `calendars` is already the container of every event and meal plan (ADR-0037 §2), a user may already own several manual calendars, and sharing works per container (ADR-0035).
- Two models were weighed on 2026-10-18: a category as a calendar with a colour (Apple, Google), or a separate label on an event (Outlook). The user chose the calendar.
- New tokens need the user's consent (ADR-0034). The user agreed to a palette, defined in code only for now.

## Decision

1. **A category is a manual calendar.** There is no category table. The UI calls own manual calendars "categorieën" and imported ones "gekoppelde agenda's"; both get a colour.
2. **`calendars.color`**: `text not null`, checked against nine palette keys: `red`, `orange`, `amber`, `green`, `teal`, `blue`, `violet`, `pink`, `stone`. The default calendar starts `blue`, existing imported calendars `violet`; a new calendar gets the first colour not yet in use. Clients may update `color` (column grant), like `name`.
3. **The default calendar is named "Persoonlijk" / "Personal"** through its translation (`name` stays null). No other categories are seeded.
4. **Colour per item**:
   - an event, own or imported, takes its calendar's colour;
   - meals are `green`, planned cards `amber`, deadlines `red`. These are fixed in v1.
5. **Deleting a category moves its contents first.** One `security invoker` RPC moves the calendar's manual events, event series (ADR-0042) and meal plans to the owner's default calendar, then deletes it. The default calendar still cannot be deleted. Imported calendars still go with their account.
6. **Showing and hiding is per device**: a cookie holds the hidden calendar ids and hidden kinds (meals, planned cards, deadlines). The page filters loaded items; nothing is stored in the database.
7. **Palette tokens**: `event-<colour>-surface`, `event-<colour>-text` and `event-<colour>-accent` for the nine colours, each with a light and a dark value, in `design/tokens.json` with `figma: null` (the `overlay` precedent). Text on surface reaches at least 4.5:1 in both themes. Agenda items use these instead of `surface-highlight-*`; other components keep their tokens. Hover, active and selected on a coloured item still move the border.

## Consequences

- One migration: a column, its grant, a backfill and the delete RPC with a pgTAP test. `agenda_items()` is unchanged; `lib/agenda` maps the calendar colour onto the items.
- Sharing a calendar later shares exactly one category, for example "Gezin".
- An imported event cannot get its own colour; it follows its calendar. Labels across calendars would need a new ADR.
- The palette is not in Figma. Moving it there later means filling `figma` and `figmaVariableId` for 27 tokens.
