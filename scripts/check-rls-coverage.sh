#!/usr/bin/env bash
# ADR-0009 completeness gate: every public table must have a two-user RLS test
# file at supabase/tests/rls-<table>.sql. Runs in CI after `supabase start`.
#
# ADR-0011 §6 adds a second pass: `reference` schema tables are shared,
# non-user data (see docs/decisions/0011-ingredient-library-and-reference-data.md)
# and are never covered by the per-table file check above (they carry no
# user_id to isolate between two test users). Instead this pass asserts,
# per reference table, the three structural properties that keep that
# schema safe to expose read-only: no user_id column, no client role holding
# more than select, and RLS enabled. This is schema introspection, not file
# presence -- the pgTAP tests for reference.* tables (#130) are a separate,
# explicit requirement and are not checked here.
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

# --- ADR-0011 §6: reference schema (shared, non-user data) ---
ref_tables=$(psql "$DB_URL" -Atc \
  "select tablename from pg_tables where schemaname = 'reference' order by 1")

for t in $ref_tables; do
  # 1. no user_id column -- user data must never land in a shared schema.
  has_user_id=$(psql "$DB_URL" -Atc \
    "select count(*) from information_schema.columns
     where table_schema = 'reference' and table_name = '$t' and column_name = 'user_id'")
  if [[ "$has_user_id" -ne 0 ]]; then
    echo "FAIL: reference.$t carries a user_id column (ADR-0011 §1 forbids this in the reference schema)." >&2
    missing=1
  fi

  # 2. authenticated/anon hold select and nothing else -- reference data
  # changes only through migrations, never a client write path.
  bad_priv=$(psql "$DB_URL" -Atc \
    "select count(*) from information_schema.role_table_grants
     where table_schema = 'reference' and table_name = '$t'
       and grantee in ('authenticated', 'anon')
       and privilege_type != 'SELECT'")
  if [[ "$bad_priv" -ne 0 ]]; then
    echo "FAIL: reference.$t grants authenticated/anon more than select (ADR-0011 §1: reference data changes only via migrations)." >&2
    missing=1
  fi

  # 3. RLS is enabled -- defence in depth even though the grants above
  # already block writes (a future mistaken grant must not silently open one).
  rls_on=$(psql "$DB_URL" -Atc \
    "select rowsecurity from pg_tables where schemaname = 'reference' and tablename = '$t'")
  if [[ "$rls_on" != "t" ]]; then
    echo "FAIL: reference.$t does not have row level security enabled (ADR-0011 §1/§6)." >&2
    missing=1
  fi
done

if [[ $missing -eq 1 ]]; then
  echo "FAIL: RLS coverage gate failed (ADR-0009 public table tests and/or ADR-0011 reference schema assertions). See messages above." >&2
  exit 1
fi
# wc -w, not wc -l: `echo "$tables"`/`echo "$ref_tables"` on an empty string
# still emits one (empty) line, so `wc -l` would report 1 instead of 0 when a
# schema has no tables. Table names never contain whitespace, so counting
# words matches the same splitting the `for t in $tables` loops above rely on.
echo "OK: all $(echo "$tables" | wc -w | tr -d ' ') public tables have RLS test files, and all $(echo "$ref_tables" | wc -w | tr -d ' ') reference tables pass the ADR-0011 structural checks."
