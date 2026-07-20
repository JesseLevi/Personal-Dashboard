#!/usr/bin/env bash
# ADR-0009 completeness gate: every public table must have a two-user RLS test
# file at supabase/tests/rls-<table>.sql. Runs in CI after `supabase start`.
set -euo pipefail

DB_URL="${DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"

tables=$(psql "$DB_URL" -Atc \
  "select tablename from pg_tables where schemaname = 'public' order by 1")

missing=0
for t in $tables; do
  if [[ ! -f "supabase/tests/rls-${t}.sql" ]]; then
    echo "MISSING RLS TEST: supabase/tests/rls-${t}.sql (table: ${t})" >&2
    missing=1
  fi
done

if [[ $missing -eq 1 ]]; then
  echo "FAIL: tables without a two-user RLS test (ADR-0009). Copy the pattern in supabase/tests/rls-profiles.sql." >&2
  exit 1
fi
echo "OK: all $(echo "$tables" | wc -l | tr -d ' ') public tables have RLS test files."
