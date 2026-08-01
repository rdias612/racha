-- =====================================================================
-- Migration: 00000000000017_local_auth.sql
-- Local authentication: profiles.full_name -> profiles.username.
-- =====================================================================

-- Preserve existing profile data while making it usable as a login key.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'full_name'
  ) then
    alter table public.profiles rename column full_name to username;
  end if;
end;
$$;

-- Normalize old display names and make duplicate values deterministic.
with normalized as (
  select
    id,
    case
      when normalized_name ~ '^[a-z0-9][a-z0-9._-]{1,31}$' then normalized_name
      else 'user_' || left(replace(id::text, '-', ''), 8)
    end as base_username
  from (
    select
      id,
      lower(regexp_replace(trim(username), '[^a-zA-Z0-9._-]+', '_', 'g')) as normalized_name
    from public.profiles
  ) source
), ranked as (
  select
    id,
    base_username,
    row_number() over (partition by base_username order by id) as duplicate_number
  from normalized
)
update public.profiles profile
set username = case
  when ranked.duplicate_number = 1 then ranked.base_username
  else left(ranked.base_username, 23) || '_' || ranked.duplicate_number::text
end
from ranked
where profile.id = ranked.id;

alter table public.profiles
  alter column username set not null;

alter table public.profiles
  drop constraint if exists profiles_username_format_check;

alter table public.profiles
  add constraint profiles_username_format_check
  check (username ~ '^[a-z0-9][a-z0-9._-]{1,31}$');

create unique index if not exists profiles_username_key
  on public.profiles (username);

-- A local Auth user without an explicitly provisioned profile must not gain
-- access through the old auth.users trigger.
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

-- Profiles are provisioned by the admin backend, never by an app user.
drop policy if exists profiles_insert_policy on public.profiles;
create policy profiles_insert_policy on public.profiles
  for insert
  with check (public.is_admin());

comment on policy profiles_insert_policy on public.profiles is
  'Somente admin provisiona perfis locais; usuarios nao podem criar a propria identidade.';

-- Username is an identity field and cannot be changed by a regular user.
create or replace function public.enforce_profile_update_security()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.id is distinct from old.id
     or new.created_at is distinct from old.created_at then
    raise exception 'profile identity fields are immutable';
  end if;

  if auth.uid() is not null and not public.is_admin()
     and (new.username is distinct from old.username
       or new.phone_whatsapp is distinct from old.phone_whatsapp
       or new.group_id is distinct from old.group_id
       or new.user_type is distinct from old.user_type
       or new.is_admin is distinct from old.is_admin
       or new.updated_at is distinct from old.updated_at) then
    raise exception 'users may update only avatar_url';
  end if;

  return new;
end;
$$;

comment on function public.enforce_profile_update_security() is
  'Impede auto-promocao e troca de identidade; self-service limita-se a avatar_url.';

-- The function was created before the column rename and must be replaced;
-- otherwise push jobs would still query the removed full_name column.
create or replace function public.get_active_push_tokens(p_group_id uuid default null)
returns table(
  expo_push_token text,
  user_id         uuid,
  user_name       text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    select
      dt.expo_push_token,
      p.id       as user_id,
      p.username as user_name
    from public.device_tokens dt
    join public.profiles p on p.id = dt.user_id
    where p.group_id is not null
      and (p_group_id is null or p.group_id = p_group_id);
end;
$$;
