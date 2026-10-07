-- #293 follow-up: Supabase's default privileges give anon (and authenticated)
-- direct table grants on every new table in public; 20261007000001 only added
-- explicit grants, it never revoked the defaults. Measured in CI on
-- 2026-10-07 (ci-db.yml run 37634701667): anon could `select` from
-- public.user_seeds and was only stopped by RLS (0 rows), not by the grant
-- (42501), failing rls-user_seeds.sql test 20. No data exposure, but it breaks
-- ADR-0009's "anon gets nothing" for this table.
--
-- authenticated keeps exactly the select it was meant to have: the markers are
-- written by apply_seed() (security definer) only.

revoke all on public.user_seeds from anon;
revoke insert, update, delete, truncate, references, trigger on public.user_seeds from authenticated;
