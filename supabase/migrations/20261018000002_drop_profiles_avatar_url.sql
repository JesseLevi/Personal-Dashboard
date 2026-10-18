-- #513: drops the unused profiles.avatar_url (#265). Avatars live in
-- profiles.avatar_path since #434 (live on hosted since 2026-10-14), and
-- member_profiles / search_members / pending_share_invites derive has_avatar
-- from avatar_path (20261012000003). No function, view or policy reads
-- avatar_url any more.
--
-- DESTRUCTIVE: the column and its data are lost. Apply to hosted only after
-- the user's explicit go (ADR-0032).

alter table public.profiles
  drop column avatar_url;
