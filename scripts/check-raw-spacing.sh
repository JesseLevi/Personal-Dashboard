#!/usr/bin/env bash
# Raw radius/spacing-utility guard for components/ (#218, docs/guides/ui-components.md).
#
# Same shape as scripts/check-server-only.sh's hex guard: grep-style
# candidate search, filtered, loud FAIL. Catches raw Tailwind
# rounded-{sm,md,lg,xl,2xl,3xl}/gap-N/space-{x,y}-N/p{,x,y,l,r,t,b}-N
# utilities in component code that should either read a semantic token or
# carry an explicit, grepable exception naming its reason and its
# design/notes file — the same escape-hatch shape as design/tokens.json's
# `$notMirrored` (#213), extended from colour to radius/spacing.
#
# A hit only counts against actual utility USAGE (a real class string), not
# a comment/JSDoc line that merely mentions the utility name in prose — those
# are filtered the same way scripts/check-comment-budget.sh already
# classifies comment lines (so this script and that one agree on what counts
# as "comment").
#
# Flag form — a comment naming BOTH the marker and the note file, anywhere
# in the contiguous comment block directly above the flagged line (a JSX
# attribute list allows a bare `//` comment between attributes; a JSX
# children position needs `{/* ... */}` — both already used elsewhere in
# this codebase):
#
#   // spacing-flag: <short reason> — design/notes/<Component>.md
#
# `*.stories.tsx` is out of scope (demo scaffolding, no Figma node, #218).
# `app/` is out of scope for #218 (its own ticket covers it) — ROOTS below
# is the only line to touch to bring it in later, no other rewrite needed.
set -euo pipefail

ROOTS=(components)

# Candidate utility regex, extended-ERE, with hand-rolled word boundaries
# (awk's ERE has no \b): the char before/after the match must not be an
# identifier/dash character, so `gap-inline-sm`, `px-component-sm`, etc.
# (already-tokenized classes) never match.
UTIL_RE='(^|[^a-zA-Z0-9_-])(rounded-(sm|md|lg|xl|2xl|3xl)|gap-[0-9]+|space-(x|y)-[0-9]+|p[xyltrb]?-[0-9]+)([^a-zA-Z0-9_-]|$)'

files=""
for root in "${ROOTS[@]}"; do
  [[ -d "$root" ]] || continue
  while IFS= read -r f; do
    files="$files$f"$'\n'
  done < <(find "$root" -type f -name "*.tsx" ! -name "*.stories.tsx")
done

fail=0
while IFS= read -r file; do
  [[ -z "$file" ]] && continue
  awk -v f="$file" -v utilre="$UTIL_RE" '
    {
      raw[NR] = $0
      line = $0
      sub(/^[ \t]*/, "", line)
      stripped[NR] = line
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
      iscomment[NR] = isc
      n = NR
    }
    END {
      for (i = 1; i <= n; i++) {
        if (iscomment[i]) continue
        if (raw[i] !~ utilre) continue
        sawmarker = 0; sawpointer = 0
        j = i - 1
        while (j >= 1 && iscomment[j]) {
          if (stripped[j] ~ /spacing-flag:/) sawmarker = 1
          if (stripped[j] ~ /design\/notes\//) sawpointer = 1
          j--
        }
        if (!(sawmarker && sawpointer)) {
          printf "FAIL: %s:%d: %s\n", f, i, stripped[i]
          bad = 1
        }
      }
      exit bad
    }
  ' "$file" || fail=1
done <<< "$files"

if [[ $fail -eq 1 ]]; then
  echo "" >&2
  echo "FAIL: raw radius/spacing utility in components/ with no semantic token and no spacing-flag (ADR-0010, #218)." >&2
  echo "Use a token, or flag it: // spacing-flag: <reason> -- design/notes/<Component>.md" >&2
  exit 1
fi
echo "OK: no unflagged raw radius/spacing utilities in components/."
