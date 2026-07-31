-- =====================================================================
-- Migration: 00000000000013_draw.sql
-- Task: T6.1 - Sorteio aleatorio puro (2 teams 7 + 2 goleiros).
-- Stack: PostgreSQL 15 / Supabase
--
-- Componentes:
--   1. Function public.draw_teams(p_match_id uuid)
--      SECURITY DEFINER + transactional: congela a lista de confirmados
--      em MATCH_PARTICIPANTS distribuida em 2 times (team_group 1/2).
--      Atribui is_goalkeeper=true aos 2 goleiro_pago em times opostos.
--      Seta MATCHES.status='active' no final (congelamento da lista).
--      Idempotente: DELETE anteriores de match_id antes de re-INSERT.
--
-- Algoritmo (PRD regra 4):
--   1. Valida gate admin (defense in depth).
--   2. Carrega match_id; erro P0002 se nao existir.
--   3. SELECT goleiro_pago (user_type='goleiro_pago') confirmados:
--      - 1o em team_group=1 (is_goalkeeper=true).
--      - 2o em team_group=2 (is_goalkeeper=true).
--   4. SELECT demais jogadores confirmados (user_type != goleiro_pago),
--      ORDER BY random(), NTILE(2) para split 7/7.
--   5. DELETE match_participants WHERE match_id (idempotente).
--   6. INSERT unificado (GK + 14).
--   7. UPDATE matches SET status='active'.
--   8. RETURN tabela (player_id, team_group, is_goalkeeper).
--
-- Dependencias: T1.3a (schema match_participants/matches/profiles/
--               match_presences + enums), T1.7 (RLS is_admin + policies).
-- Idempotente: re-executar sorteio para mesmo match sobrescreve resultados.
--
-- RLS bypass: SECURITY DEFINER executa como owner. Mantemos gate is_admin()
-- p/ clareza de contrato e N3 (defense in depth).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Function: draw_teams (SECURITY DEFINER)
-- ---------------------------------------------------------------------
-- Notas de design:
--   - ORDER BY random() dentro de NTILE(2) garante sorteio distinto a cada
--     chamada (AC: 3 sorteios consecutivos geram combinacoes diferentes).
--   - NTILE(2) divide em 2 buckets de tamanho o mais proximo possivel
--     (ceiling/floor). Para 14 jogadores -> 7/7 exato.
--   - GoLEIRO_PAGO tratado a parte: sao confirmados por default (slot pago)
--     mas tem o seu proprio slot de GK. Nao entram no NTILE(2) dos outros 14.
--   - CTEs encadeadas mantem o plano legivel. Tudo num unico statement
--     INSERT..SELECT..DELETE eficiente.
--   - LOCK TABLE match_participants IN SHARE ROW EXCLUSIVE MODE evita
--     concorrencia entre 2 admins sorteando o mesmo match simultaneamente.
drop function if exists public.draw_teams(uuid);

create or replace function public.draw_teams(p_match_id uuid)
returns table (
  player_id     uuid,
  team_group    integer,
  is_goalkeeper boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match_exists boolean;
  v_group_id     uuid;
  v_goalkeeper_count integer;
  v_field_count integer;
begin
  -- Gate de permissao (defense in depth; policies ja filtram admin).
  if not public.is_admin() then
    raise exception 'Apenas administradores podem sortear os times.'
      using errcode = '42501';
  end if;

  -- Valida match existe (erro PT-BR P0002 se ausente).
  select exists (
    select 1 from public.matches m where m.id = p_match_id
  ) into v_match_exists;

  if not v_match_exists then
    raise exception 'Partida nao encontrada.'
      using errcode = 'P0002';
  end if;

  select count(*) filter (where p.user_type = 'goleiro_pago'),
         count(*) filter (where p.user_type <> 'goleiro_pago')
    into v_goalkeeper_count, v_field_count
    from public.match_presences mp
    join public.profiles p on p.id = mp.user_id
   where mp.match_id = p_match_id
     and mp.status = 'confirmed';

  if v_goalkeeper_count <> 2 or v_field_count <> 14 then
    raise exception 'Sorteio exige 2 goleiros e 14 jogadores confirmados (encontrados: % goleiros, % jogadores).',
      v_goalkeeper_count, v_field_count
      using errcode = '22023';
  end if;

  -- Lock para impedir 2 admins sorteando simultaneamente o mesmo match.
  lock table public.match_participants in share row exclusive mode;

  -- Limpa participantes anteriores do match (idempotente para re-sorteio).
  delete from public.match_participants
   where match_id = p_match_id;

  -- INSERT unificado (CTE):
  --   gks:   2 goleiro_pago confirmados, com row_number() para atribuir
  --          par em team1 / impar em team2.
  --   field: 14 demais confirmados, NTILE(2) sobre ORDER BY random().
  with gks as (
    select
      mp.user_id,
      row_number() over (order by mp.confirmed_at nulls last, mp.created_at) as rn
    from public.match_presences mp
    join public.profiles p on p.id = mp.user_id
    where mp.match_id    = p_match_id
      and mp.status      = 'confirmed'
      and p.user_type    = 'goleiro_pago'
    order by rn
    limit 2
  ),
  field_players as (
    select
      mp.user_id,
      ntile(2) over (order by random()) as bucket
    from public.match_presences mp
    join public.profiles p on p.id = mp.user_id
    where mp.match_id    = p_match_id
      and mp.status      = 'confirmed'
      and p.user_type   <> 'goleiro_pago'
  ),
  unified as (
    -- GoLEIROs: rn=1 em team1 (GK), rn=2 em team2 (GK).
    select
      g.user_id,
      case when g.rn = 1 then 1 else 2 end as team_group,
      true                                as is_goalkeeper
    from gks g
    union all
    -- Demais: bucket 1 -> team1, bucket 2 -> team2 (nao-GK).
    select
      f.user_id,
      f.bucket      as team_group,
      false         as is_goalkeeper
    from field_players f
  )
  insert into public.match_participants (
    match_id, player_id, team_group, is_goalkeeper
  )
  select
    p_match_id, u.user_id, u.team_group, u.is_goalkeeper
  from unified u;

  -- Congela a partida (status='active') apos sortear.
  update public.matches
     set status     = 'active',
         updated_at = now()
   where id = p_match_id;

  -- Retorna o resultado do sorteio.
  return query
    select
      mp.player_id,
      mp.team_group,
      mp.is_goalkeeper
    from public.match_participants mp
    where mp.match_id = p_match_id
    order by mp.team_group asc, mp.is_goalkeeper desc, mp.created_at asc;
end;
$$;

comment on function public.draw_teams(uuid) is
  'T6.1: Sorteio aleatorio puro. Distribui 14 confirmados em team_group 1/2 via NTILE(2) sobre ORDER BY random(); atribui is_goalkeeper=true aos 2 goleiro_pago (1 por time). Set a MATCHES.status=''active''. Idempotente (DELETE anteriores). SECURITY DEFINER.';

-- ---------------------------------------------------------------------
-- 2. Permissao de execucao: anon + authenticated podem chamar
--    (o gate interno is_admin() controla acesso administrativo).
-- ---------------------------------------------------------------------
-- Supabase por default revoga de anon/authenticated; concedemos Execute
-- para que o client RPC funcione (RLS+nosso gate fazem o resto).
grant execute on function public.draw_teams(uuid) to anon, authenticated;

-- =====================================================================
-- FIM da migration T6.1
-- Resumo:
--   Functions: 1 SECURITY DEFINER (draw_teams) com gate is_admin().
--   Grants:    Execute para anon + authenticated.
-- Idempotencia: DROP FUNCTION IF EXISTS + DELETE participantes anteriores.
-- =====================================================================
