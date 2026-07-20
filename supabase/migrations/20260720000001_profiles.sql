-- Phase 1 groundwork: profiles + the reusable updated_at trigger.
-- Conventions per Architecture §4.1 / ADR-0001 / ADR-0009.

-- Reusable updated_at trigger function (every table with updated_at uses this).
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  locale text not null default 'nl' check (locale in ('nl', 'en')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'One row per auth user. Ownership column is id (= auth.users.id) — the one deliberate exception to the user_id naming convention (Architecture §4.2).';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

create policy profiles_select_own on public.profiles
  for select using (id = (select auth.uid()));
create policy profiles_insert_own on public.profiles
  for insert with check (id = (select auth.uid()));
create policy profiles_update_own on public.profiles
  for update using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy profiles_delete_own on public.profiles
  for delete using (id = (select auth.uid()));

-- Auto-create a profile on signup.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
