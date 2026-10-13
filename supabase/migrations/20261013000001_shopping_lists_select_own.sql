-- Creating a basket failed with 42501: insert ... returning checks the new row
-- against the SELECT policy, and private.shopping_list_role() is stable, so it
-- reads the statement's snapshot and does not see the row being inserted.
-- An owner policy on user_id sees the new row directly; the member policy
-- stays for editors (policies are OR'ed).
--
-- Not applied to hosted by merging: needs the user's explicit go (ADR-0032).

create policy shopping_lists_select_own on public.shopping_lists
  for select to authenticated
  using (user_id = (select auth.uid()));
