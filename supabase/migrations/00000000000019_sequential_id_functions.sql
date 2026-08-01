-- =====================================================================
-- Migration: 00000000000019_sequential_id_functions.sql
-- Atualiza RPCs que recebiam IDs UUID de groups/profiles.
-- =====================================================================

drop function if exists public.is_group_member(uuid);
drop function if exists public.create_next_weekly_match(uuid);
drop function if exists public.promote_next_casual(uuid);
drop function if exists public.reject_pending_presence(uuid);
drop function if exists public.generate_monthly_payments(uuid);
drop function if exists public.get_active_push_tokens(uuid);
drop function if exists public.draw_teams(uuid);
drop function if exists public.add_walk_in_participant(uuid, uuid, integer);

create or replace function public.is_group_member(check_group_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.groups where id = check_group_id);
$$;

create or replace function public.create_next_weekly_match(p_group_id bigint default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_date timestamptz := (
    (current_date + ((4 - extract(dow from current_date)::integer + 7) % 7)
      + case when extract(dow from current_date)::integer = 4 then 7 else 0 end
    )::date + time '19:00'
  ) at time zone 'America/Sao_Paulo';
begin
  insert into public.matches (group_id, date_time, day_of_week, team_scores, goalkeeper_expense, status)
  select g.id, target_date, g.day_of_week, '{}'::jsonb, g.goalkeeper_expense, 'scheduled'::match_status
  from public.groups g
  where p_group_id is null or g.id = p_group_id
  on conflict (group_id, date_time) do nothing;
end;
$$;

create or replace function public.promote_next_casual(p_match_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  promoted_id bigint;
  presence_id uuid;
begin
  select mp.id, mp.user_id
    into presence_id, promoted_id
  from public.match_presences mp
  where mp.match_id = p_match_id and mp.status = 'waiting_list'
  order by mp.created_at asc
  limit 1
  for update skip locked;

  if presence_id is null then return null; end if;

  update public.match_presences
  set status = 'confirmed', confirmed_at = now(), updated_at = now()
  where id = presence_id;
  return promoted_id;
end;
$$;

create or replace function public.reject_pending_presence(p_presence_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  match_id_value uuid;
  promoted_id bigint;
begin
  select match_id into match_id_value
  from public.match_presences
  where id = p_presence_id and status = 'pending_approval';
  if match_id_value is null then
    raise exception 'Presence nao encontrada.' using errcode = 'P0002';
  end if;

  update public.match_presences
  set status = 'declined', confirmed_at = null, updated_at = now()
  where id = p_presence_id;
  promoted_id := public.promote_next_casual(match_id_value);
  return promoted_id;
end;
$$;

create or replace function public.generate_monthly_payments(p_group_id bigint default null)
returns table(inserted_count integer, skipped_count integer, group_name text, month_brt text)
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_rows integer;
  qualified_rows integer;
  month_label text := to_char(now() at time zone 'America/Sao_Paulo', 'TMMonth/YYYY');
  selected_group text;
begin
  insert into public.payments (user_id, group_id, type, title, amount, status)
  select p.id, p.group_id, 'monthly'::payment_type, 'Mensalidade ' || month_label,
         g.monthly_fee, 'pending'::payment_status
  from public.profiles p
  join public.groups g on g.id = p.group_id
  where p.user_type = 'mensalista'
    and (p_group_id is null or p.group_id = p_group_id)
  on conflict do nothing;
  get diagnostics inserted_rows = row_count;

  select count(*)::integer, min(g.name)
  into qualified_rows, selected_group
  from public.profiles p
  left join public.groups g on g.id = p.group_id
  where p.user_type = 'mensalista'
    and p.group_id is not null
    and (p_group_id is null or p.group_id = p_group_id);

  return query select inserted_rows, greatest(qualified_rows - inserted_rows, 0),
    coalesce(selected_group, '(nenhum)'), month_label;
end;
$$;

create or replace function public.get_active_push_tokens(p_group_id bigint default null)
returns table(expo_push_token text, user_id bigint, user_name text)
language sql
security definer
set search_path = public
as $$
  select dt.expo_push_token, p.id, p.username
  from public.device_tokens dt
  join public.profiles p on p.id = dt.user_id
  where p.group_id is not null and (p_group_id is null or p.group_id = p_group_id);
$$;

create or replace function public.draw_teams(p_match_id uuid)
returns table(player_id bigint, team_group integer, is_goalkeeper boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  goalkeeper_count integer;
  field_count integer;
begin
  select count(*) filter (where p.user_type = 'goleiro_pago'),
         count(*) filter (where p.user_type <> 'goleiro_pago')
  into goalkeeper_count, field_count
  from public.match_presences mp
  join public.profiles p on p.id = mp.user_id
  where mp.match_id = p_match_id and mp.status = 'confirmed';

  if goalkeeper_count <> 2 or field_count <> 14 then
    raise exception 'Sorteio exige 2 goleiros e 14 jogadores confirmados.' using errcode = '22023';
  end if;

  delete from public.match_participants where match_id = p_match_id;
  with ordered as (
    select mp.user_id,
      ntile(2) over (order by random()) as team_group,
      (p.user_type = 'goleiro_pago') as is_goalkeeper
    from public.match_presences mp
    join public.profiles p on p.id = mp.user_id
    where mp.match_id = p_match_id and mp.status = 'confirmed'
  )
  insert into public.match_participants (match_id, player_id, team_group, is_goalkeeper)
  select p_match_id, user_id, team_group, is_goalkeeper from ordered;

  update public.matches set status = 'active', updated_at = now() where id = p_match_id;
  return query
    select mp.player_id, mp.team_group, mp.is_goalkeeper
    from public.match_participants mp
    where mp.match_id = p_match_id
    order by mp.team_group, mp.is_goalkeeper desc, mp.created_at;
end;
$$;

create or replace function public.add_walk_in_participant(
  match_id uuid,
  player_id bigint,
  team_group integer
)
returns setof public.match_participants
language plpgsql
security definer
set search_path = public
as $$
declare
  participant public.match_participants%rowtype;
begin
  if team_group is null or team_group < 1 then
    raise exception 'Time invalido.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.matches where id = match_id and status = 'active') then
    raise exception 'Partida nao esta ativa.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.profiles p join public.matches m on m.group_id = p.group_id
    where m.id = match_id and p.id = player_id
  ) then
    raise exception 'Jogador invalido para esta partida.' using errcode = '23503';
  end if;

  insert into public.match_presences (match_id, user_id, status, confirmed_at)
  values (match_id, player_id, 'confirmed', now())
  on conflict (match_id, user_id) do update
    set status = 'confirmed', confirmed_at = coalesce(public.match_presences.confirmed_at, now()), updated_at = now();

  insert into public.match_participants (match_id, player_id, team_group)
  values (match_id, player_id, team_group)
  on conflict (match_id, player_id) do update set team_group = excluded.team_group
  returning * into participant;
  return next participant;
end;
$$;