#!/usr/bin/env bash
# Doc-size guard for docs/HANDOFF.md and docs/guides/*.md (#295).
#
# HANDOFF.md once grew to 55 KB despite the "one screen" rule in CLAUDE.md;
# only a gate keeps it small. Guides get a per-file byte budget (~25% headroom
# over their size after #278). A guide with NO entry below fails the gate, so
# a new guide forces a deliberate budget decision here.
#
# Optional $1 = repo root (default: cwd) — used by tests/check-doc-budget.test.ts.
set -euo pipefail

root="${1:-.}"

HANDOFF_BUDGET=6144

# One obvious home for the guide budgets (bytes). Raise deliberately, in review.
guide_budget() {
  case "$1" in
    data-layer.md)      echo 8400 ;;
    ticket-workflow.md) echo 4400 ;;
    ui-components.md)   echo 12800 ;;
    *)                  echo "" ;;
  esac
}

fail=0
size() { wc -c < "$1" | tr -d ' '; }

handoff="$root/docs/HANDOFF.md"
if [[ -f "$handoff" ]]; then
  s=$(size "$handoff")
  if (( s > HANDOFF_BUDGET )); then
    echo "FAIL: docs/HANDOFF.md — $s bytes, budget $HANDOFF_BUDGET. Replace stale bullets, don't append." >&2
    fail=1
  fi
fi

for f in "$root"/docs/guides/*.md; do
  [[ -e "$f" ]] || continue
  name=$(basename "$f")
  b=$(guide_budget "$name")
  if [[ -z "$b" ]]; then
    echo "FAIL: docs/guides/$name — no budget entry in scripts/check-doc-budget.sh; add one deliberately." >&2
    fail=1
    continue
  fi
  s=$(size "$f")
  if (( s > b )); then
    echo "FAIL: docs/guides/$name — $s bytes, budget $b. Trim it (one home per fact) or raise the budget deliberately." >&2
    fail=1
  fi
done

if [[ $fail -eq 1 ]]; then
  exit 1
fi
echo "OK: HANDOFF and guides within size budgets."
