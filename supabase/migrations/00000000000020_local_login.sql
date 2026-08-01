-- =====================================================================
-- Migration: 00000000000020_local_login.sql
-- Completa o contrato de autenticacao local usado pelo app.
-- =====================================================================

alter table public.profiles
  add column if not exists password text;

drop function if exists public.login(text, text);

create or replace function public.login(p_username text, p_password text)
returns table (
  id bigint,
  username text,
  user_type user_type,
  is_admin boolean,
  group_id bigint
)
language sql
security definer
set search_path = public
as $$
  select
    p.id,
    p.username,
    p.user_type,
    p.is_admin,
    p.group_id
  from public.profiles p
  where p.username = lower(trim(p_username))
    and p.password = p_password
  limit 1;
$$;

revoke execute on function public.login(text, text) from public;
grant execute on function public.login(text, text) to anon, authenticated;
