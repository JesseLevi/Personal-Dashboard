# ADR-0051: Assistant signals appear in the module where the decision is made

**Status**: Accepted (2026-11-01, user decision on the improvement brief, package 3: option a, nav item hidden). Amends ADR-0046 §9.

## Context

- ADR-0046 built rhythm and pattern signals with a read contract and no surface; the Sidebar item "Assistent" did nothing on click, and real members saw it.
- Weighed: signals inside the modules (Winkelmand, the Agenda plan drawer), a separate Assistent page or inbox, or only on a future "Vandaag" page.

## Decision

1. **`buy_rhythm` shows in Winkelmand**, above the open basket: the catalog sentence (ADR-0046 §1, payload + nl/en strings, never stored text), "Op de lijst" (adds the item to the basket on screen) and "Nee" (dismisses). At most 5, newest first.
2. **`cook_rhythm` shows in the Agenda plan drawer** as a group "Lang niet gekookt" above the recipes, while no search or category filter is set. Planning works as for any recipe (menu or drag).
3. **The act settles the signal, wherever it happens.** Adding an item whose name matches an open `buy_rhythm` (case and outer spaces ignored) to any basket, or planning a recipe with an open `cook_rhythm`, marks those signals `acted` (`lib/assistant/settle.ts`, through `set_agent_signal_status`, RLS client). So a suggestion also disappears when the member acts on it without using the suggestion. A failure here never fails the add or the plan.
4. **`pattern` signals have no surface yet**; they link across modules and wait for a "Vandaag" page.
5. **The Sidebar item "Assistent" is removed** until there is a page behind it.

## Consequences

- No schema change. `actOnAssistantSignal` stays for a future generic surface; the modules use their own actions plus §3.
- A rhythm signal for an item the member adds to a shared basket is settled for that member only (signals are per member under RLS).
