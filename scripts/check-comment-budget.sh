#!/usr/bin/env bash
# Comment-budget guard for components/ (docs/guides/ui-components.md,
# "Comments in component source").
#
# The per-component design record — discrepancies, token gaps, measurements,
# ticket-by-ticket history — lives in design/notes/<Component>.md, which is the
# one home for those facts. Component source repeatedly grew a second, verbatim
# copy of that record (Button.tsx once reached 262 comment lines against 72 of
# code). This gate keeps the duplication from coming back:
#
# 1. No file in components/ may be more than MAX_RATIO% comment lines.
# 2. No single comment block may exceed MAX_BLOCK lines.
# 3. No ticket narration in component source. A bare pointer — "(#68)",
#    "see design/notes/Button.md" — is fine; retelling what ticket N changed
#    is not, that belongs in the note file.
set -euo pipefail

MAX_RATIO=30
MAX_BLOCK=15

fail=0
while IFS= read -r file; do
  awk -v f="$file" -v maxratio="$MAX_RATIO" -v maxblock="$MAX_BLOCK" '
    function flush() {
      if (block > maxblock)
        printf "FAIL: %s:%d — comment block of %d lines (max %d).\n", f, blockstart, block, maxblock > "/dev/stderr"
      if (block > maxblock) bad = 1
      block = 0
    }
    {
      total++
      line = $0
      sub(/^[ \t]*/, "", line)
      isc = 0
      if (inblock) {
        isc = 1
        if (line ~ /\*\//) inblock = 0
      } else if (line ~ /^(\{\/\*|\/\*)/) {
        isc = 1
        if (line !~ /\*\//) inblock = 1
      } else if (line ~ /^\/\//) {
        isc = 1
      }
      if (isc) {
        comments++
        if (block == 0) blockstart = NR
        block++
        if (tolower(line) ~ /ticket[s]?[ ]*#?[0-9]/) {
          printf "FAIL: %s:%d — ticket narration in component source; record it in design/notes/ and leave a pointer.\n", f, NR > "/dev/stderr"
          bad = 1
        }
      } else {
        flush()
      }
    }
    END {
      flush()
      # The ratio rule needs an absolute floor. A small component that is
      # honestly documented — 8-line header plus a JSDoc line per prop — is
      # 40% comment and entirely correct; percentage alone would punish it.
      # Oversized headers are already caught by the per-block rule, so the
      # ratio only has to catch files with real comment mass.
      if (total > 0 && comments > 25) {
        ratio = int(comments * 100 / total)
        if (ratio > maxratio) {
          printf "FAIL: %s — %d%% comment lines (%d/%d, max %d%%).\n", f, ratio, comments, total, maxratio > "/dev/stderr"
          bad = 1
        }
      }
      exit bad
    }
  ' "$file" || fail=1
done < <(find components -name "*.tsx" | sort)

if [[ $fail -eq 1 ]]; then
  echo "" >&2
  echo "See docs/guides/ui-components.md, 'Comments in component source'." >&2
  exit 1
fi
echo "OK: component comment budget within limits."
