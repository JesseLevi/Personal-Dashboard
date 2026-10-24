-- Defence in depth: the app never reads the `reference` schema as anon (every
-- read goes through an authenticated session), so anon loses the schema USAGE
-- and table SELECT that 20260730000001 and 20261010000001 granted. Mirrors those
-- grants exactly; authenticated and service_role are untouched.
revoke select on reference.ingredients from anon;
revoke select on reference.ingredient_unit_masses from anon;
revoke select on reference.ingredient_aliases from anon;
revoke usage on schema reference from anon;

-- Nothing created later in `reference` becomes reachable for anon by default.
alter default privileges in schema reference revoke all on tables from anon;
