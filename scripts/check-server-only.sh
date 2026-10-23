#!/usr/bin/env bash
# ADR-0002/0003 guards, run in CI:
# 1. service_role usage may only exist in scripts/ (never app/, components/, lib/ except lib/database.types.ts
#    and lib/supabase/service.ts, which only app/api/cron/ may import: ADR-0039 §4).
# 2. No NEXT_PUBLIC_ Supabase config — the browser never talks to Supabase.
# 3. No dangerouslySetInnerHTML on user/model content paths (§7).
# 4. No raw hex colors in components — tokens only (CLAUDE.md/ADR-0010).
# 5. R2_* env vars and the S3 client (aws4fetch, @aws-sdk) only under lib/storage/ (ADR-0024 §2).
#    scripts/, tests/, docs/ and .env.example are not scanned.
# 6. CLOUDFLARE_* env and the Workers AI endpoint only in lib/ai/cloudflare.ts (ADR-0043 §1).
# Optional $1 = repo root to scan (used by tests/storage.test.ts).
set -euo pipefail
cd "${1:-.}"
fail=0

if grep -rn "SERVICE_ROLE" app/ components/ lib/ 2>/dev/null | grep -v "lib/database.types.ts" | grep -v "^lib/supabase/service.ts:"; then
  echo "FAIL: service_role referenced outside scripts and lib/supabase/service.ts (ADR-0002, ADR-0039)." >&2; fail=1
fi

# ADR-0039 §4: the service client is for the cron route only, never a user path.
if grep -rln "supabase/service" app/ components/ lib/ 2>/dev/null | grep -v "^app/api/cron/" | grep -v "^lib/supabase/service.ts$"; then
  echo "FAIL: lib/supabase/service is imported outside app/api/cron (ADR-0039 §4)." >&2; fail=1
fi

if grep -rn "NEXT_PUBLIC_SUPABASE" . --include="*.ts" --include="*.tsx" --include="*.env*" --exclude-dir=node_modules 2>/dev/null; then
  echo "FAIL: Supabase must not be exposed via NEXT_PUBLIC_ (ADR-0003)." >&2; fail=1
fi

if grep -rn "dangerouslySetInnerHTML" app/ components/ 2>/dev/null; then
  echo "FAIL: dangerouslySetInnerHTML is forbidden on this codebase (Architecture §7)." >&2; fail=1
fi

r2_scan=(); for p in app components lib middleware.ts; do [[ -e "$p" ]] && r2_scan+=("$p"); done
if [[ ${#r2_scan[@]} -gt 0 ]] && grep -rnE '\bR2_[A-Z]|aws4fetch|@aws-sdk' "${r2_scan[@]}" 2>/dev/null \
  | grep -v '^lib/storage/'; then
  echo "FAIL: R2_* env or S3 client referenced outside lib/storage/ (ADR-0024 §2)." >&2; fail=1
fi

cf_scan=(); for p in app components lib middleware.ts; do [[ -e "$p" ]] && cf_scan+=("$p"); done
if [[ ${#cf_scan[@]} -gt 0 ]] && grep -rnE 'CLOUDFLARE_[A-Z]|api\.cloudflare\.com' "${cf_scan[@]}" 2>/dev/null \
  | grep -v '^lib/ai/cloudflare.ts:'; then
  echo "FAIL: CLOUDFLARE_* env or Workers AI endpoint referenced outside lib/ai/cloudflare.ts (ADR-0043)." >&2; fail=1
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
