# Design notes

One file per component, named after its code file (`design/notes/Sidebar.md` for `components/organisms/Sidebar.tsx`). A note is the component's **contract**, the things someone changing it must know so they don't undo a deliberate decision:

- header: source (Figma node, or "Claude-designed (#NNN)") and code path
- **Anatomy**: composition, and how variant axes map to props, slots and CSS states
- **Deliberate decisions**: departures from Figma or from the obvious approach, with why
- **Token gaps and flags**: every `spacing-flag`/`GAP` the code points to
- **Gotchas**: a11y, interaction, browser and test traps
- **Open**: `docs/open-questions.md#<slug>` links

Keep it at about 5 KB or less. When a component changes, rewrite the affected bullets instead of appending; history lives in git and the PRs. Raw hex is allowed here (the gate only scans `components/`), but never copy it into a component. `design/figma-map.json` stays the machine lookup for Figma-sourced components (name, path, node-id only).
