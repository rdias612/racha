-- =====================================================================
-- Migration: 00000000000008_auto_match_cron.sql
-- Task: T2.0 - Auto-criacao de MATCHES via pg_cron
-- Stack: PostgreSQL 15 / Supabase + pg_cron
--
-- Objetivo:
--   Cron job que verifica GROUPS sem MATCH agendado para a proxima
--   quinta-feira e cria automaticamente.
--
-- Cronograma (pg_cron):
--   - Seg 09:00 BRT  -> Verifica e cria se necessario
--   - Ter 09:00 BRT  -> Verifica e cria se necessario
--   - Qua 09:00 BRT  -> Verifica e cria se necessario
--   - Qui 09:00 BRT  -> Verifica e cria se necessario (ultimo chance)
--
-- Lógica:
--   1. Seleciona GROUPS onde NAO existe MATCH com day_of_week=4
--      e date_time entre (proxima quinta) e (proxima quinta + 1 dia).
--   2. Para cada grupo sem MATCH, INSERT em MATCHES com status='scheduled'.
--   3. Usa pg_net para enviar push notification (T5.1) - placeholder.
--
-- Idempotente:
--   - Se ja existe MATCH para a proxima quinta, NAO cria outro.
--   - DROP FUNCTION IF EXISTS antes de criar (re-run seguro).
--
-- Dependencia: T1.3a (schema com MATCHES table)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Cleanup idempotente
-- ---------------------------------------------------------------------

drop function if exists public.create_next_thursday_match();
drop function if exists public.send_match_created_notification();

-- ---------------------------------------------------------------------
-- 1. Function: create_next_next_thursday_match (SECURITY DEFINER)
-- ---------------------------------------------------------------------

create or replace function public.create_next_thursday_match()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  next_thursday timestamptz;
  current_day integer;
  days_until_thursday integer;
  v_group_id uuid;
  v_group_name text;
  v_match_id uuid;
begin
  -- Calcula proxima quinta-feira (dia 4) a partir de agora.
  current_day := extract(dow from now())::integer;
  -- Quinta = 4. Se hoje e quinta, proxima e semana que vem.
  days_until_thursday := (4 - current_day) % 7;
  if days_until_thursday = 0 then
    days_until_thursday := 7;
  end if;

  next_thursday := now() + (days_until_thursday * interval '1 day');

  -- Ajusta para 19:00 BRT (UTC-3) => 22:00 UTC.
  next_thursday := next_thursday at time zone 'America/Sao_Paulo'
    at time zone 'UTC';

  -- Loop por cada grupo sem MATCH agendado para proxima quinta.
  for v_group_id, v_group_name in
    select g.id, g.name
    from public.groups g
    where not exists (
      select 1 from public.matches m
      where m.group_id = g.id
        and m.day_of_week = 4
        and m.date_time >= next_thursday
        and m.date_time < next_thursday + interval '1 day'
    )
  loop
    -- Cria MATCH agendado.
    insert into public.matches (
      group_id,
      date_time,
      day_of_week,
      team_scores,
      goalkeeper_expense,
      status
    ) values (
      v_group_id,
      next_thursday,
      4,
      '{}'::jsonb,
      40.00,
      'scheduled'
    ) returning id into v_match_id;

    log('MATCH criado automaticamente para grupo "' || v_group_name
      || '" na proxima quinta-feira.');

    -- Placeholder: pg_net para push notification (T5.1).
    -- Na pratica, sera chamado por pg_cron via pg_net POST.
    -- call pg_net.http_post(
    --   url => 'https://api.futamigos.local/notify',
    --   body => json_build_object(
    --     'type', 'match_created',
    --     'match_id', v_match_id,
    --     'group_id', v_group_id,
    --     'date_time', next_thursday::text
    --   )
    -- );
  end loop;
end;
$$;

comment on function public.create_next_thursday_match() is
  'T2.0: Cria MATCH agendado para proxima quinta-feira em GROUPS sem MATCH. SECURITY DEFINER.';

-- ---------------------------------------------------------------------
-- 2. Function: send_match_created_notification (SECURITY DEFINER)
-- ---------------------------------------------------------------------

create or replace function public.send_match_created_notification()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match_id uuid;
  v_group_id uuid;
  v_date_time timestamptz;
begin
  -- Placeholder: pg_net para push notification (T5.1).
  -- Na pratica, sera chamado por pg_cron via pg_net POST.
  -- call pg_net.http_post(
  --   url => 'https://api.futamigos.local/notify',
  --   body => json_build_object(
  --     'type', 'match_created',
  --     'match_id', v_match_id,
  --     'group_id', v_group_id,
  --     'date_time', v_date_time::text
  --   )
  -- );
end;
$$;

comment on function public.send_match_created_notification() is
  'T2.0: Placeholder para enviar notificacao de MATCH criado (pg_net).';

-- ---------------------------------------------------------------------
-- 3. Cron jobs (pg_cron)
-- ---------------------------------------------------------------------

-- Seg 09:00 BRT (12:00 UTC) - verifica e cria se necessario.
select cron.schedule(
  'match_auto_create_monday',
  '0 12 * * 1',
  $$select public.create_next_thursday_match()$$
);

-- Ter 09:00 BRT (12:00 UTC) - verifica e cria se necessario.
select cron.schedule(
  'match_auto_create_tuesday',
  '0 12 * * 2',
  $$select public.create_next_thursday_match()$$
);

-- Qua 09:00 BRT (12:00 UTC) - verifica e cria se necessario.
select cron.schedule(
  'match_auto_create_wednesday',
  '0 12 * * 3',
  $$select public.create_next_thursday_match()$$
);

-- Qui 09:00 BRT (12:00 UTC) - ultimo chance, cria se ainda nao existe.
select cron.schedule(
  'match_auto_create_thursday',
  '0 12 * * 4',
  $$select public.create_next_thursday_match()$$
);

comment on cron.job 'match_auto_create_monday' is 'Seg 09:00 BRT: verifica e cria MATCH para proxima quinta.';
comment on cron.job 'match_auto_create_tuesday' is 'Ter 09:00 BRT: verifica e cria MATCH para proxima quinta.';
comment on cron.job 'match_auto_create_wednesday' is 'Qua 09:00 BRT: verifica e cria MATCH para proxima quinta.';
comment on cron.job 'match_auto_create_thursday' is 'Qui 09:00 BRT: ultimo chance, cria MATCH para proxima quinta.';
