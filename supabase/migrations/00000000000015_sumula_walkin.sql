-- =====================================================================
-- Migration: 00000000000015_sumula_walkin.sql
-- Task: T6.2 - Walk-in administrativo da sumula.
-- =====================================================================

drop function if exists public.add_walk_in_participant(uuid, uuid, integer);

create or replace function public.add_walk_in_participant(
  match_id uuid,
  player_id uuid,
  team_group integer
)
returns setof public.match_participants
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match_id uuid := match_id;
  v_player_id uuid := player_id;
  v_team_group integer := team_group;
  v_match_status public.match_status;
  v_participant public.match_participants%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem adicionar jogadores.'
      using errcode = '42501';
  end if;

  if v_team_group is null or v_team_group < 1 then
    raise exception 'Time invalido.'
      using errcode = '22023';
  end if;

  select m.status
    into v_match_status
  from public.matches m
  where m.id = v_match_id;

  if v_match_status is null then
    raise exception 'Partida nao encontrada.'
      using errcode = 'P0002';
  end if;

  if v_match_status <> 'active' then
    raise exception 'Partida nao esta ativa.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.profiles p
    join public.matches m on m.group_id = p.group_id
    where m.id = v_match_id
      and p.id = v_player_id
  ) then
    raise exception 'Jogador invalido para esta partida.'
      using errcode = '23503';
  end if;

  insert into public.match_presences (
    match_id, user_id, status, confirmed_at
  )
  values (
    v_match_id, v_player_id, 'confirmed', now()
  )
  on conflict (match_id, user_id) do update
    set status = 'confirmed',
        confirmed_at = coalesce(public.match_presences.confirmed_at, now()),
        updated_at = now();

  insert into public.match_participants (
    match_id, player_id, team_group
  )
  values (
    v_match_id, v_player_id, v_team_group
  )
  on conflict (match_id, player_id) do update
    set team_group = excluded.team_group
  returning * into v_participant;

  return next v_participant;
end;
$$;

comment on function public.add_walk_in_participant(uuid, uuid, integer) is
  'T6.2: Admin adiciona walk-in com presence confirmed e participante atomicos. Idempotente. SECURITY DEFINER.';

revoke execute on function public.add_walk_in_participant(uuid, uuid, integer) from public;
grant execute on function public.add_walk_in_participant(uuid, uuid, integer) to authenticated;