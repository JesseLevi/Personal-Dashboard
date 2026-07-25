#!/usr/bin/env bash
# ADR-0002/0003 guards, run in CI:
# 1. service_role usage may only exist in worker/ and scripts/ (never app/, components/, lib/ except lib/database.types.ts).
# 2. No NEXT_PUBLIC_ Supabase config — the browser never talks to Supabase.
# 3. No dangerouslySetInnerHTML on user/model content paths (§7).
# 4. No raw hex colors in components — tokens only (CLAUDE.md/ADR-0010).
set -euo pipefail
fail=0

if grep -rn "SERVICE_ROLE" app/ components/ lib/ 2>/dev/null | grep -v "lib/database.types.ts"; then
  echo "FAIL: service_role referenced outside worker/scripts (ADR-0002)." >&2; fail=1
fi

if grep -rn "NEXT_PUBLIC_SUPABASE" . --include="*.ts" --include="*.tsx" --include="*.env*" --exclude-dir=node_modules 2>/dev/null; then
  echo "FAIL: Supabase must not be exposed via NEXT_PUBLIC_ (ADR-0003)." >&2; fail=1
fi

if grep -rn "dangerouslySetInnerHTML" app/ components/ 2>/dev/null; then
  echo "FAIL: dangerouslySetInnerHTML is forbidden on this codebase (Architecture §7)." >&2; fail=1
fi

# Raw-hex guard. Candidates are `#`/`%23` + 3-8 hex digits, then filtered: a
# real hex colour either contains an a-f letter or is exactly 6/8 digits long.
# Without that filter every 3-digit ticket reference matches, since 0-9 are all
# valid hex digits — `(#101)` tripped this gate while check:comment-budget
# documents a bare `(#68)` pointer as the correct way to cite a ticket. Known
# and accepted hole: an all-decimal 3- or 4-digit hex (`#111`) still passes.
hex_hits=$(grep -rnoE '(#|%23)[0-9a-fA-F]{3,8}\b' components/ --include="*.tsx" 2>/dev/null \
  | awk -F: '{ tok = $NF; sub(/^(#|%23)/, "", tok);
               if (tok ~ /[a-fA-F]/ || length(tok) == 6 || length(tok) == 8) print }' || true)
if [[ -n "$hex_hits" ]]; then
  echo "$hex_hits"
  echo "FAIL: raw hex color in components — use semantic tokens (ADR-0010)." >&2; fail=1
fi

if [[ $fail -eq 1 ]]; then exit 1; fi
echo "OK: server-only/content-safety/token greps clean."
