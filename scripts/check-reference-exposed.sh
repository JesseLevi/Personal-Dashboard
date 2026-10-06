#!/usr/bin/env bash
# #291: read-only check that the hosted Data API exposes the `reference` schema.
# Needs SUPABASE_URL + SUPABASE_ANON_KEY (from .env). Exit 0 unless PGRST106
# (schema not exposed); exit 2 on missing env/unreachable host.
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ -f .env ]]; then set -a; . ./.env; set +a; fi
: "${SUPABASE_URL:?SUPABASE_URL missing}" "${SUPABASE_ANON_KEY:?SUPABASE_ANON_KEY missing}"

base="${SUPABASE_URL%/}"; base="${base%/rest/v1}"  # .env may hold the /rest/v1/ form
body=$(mktemp); trap 'rm -f "$body"' EXIT
status=$(curl -sS -o "$body" -w '%{http_code}' \
  "$base/rest/v1/ingredients?select=*&limit=1" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Accept-Profile: reference") || { echo "unreachable" >&2; exit 2; }

echo "HTTP $status"
head -c 300 "$body"; echo
if grep -q PGRST106 "$body"; then
  echo "FAIL: schema 'reference' is not exposed on the Data API." >&2
  exit 1
fi
echo "OK: 'reference' is exposed (any non-PGRST106 response)."
