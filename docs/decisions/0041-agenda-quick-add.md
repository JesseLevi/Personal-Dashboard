# ADR-0041: Quick add in the Agenda, parsed deterministically

**Status**: Accepted (user decision, 2026-10-18, #527).

## Context

- The Agenda has no add button: you click or drag an empty slot, which opens a large side panel. The user wants a "+" that first asks for a title and a kind (appointment, meal, to-do) and works out the date from the text, as Apple Calendar's quick event does: "film op vrijdag met youri" becomes "Film" on the coming Friday.
- CLAUDE.md puts deterministic code before AI. Atlas must work without an AI key.

## Decision

1. **One creation surface.** "+ Nieuw" in the header (the `White` button, so it stands out from the `Filled` buttons), a square floating button bottom right below `lg`, the `N` key, and a click or drag on an empty slot all open the same quick-add popover (a bottom sheet below `lg`). A slot fills in its date and time. "Meer details" opens the existing event panel prefilled; that panel stays for details and for existing items.
2. **Three kinds**, detected from the text until the user picks one:
   - **Afspraak**: a manual event in the chosen category (ADR-0040), suggested from the category names and a keyword list;
   - **Maaltijd**: a meal plan. The recipe is picked in the popover; the moment comes from "ontbijt", "lunch", "diner" or "snack", default dinner;
   - **Te doen**: a new card in the favourite board's first column with `planned_for` set, or an existing open card.
3. **Parsing runs in the browser, without AI.** `chrono-node` (MIT) with the `nl` or `en` locale of the UI, `forwardDate: true` and the current time in the Agenda zone as reference. Own rules in `lib/agenda/quick-add.ts` add "met <namen>", "bij <plaats>", "in <Plaatsnaam>" (only before a capital), "20u", "'s avonds", the kind, the category and the recurrence phrases of ADR-0042 ("elke week", "om de week", "elke vrijdag", "maandelijks", "jaarlijks"). An AI fallback through `lib/ai` would need its own ticket.
4. **Defaults**: no time gives an all-day item; a start without an end lasts one hour; no date gives today, and the popover says so.
5. **People** are taken out of the title and stored in the description as "Met Youri, Sanne". Linking them to Atlas members waits for calendar sharing.
6. **The user sees what was recognised** (highlighted in the text) and can change every parsed value before saving. Server actions validate with zod as for any other input.

## Consequences

- A new client dependency, loaded on the Agenda only. Its Dutch coverage is partial; a unit-test list of Dutch phrases guards the own rules.
- Three entry points share one component, so a slot click no longer jumps straight into the big panel.
- Free text stays on the device until saved; nothing goes to a provider.
