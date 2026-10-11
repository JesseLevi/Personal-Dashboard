#!/usr/bin/env bash
# SHELVED (ADR-0018): the Mac mini this guards is not being built; nothing runs
# this script. Kept until someone decides to delete it.
#
# Architecture §7: Supabase's Docker publishes on 0.0.0.0 by default; on the
# Mac mini every published port must be bound to 127.0.0.1, and Ollama must
# run with OLLAMA_HOST=127.0.0.1. Run this ON THE SERVER after any
# compose/Ollama change (it is also wired into the deploy workflow).
set -euo pipefail
fail=0

echo "== listeners on non-loopback addresses (expect ONLY cloudflared) =="
# -i4/-i6 TCP LISTEN not bound to loopback
if command -v lsof >/dev/null; then
  suspicious=$(lsof -nP -iTCP -sTCP:LISTEN 2>/dev/null | awk '$9 !~ /^(127\.0\.0\.1|\[::1\])/ && NR>1 {print}' || true)
  if [[ -n "$suspicious" ]]; then
    echo "$suspicious"
    echo "Review the above: anything other than cloudflared listening on 0.0.0.0/LAN is a §7 violation." >&2
    fail=1
  else
    echo "OK: nothing listens outside loopback."
  fi
else
  echo "lsof not available; run on the server." >&2; exit 2
fi

if command -v docker >/dev/null; then
  echo "== docker port bindings not on 127.0.0.1 =="
  bad=$(docker ps --format '{{.Names}}\t{{.Ports}}' | grep -E '0\.0\.0\.0|:::' || true)
  if [[ -n "$bad" ]]; then echo "$bad"; echo "FAIL: rebind these to 127.0.0.1 in compose." >&2; fail=1
  else echo "OK: all docker ports loopback-bound."; fi
fi

exit $fail
