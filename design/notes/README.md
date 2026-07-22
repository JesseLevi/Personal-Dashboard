# Design notes

`design/figma-map.json` is the machine lookup — Figma component name, code
path, and node-id only (ADR-0010). It stays small on purpose: every component
ticket edits it.

This directory is the per-component design record: the discrepancy log,
flagged token gaps, verified pixel measurements, and ticket-by-ticket
change history that used to live in `figma-map.json`'s `notes` field. One
file per component, named after its code file
(`design/notes/<ComponentFile>.md`, e.g. `design/notes/Sidebar.md` for
`components/organisms/Sidebar.tsx`), each headed with the component's Figma
name, code path, and node-id.

The split matters for parallel work: a component PR touches only its own
note file, so agents building different components never conflict on this
record the way every ticket used to conflict on the single JSON file.

Note text is a faithful copy of the original changelog entries — preserved
verbatim, not summarised. Some entries record raw hex values; that's fine
here (`design/` is not covered by `check:server-only`'s raw-hex grep, which
only scans `components/`) but raw hex must never be copied from these notes
into a component file.
