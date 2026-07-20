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

if grep -rnE '#[0-9a-fA-F]{3,8}\b' components/ --include="*.tsx" 2>/dev/null; then
  echo "FAIL: raw hex color in components — use semantic tokens (ADR-0010)." >&2; fail=1
fi

if [[ $fail -eq 1 ]]; then exit 1; fi
echo "OK: server-only/content-safety/token greps clean."
