-- =====================================================================
-- Migration: 00000000000011_cron_dia5.sql
-- Task: T5.1 - Job pg_cron dia 5 mensalidades (idempotente)
-- Stack: PostgreSQL 15 / Supabase + pg_cron
--
-- Componentes:
--   1. UNIQUE parcial (user_id, group_id, mes) em PAYMENTS type=monthly
--      -> base do ON CONFLICT idempotente (1 mensalidade/mes/usuario).
--   2. Function public.generate_monthly_payments(p_group_id uuid default null)
--      Cria PAYMENTS (type=monthly, status=pending) para todos os
--      mensalistas ativos do grupo, com due window = mes corrente.
--   3. Cron job 'generate_monthly_payments': dia 5 12:00 UTC = 09:00 BRT.
--   4. Seed inicial: select public.generate_monthly_payments();
--      Garante 1 mensalidade p/ admin mensalista ja no `db reset`.
--
-- Conversao BRT -> UTC: Brasil sem DST desde 2019; BRT = UTC-3 fixo.
--   Dia 5 09:00 BRT (cron job) = Dia 5 12:00 UTC.
--   Pattern cron 5 campos: "0 12 5 * *".
--
-- Dependencias: T1.3a (schema PAYMENTS/PROFILES/GROUPS),
--               T1.3b (seed GROUPS UUID fixo + seed-auth admin mensalista),
--               T2.0 (slot 10 reservado; este migra usa slot 11 - paralelo).
-- Idempotente:
--   (a) cron.unschedule em DO block (re-run seguro).
--   (b) UNIQUE parcial (user_id, group_id, date_trunc('month', created_at))
--       + INSERT ... ON CONFLICT DO NOTHING.
--   (c) Function re-criada com DROP IF EXISTS + CREATE OR REPLACE.
--
-- Contexto de execucao do cron:
--   pg_cron roda como `postgres` superuser (Supabase), que BYPASSA RLS.
--   Ainda assim usamos SECURITY DEFINER para:
--     - Herdar privilegios explicitos do owner da function.
--     - Garantir consistencia mesmo se o role do cron mudar no futuro.
--   SET search_path = public previne injection.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Cleanup cron job antigo (idempotente re-run)
-- ---------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from cron.job where jobname = 'generate_monthly_payments'
  ) then
    perform cron.unschedule('generate_monthly_payments');
    raise notice 'T5.1: cron job antigo desagendado.';
  end if;
exception
  when others then
    raise notice 'T5.1 cleanup cron: %', sqlerrm;
end
$$;

-- ---------------------------------------------------------------------
-- 1. UNIQUE parcial (user_id, group_id, mes) -> viabiliza ON CONFLICT
-- ---------------------------------------------------------------------
-- PAYMENTS (schema T1.3a) NAO possui period_start/period_end. A unica
-- janela idempotente viavel e date_trunc('month', created_at). Como o
-- job roda todo dia 5 09:00 BRT e created_at = now() na insercao, o
-- trunc para mes (America/Sao_Paulo) identifica a mensalidade unica.
--
-- Partial index: soh PAYMENTS type=monthly (casual nao tem chave mensal).
-- Expressao imutavel: date_trunc('month', created_at AT TIME ZONE
-- 'America/Sao_Paulo') garante mes BRT (nao UTC) - Jan/Jan BRT pode
-- cair Dez UTC se criado entre 21:00-00:00 UTC do dia 1.
do $$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'payments'
      and indexname = 'payments_monthly_user_group_month_key'
  ) then
    create unique index payments_monthly_user_group_month_key
      on public.payments (
        user_id,
        group_id,
        (date_trunc('month', (created_at at time zone 'America/Sao_Paulo')))
      )
      where type = 'monthly';
  end if;
end
$$;

comment on index public.payments_monthly_user_group_month_key is
  'T5.1: 1 mensalidade mensal por (usuario, grupo). Base do ON CONFLICT idempotente do job dia 5. Mes em BRT (UTC-3).';

-- ---------------------------------------------------------------------
-- 2. Function: generate_monthly_payments (SECURITY DEFINER)
-- ---------------------------------------------------------------------
-- Logica:
--   * now() em BRT (UTC-3 fixo; sem DST desde 2019).
--   * Mes corrente BRT para o titulo ("Mensalidade Julho/2026").
--   * amount = groups.monthly_fee (snapshot em moeda para auditoria; se
--     admin mudar a taxa depois, mensalidades ja geradas preservam valor).
--   * title = "Mensalidade <Mes-BRT-pt-BR> <Ano>" (ex: "Mensalidade julho/2026").
--   * Filtra: user_type='mensalista' apenas (avulsos e goleiro_pago nao).
--   * INSERT ... ON CONFLICT (user_id, group_id, mes) DO NOTHING -> idempotente.
--   * group_id herdado do profile (denormalizado em PAYMENTS, required).
--
-- Parametro opcional p_group_id: limita a 1 grupo (reuso admin UI / testes).
-- Default null: percorre todos os groups.
--
-- Logs: RAISE NOTICE capturado pelo pg_cron -> cron.job_run_details.

drop function if exists public.generate_monthly_payments(uuid);  -- re-run seguro

create or replace function public.generate_monthly_payments(p_group_id uuid default null)
returns table(
  inserted_count integer,
  skipped_count  integer,
  group_name     text,
  month_brt      text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now_brt       timestamptz;
  v_month_start   timestamptz;
  v_month_label   text;
  v_total_insert  integer := 0;
  v_total_skip    integer := 0;
  v_first_group   text := null;
begin
  -- "Agora" em BRT.
  v_now_brt := now() at time zone 'America/Sao_Paulo';

  -- Inicio do mes BRT corrente (ts sem tz -> timestamptz BRT).
  v_month_start := date_trunc('month', v_now_brt)
    at time zone 'America/Sao_Paulo';

  -- Label PT-BR do mes (ex: "julho/2026"). to_char com nome do mes em PT-BR.
  v_month_label := to_char(v_now_brt, 'TMMonth/YYYY');

  raise notice 'T5.1: BRT=%, mes=%, label=%', v_now_brt, v_month_start, v_month_label;

  -- INSERT unico multi-row com ON CONFLICT: 1 statement cubre todos groups.
  -- Filtragem:
  --   * profiles.user_type = 'mensalista' (exclui avulso/goleiro_pago)
  --   * profiles.group_id NOT NULL (sem racha = sem mensalidade)
  --   * match p_group_id se informado
  --   * group ativo (deleted_at NULL implicito nao existe nesta tabela)
  insert into public.payments (
    user_id,
    group_id,
    type,
    title,
    amount,
    status
  )
  select
    p.id,
    p.group_id,
    'monthly'::payment_type,
    'Mensalidade ' || v_month_label,
    g.monthly_fee,
    'pending'::payment_status
  from public.profiles p
  join public.groups   g on g.id = p.group_id
  where p.user_type = 'mensalista'
    and p.group_id is not null
    and (p_group_id is null or p.group_id = p_group_id)
  on conflict
    -- Expressao de conflito DEVE bater com a definicao do indice parcial:
    --   (user_id, group_id, date_trunc('month', created_at BRT))
    -- onde type='monthly. index_expression exige parenteses externas (PG grammar).
    (
      user_id,
      group_id,
      (date_trunc(
        'month',
        (created_at at time zone 'America/Sao_Paulo')
      ))
    )
    where type = 'monthly'
  do nothing;

  get diagnostics v_total_insert = row_count;

  -- Conta mensalistas qualificados no escopo (para skip = total - inserted).
  select count(*), (
    select min(g2.name)
    from public.groups g2
    where (p_group_id is null or g2.id = p_group_id)
  )
  into v_total_skip, v_first_group
  from public.profiles p
  where p.user_type = 'mensalista'
    and p.group_id is not null
    and (p_group_id is null or p.group_id = p_group_id);

  v_total_skip := greatest(v_total_skip - v_total_insert, 0);

  raise notice 'T5.1: inseridos=%, pulados(existentes)=%, alvo=%',
    v_total_insert, v_total_skip, v_total_skip + v_total_insert;

  return query
    select
      v_total_insert,
      v_total_skip,
      coalesce(v_first_group, '(nenhum)'),
      v_month_label;
end;
$$;

comment on function public.generate_monthly_payments(uuid) is
  'T5.1: Gera PAYMENTS (type=monthly, status=pending) para todos mensalistas ativos (user_type=mensalista) em todos os GROUPS (ou apenas p_group_id). Idempotente via UNIQUE parcial (user_id, group_id, mes BRT) onde type=monthly.';

-- ---------------------------------------------------------------------
-- 3. Cron job: dia 5 12:00 UTC = dia 5 09:00 BRT mensal
-- ---------------------------------------------------------------------
-- pg_cron usa UTC por default no Supabase. Pattern 5 campos:
--   minuto hora dia-do-mes mes dia-da-semana.
-- BRT = UTC-3 fixo. 09:00 BRT + 3h = 12:00 UTC.
-- "0 12 5 * *" = todo dia 5 do mes as 12:00 UTC = 09:00 BRT.
select cron.schedule(
  'generate_monthly_payments',
  '0 12 5 * *',
  $$ select * from public.generate_monthly_payments(); $$
);

-- ---------------------------------------------------------------------
-- 4. Seed inicial (primeira execucao da migration)
-- ---------------------------------------------------------------------
-- Garante mensalidade p/ admin mensalista ja no `supabase db reset`,
-- permitindo validar o INSERT idempotente motehandamente.
-- Re-executar a migration nao duplica (ON CONFLICT DO NOTHING).
select * from public.generate_monthly_payments();

-- =====================================================================
-- FIM da migration T5.1
-- Resumo:
--   Indice unico parcial: 1 (payments_monthly_user_group_month_key)
--   Function:             1 SECURITY DEFINER (generate_monthly_payments)
--   Cron job:             1 ('generate_monthly_payments', dia 5 09:00 BRT)
--   Seed:                 1 call inicial
-- =====================================================================
