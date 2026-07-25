-- =====================================================================
-- Migration: 00000000000008_auto_match_cron.sql
-- Task: T2.0 - MATCHES auto-criacao (seed + job pg_cron semanal + UI admin)
-- Stack: PostgreSQL 15 / Supabase + pg_cron
--
-- Componentes:
--   1. UNIQUE (group_id, date_time) -> viabiliza ON CONFLICT idempotente.
--   2. Function public.create_next_weekly_match(p_group_id uuid default null)
--      Cria MATCH (status=scheduled) para proxima quinta 19:00 BRT (22:00 UTC).
--   3. Cron job 'create_next_weekly_match': Sexta 20:00 BRT (Sexta 23:00 UTC).
--   4. Seed inicial: select public.create_next_weekly_match(); (idempotente).
--
-- Conversao BRT -> UTC: Brasil sem DST desde 2019; BRT = UTC-3 fixo.
--   Quinta 19:00 BRT (jogo)   = Quinta 22:00 UTC.
--   Sexta 20:00 BRT (cron job) = Sexta 23:00 UTC.
--
-- Dependencias: T1.3a (schema), T1.3b (seed GROUPS UUID fixo),
--               T1.7 (RLS is_admin muta matches).
-- Idempotente: ON CONFLICT (group_id, date_time) DO NOTHING +
--              cron.unschedule em DO block (re-run seguro).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Cleanup cron jobs antigos (nomes atuais + nomes legados da v1)
-- ---------------------------------------------------------------------
do $$
declare
  j text;
begin
  for j in
    select jobname
    from cron.job
    where jobname in (
      'create_next_weekly_match',
      'match_auto_create_monday',
      'match_auto_create_tuesday',
      'match_auto_create_wednesday',
      'match_auto_create_thursday'
    )
  loop
    perform cron.unschedule(j);
  end loop;
exception
  when others then
    raise notice 'T2.0 cleanup cron: %', sqlerrm;
end
$$;

-- ---------------------------------------------------------------------
-- 1. UNIQUE constraint (group_id, date_time) - base da idempotencia
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'matches_group_id_date_time_key'
      and conrelid = 'public.matches'::regclass
  ) then
    alter table public.matches
      add constraint matches_group_id_date_time_key unique (group_id, date_time);
  end if;
end
$$;

comment on constraint matches_group_id_date_time_key on public.matches is
  'T2.0: 1 partida por (grupo, data/hora). Base do ON CONFLICT idempotente do job semanal.';

-- ---------------------------------------------------------------------
-- 2. Function: create_next_weekly_match (SECURITY DEFINER)
-- ---------------------------------------------------------------------
-- Logica:
--   * dow alvo = 4 (Quinta).
--   * now() convertida para BRT (UTC-3 fixo; Brasil sem DST desde 2019).
--   * days_to_thursday: 0..6; se 0 (hoje e quinta), forca +7 (proxima semana).
--   * 19:00 BRT wall-clock -> timestamptz via "at time zone 'America/Sao_Paulo'".
--   * ON CONFLICT (group_id, date_time) DO NOTHING -> cria se ainda nao existe.
--
-- Parametro opcional p_group_id: limita a 1 grupo (uso manual/admin UI).
-- Default null: percorre todos os groups.
--
-- Logs: RAISE NOTICE capturado pelo pg_cron -> cron.job_run_details.

drop function if exists public.create_next_thursday_match();         -- legacy quebrada
drop function if exists public.send_match_created_notification();    -- legacy placeholder
drop function if exists public.create_next_weekly_match(uuid);       -- re-run seguro

create or replace function public.create_next_weekly_match(p_group_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_dow       constant integer := 4;   -- Quinta
  v_target_hour_brt  constant integer := 19;  -- 19:00 BRT wall-clock
  v_now_brt          date;
  v_current_dow      integer;
  v_days_to_thursday integer;
  v_thursday_brt_local timestamp;  -- wall-clock BRT (sem tz)
  v_thursday_utc     timestamptz;
  v_match_id         uuid;
  v_group_id         uuid;
  v_group_name       text;
  v_goalkeeper_exp   numeric(10,2);
  v_created_count    integer := 0;
  v_skipped_count    integer := 0;
begin
  -- Hoje em BRT (data sem hora).
  v_now_brt := (now() at time zone 'America/Sao_Paulo')::date;

  -- dow de hoje (0=Dom..6=Sab).
  v_current_dow := extract(dow from v_now_brt)::integer;

  -- Dias ate proxima quinta; se hoje e quinta, pula para semana seguinte.
  v_days_to_thursday := (v_target_dow - v_current_dow + 7) % 7;
  if v_days_to_thursday = 0 then
    v_days_to_thursday := 7;
  end if;

  -- Wall-clock BRT: hoje + dias + 19h (timestamp sem tz).
  v_thursday_brt_local := v_now_brt::timestamp
    + make_interval(days => v_days_to_thursday)
    + make_interval(hours => v_target_hour_brt);

  -- Converte para UTC (timestamptz). 19:00 BRT => 22:00 UTC.
  v_thursday_utc := v_thursday_brt_local at time zone 'America/Sao_Paulo';

  raise notice 'T2.0: alvo = % BRT = % UTC', v_thursday_brt_local, v_thursday_utc;

  -- Percorre todos os grupos (ou apenas 1 se p_group_id fornecido).
  for v_group_id, v_group_name, v_goalkeeper_exp in
    select g.id, g.name, g.goalkeeper_expense
    from public.groups g
    where p_group_id is null or g.id = p_group_id
    order by g.id
  loop
    v_match_id := null;

    insert into public.matches (
      group_id,
      date_time,
      day_of_week,
      team_scores,
      goalkeeper_expense,
      status
    ) values (
      v_group_id,
      v_thursday_utc,
      v_target_dow,
      '{}'::jsonb,
      v_goalkeeper_exp,
      'scheduled'::match_status
    )
    on conflict (group_id, date_time) do nothing
    returning id into v_match_id;

    if v_match_id is not null then
      v_created_count := v_created_count + 1;
      raise notice 'T2.0: MATCH % criado para grupo "%" em %',
        v_match_id, v_group_name, v_thursday_utc;
    else
      v_skipped_count := v_skipped_count + 1;
      raise notice 'T2.0: grupo "%" ja tem MATCH em % (skip)',
        v_group_name, v_thursday_utc;
    end if;
  end loop;

  raise notice 'T2.0: criados=%, skipados=%', v_created_count, v_skipped_count;
end;
$$;

comment on function public.create_next_weekly_match(uuid) is
  'T2.0: Cria MATCH (status=scheduled) para proxima quinta 19:00 BRT em todos os GROUPS (ou apenas p_group_id). Idempotente via ON CONFLICT (group_id, date_time).';

-- ---------------------------------------------------------------------
-- 3. Cron job: Sexta 20:00 BRT (Sexta 23:00 UTC) semanal
-- ---------------------------------------------------------------------
-- pg_cron usa UTC por default no Supabase. Pattern cron 5 campos:
--   minuto hora dia-do-mes mes dia-da-semana (0=Dom..6=Sab).
-- BRT = UTC-3 fixo (sem DST). 20:00 BRT + 3h = 23:00 UTC.
-- "0 23 * * 5" = toda Sexta-feira as 23:00 UTC = Sexta 20:00 BRT.
select cron.schedule(
  'create_next_weekly_match',
  '0 23 * * 5',
  $$ select public.create_next_weekly_match(); $$
);

-- ---------------------------------------------------------------------
-- 4. Seed inicial (primeira execucao da migration)
-- ---------------------------------------------------------------------
-- Garante que apos `supabase db reset` exista um MATCH futuro valido
-- para FK de MATCH_PRESENCES (resolve blocker B5 -> destrava T2.2/T2.3).
-- ON CONFLICT dentro da function torna re-runs seguros.
select public.create_next_weekly_match();

-- =====================================================================
-- FIM da migration T2.0
-- Resumo:
--   Constraint: 1 unique (group_id, date_time) em public.matches
--   Function:   public.create_next_weekly_match(uuid default null) - SECURITY DEFINER
--   Cron job:   create_next_weekly_match (Sexta 23:00 UTC = 20:00 BRT)
--   Seed:       1 chamada inicial idempotente
--
-- Acceptance checks (rodar manual apos `supabase db reset`):
--   1. SELECT count(*) FROM public.matches WHERE status='scheduled'
--        AND date_time > now();  -- >= 1
--   2. SELECT jobname, schedule FROM cron.job
--        WHERE jobname='create_next_weekly_match';  -- '0 23 * * 5'
--   3. SELECT public.create_next_weekly_match();
--        -- deve logar 'criados=0, skipados=1' (idempotente)
--   4. UI: Perfil (admin) -> "Gerenciar partidas (admin)"
--   5. SELECT runid, jobid, return_code, output
--        FROM cron.job_run_details ORDER BY start_time DESC LIMIT 5;
-- =====================================================================
