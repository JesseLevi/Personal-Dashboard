-- service_role bypasses RLS but still needs table-level GRANTs (missed in
-- 20260723000001_kanban_schema.sql, which only granted authenticated/anon).
-- Server code and the worker connect as service_role (ADR-0002/0003).

grant select, insert, update, delete on public.boards to service_role;
grant select, insert, update, delete on public.board_columns to service_role;
grant select, insert, update, delete on public.cards to service_role;
grant select, insert, update, delete on public.labels to service_role;
grant select, insert, update, delete on public.card_labels to service_role;
