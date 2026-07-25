-- =====================================================================
-- Migration: 00000000000012_push_jobs.sql
-- Task: T5.2 - 3 jobs pg_cron semanais + dispatch push via Vault
-- Stack: PostgreSQL 15 / Supabase + pg_cron + pg_net + Vault
--
-- OBJETIVO:
--   Disparar pushes Expo (notification) sob 3 cadencias:
--     (a) Segunda 09:00 BRT -> lembrete mensalistas (pagamentos pending).
--     (b) Terca   19:00 BRT -> recap lista confirmada (48h antes do jogo).
--     (c) Quinta  18:00 BRT -> lembrete dia do jogo.
--   Token Expo injetado via Vault (SET LOCAL app.expo_token) dentro de
--   cada transacao do job - nao persiste em pg_settings / logs.
--
-- COMPONENTES:
--   1. Tabela public.push_log (auditoria append-only: 1 linha por envio).
--   2. Function public.get_active_push_tokens(p_group_id) -> tokens ativos.
--   3. Function public.dispatch_push(p_kind, p_match_id) -> POST para Expo.
--   4. 3 cron jobs (cleanup + schedule apos criar functions).
--
-- CONVERSAO BRT -> UTC (FIXO, NAO RECALCULAR):
--   Brasil sem DST desde 2019; BRT = UTC-3 fixo.
--   Seg 09:00 BRT = Seg 12:00 UTC -> '0 12 * * 1'
--   Ter 19:00 BRT = Ter 22:00 UTC -> '0 22 * * 2'
--   Qui 18:00 BRT = Qui 21:00 UTC -> '0 21 * * 4'
--
-- DEPENDENCIAS:
--   - T1.3a (device_tokens, profiles, matches, match_presences, payments)
--   - T5.0 (secret vault 'expo_access_token' + GRANT select p/ service_role)
--   - Extensao pg_net (criada em T1.3a) -> net.http_post
--   - T1.7 (RLS + helper public.is_admin()) -> policy admin-only em push_log
--
-- IDEMPOTENCIA:
--   (a) create table if not exists push_log + create index if not exists.
--   (b) DO $$ unschedule $$ para os 3 jobnames (re-run seguro).
--   (c) drop function if exists antes de create or replace (muda assinatura).
--   (d) cron.schedule apos criar functions (evita referencing function null).
--
-- SEGURANCA (B-H1, B-H3):
--   - SECURITY DEFINER + SET search_path = public em todas functions.
--   - SET LOCAL app.expo_token dentro da transacao do job (NAO persiste).
--   - current_setting('app.expo_token', true) com missing_ok=true -> NULL.
--   - NUNCA RAISE NOTICE imprimindo current_setting('app.expo_token').
--   - RLS ENABLE em push_log; policy SELECT so para admin (is_admin()).
--   - Sem GRANT SELECT em push_log para anon/authenticated.
--
-- SCOPE NOTE (429/400 logging):
--   pg_net e fire-and-forget - net.http_post e async. A coluna
--   http_status de push_log PERMANECERA NULL neste T5.2: nao ha coleta
--   de http_response na mesma transacao. A tabela esta pronta para
--   receber o status em job futuro (T5.3 polling net._http_response OU
--   trigger). AC "Erros (429/400) logados" e PARCIAL: schema pronto,
--   preenchimento assincrono pendente.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Cleanup cron jobs antigos (idempotente re-run)
-- ---------------------------------------------------------------------
do $$
declare j text;
begin
  for j in
    select jobname from cron.job
    where jobname in ('push_monthly_reminder','push_recap_48h','push_match_reminder')
  loop
    perform cron.unschedule(j);
  end loop;
exception
  when others then raise notice 'T5.2 cleanup: %', sqlerrm;
end $$;

-- ---------------------------------------------------------------------
-- 1. TABELA public.push_log (auditoria append-only)
-- ---------------------------------------------------------------------
-- 1 linha = 1 tentativa de envio para 1 destinatario.
-- payload: snapshot do body Expo enviado (jsonb).
-- http_status/response_body: NULL neste T5.2 (fire-and-forget); sera
--   populado em T5.3 via poll de net._http_response OU trigger.
-- request_id: FK logica para net._http_response (bigint retornado pelo
--   pg_net.http_post) - permite JOIN futuro p/ resolver o status.
-- Sem updated_at: tabela append-only (auditoria historica imutavel).
create table if not exists public.push_log (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references public.matches(id) on delete set null,
  user_id uuid references public.profiles(id) on delete cascade,
  expo_token text not null,
  kind text not null,
  title text,
  body text,
  payload jsonb,
  http_status integer,
  response_body jsonb,
  request_id bigint,
  sent_at timestamptz not null default now()
);

comment on table public.push_log is
  'T5.2: Auditoria de envios push Expo (append-only). http_status pendente preenchimento async (T5.3 polling net._http_response).';
comment on column public.push_log.id is 'PK uuid (gen_random_uuid).';
comment on column public.push_log.match_id is 'Match alvo (SET NULL se partida apagada). NULL em mensalista-only.';
comment on column public.push_log.user_id is 'Usuario destinatario (CASCADE no delete do perfil).';
comment on column public.push_log.expo_token is 'Snapshot do token Expo enviado (text).';
comment on column public.push_log.kind is 'Tipo: monthly_reminder | recap_48h | match_reminder.';
comment on column public.push_log.title is 'Titulo enviado no push.';
comment on column public.push_log.body is 'Corpo enviado no push.';
comment on column public.push_log.payload is 'Snapshot completo do body Expo (jsonb, inclui data p/ deep-link).';
comment on column public.push_log.http_status is 'STATUS HTTP da Expo. NULL neste T5.2 (fire-and-forget). Populado em T5.3.';
comment on column public.push_log.response_body is 'Resposta completa da Expo. NULL neste T5.2.';
comment on column public.push_log.request_id is 'ID retornado por net.http_post (JOIN futuro com net._http_response).';
comment on column public.push_log.sent_at is 'Timestamp UTC da chamada net.http_post.';

create index if not exists push_log_kind_sent_at_idx
  on public.push_log(kind, sent_at desc);

comment on index public.push_log_kind_sent_at_idx is
  'T5.2: Busca rapida de envios por tipo + mais recentes (dashboard admin).';

-- RLS: apenas admin consulta auditoria. Tokens aderem ao destinatario
-- no escopo private (perfil) - nao expondo para membros comuns do grupo.
alter table public.push_log enable row level security;

drop policy if exists push_log_select_admin_policy on public.push_log;
create policy push_log_select_admin_policy on public.push_log
  for select
  to authenticated
  using (public.is_admin());

comment on policy push_log_select_admin_policy on public.push_log is
  'T5.2: Auditoria push so legivel por admin (is_admin). Leitura anon negada por ausencia de grant.';

-- ---------------------------------------------------------------------
-- 2. FUNCTION public.get_active_push_tokens(p_group_id)
-- ---------------------------------------------------------------------
-- Retorna TABLE(expo_push_token, user_id, user_name) dos tokens cujo
-- usuario tem group_id NOT NULL (opcionamente filtrado por p_group_id).
-- NOTA: device_tokens NAO tem coluna `ativo` - todos tokens considerados
-- ativos por default neste T5.2 (futuro: flag invalidated p/ dispositivos
-- desinstalados via response 4xx -> T5.3 cleanup).
--
-- SECURITY DEFINER: jobs pg_cron rodam como postgres (bypassa RLS), mas
-- mantemos SECURITY DEFINER para permitir reuse via service_role ou
-- trigger admin (consistent com T5.1 pattern).
drop function if exists public.get_active_push_tokens(uuid);

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
declare
  v_count integer;
begin
  -- Pre-contar para RAISE NOTICE com contagem confiavel (apos return query
  -- a semantica de FOUND em funcoes RETURNS TABLE nao e confiavel).
  select count(*) into v_count
    from public.device_tokens dt
    join public.profiles p on p.id = dt.user_id
    where p.group_id is not null
      and (p_group_id is null or p.group_id = p_group_id);

  raise notice 'T5.2: get_active_push_tokens(group=%) -> % linhas',
    coalesce(p_group_id::text, 'TODOS'), v_count;

  return query
    select
      dt.expo_push_token,
      p.id            as user_id,
      p.full_name     as user_name
    from public.device_tokens dt
    join public.profiles p on p.id = dt.user_id
    where p.group_id is not null
      and (p_group_id is null or p.group_id = p_group_id);
end;
$$;

comment on function public.get_active_push_tokens(uuid) is
  'T5.2: Lista tokens Expo ativos (DEVICE_TOKENS join PROFILES com group_id NOT NULL). Filtragem opcional por p_group_id. Considera todos tokens como ativos (sem flag ativo neste scope).';

-- ---------------------------------------------------------------------
-- 3. FUNCTION public.dispatch_push(p_kind, p_match_id)
-- ---------------------------------------------------------------------
-- Dispara POST para Expo Push API v2:
--   URL CANONICA: https://exp.host/api/v2/push/send
--   (NAO usar /--/api/v2/p2/send nem variantes - handoff outdated).
--
-- Fluxo:
--   (1) SET LOCAL app.expo_token via vault.decrypted_secret (transacao).
--   (2) Se token ausente -> RAISE WARNING + return silencioso (nao falha
--       o job: apenas loga. Configuracao do operador pendente).
--   (3) Monta title/body/data conforme p_kind.
--   (4) Busca tokens via get_active_push_tokens(null) (TODOS os grupos).
--   (5) Chunk em batches de 100 (rate limit Expo 600/s com margem).
--   (6) net.http_post por batch -> grava request_id (bigint).
--   (7) Insert em push_log 1 linha/token (http_status NULL: scope T5.2).
--
-- Parametros:
--   p_kind:     'monthly_reminder' | 'recap_48h' | 'match_reminder'
--   p_match_id: opcional (recap_48h e match_reminder mensalistas-only null)
drop function if exists public.dispatch_push(text, uuid);

create or replace function public.dispatch_push(p_kind text, p_match_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request_id bigint;
  v_title      text;
  v_body       text;
  v_data       jsonb;
  v_match_dt   timestamptz;
  v_time_brt   text;
  v_confirmed  integer;
  v_batch_idx  integer := 0;
  v_total      integer := 0;
begin
  -- (1) Injetar token do Vault (somente nesta transacao).
  set local app.expo_token = (
    select vault.decrypted_secret('expo_access_token')
  );

  -- (2) Se token ausente/empty -> aborta silencioso.
  -- current_setting(missing_ok=true) -> NULL se ausente sem throw.
  if current_setting('app.expo_token', true) is null
     or btrim(current_setting('app.expo_token', true)) = '' then
    raise warning 'T5.2: expo token ausente no vault; abortando dispatch (kind=%)', p_kind;
    return;
  end if;

  -- (3) Montar payload por kind.
  v_data := jsonb_build_object('kind', p_kind, 'match_id', p_match_id);

  case p_kind
    when 'monthly_reminder' then
      v_title := 'Reveja suas mensalidades';
      v_body  := 'Confirme os pagamentos pendentes no app.';

    when 'recap_48h' then
      -- Buscar data/hora do match + count confirmados (se p_match_id).
      if p_match_id is not null then
        select m.date_time into v_match_dt
          from public.matches m
          where m.id = p_match_id;

        select count(*) into v_confirmed
          from public.match_presences mp
          where mp.match_id = p_match_id
            and mp.status = 'confirmed';

        if v_match_dt is not null then
          v_time_brt := to_char(v_match_dt at time zone 'America/Sao_Paulo', 'HH24:MI');
        else
          v_time_brt := '--:--';
          v_confirmed := 0;
        end if;

        v_title := 'Jogo as ' || v_time_brt || ' quinta';
        v_body  := coalesce(v_confirmed, 0) || ' confirmados. Confirme sua presenca!';
      else
        -- Sem match explicito: fallback generico.
        v_title := 'Jogo nesta quinta';
        v_body  := 'Confirme sua presenca na lista!';
      end if;

    when 'match_reminder' then
      v_title := 'Lembrete: jogo hoje';
      v_body  := 'O jogo comeca as 18:30. Confirme presenca!';

    else
      raise warning 'T5.2: kind desconhecido "%" - abortando dispatch', p_kind;
      return;
  end case;

  raise notice 'T5.2: dispatch kind=% title="%" body="%"',
    p_kind, v_title, v_body;

  -- (4) Snapshot tokens em temp table (token + user_id + user_name).
  -- Razao: cursor implicito + cache em scalar perde afiliacao do user
  -- ao longo do batch. Temp table permite JOIN preciso na auditoria.
  create temp table _push_targets (
    rn         bigint,
    expo_token text not null,
    user_id    uuid not null,
    user_name  text
  ) on commit drop;

  insert into _push_targets (rn, expo_token, user_id, user_name)
  select row_number() over (), t.expo_push_token, t.user_id, t.user_name
    from public.get_active_push_tokens(null) t;

  -- (5) Loop em batches de 100 via offset (rate limit Expo 600/s + margem).
  <<batch_loop>>
  for v_batch_idx in 1..ceil((select count(*)::numeric / 100.0) from _push_targets)::integer loop
    -- (6) POST para Expo Push API v2 (endpoint canonico).
    select net.http_post(
      url     := 'https://exp.host/api/v2/push/send',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.expo_token', true)
      ),
      body    := jsonb_build_object(
        'to',    (select jsonb_agg(expo_token) from _push_targets
                  where rn between (v_batch_idx - 1) * 100 + 1 and v_batch_idx * 100),
        'title', v_title,
        'body',  v_body,
        'data',  v_data
      )
    ) into v_request_id;

    -- (7) Auditoria 1 linha/token (http_status NULL: preenchimento T5.3).
    insert into public.push_log (
      match_id, user_id, expo_token, kind, title, body, payload, request_id
    )
    select
      p_match_id, pt.user_id, pt.expo_token, p_kind, v_title, v_body,
      jsonb_build_object(
        'to',    (select jsonb_agg(expo_token) from _push_targets
                  where rn between (v_batch_idx - 1) * 100 + 1 and v_batch_idx * 100),
        'title', v_title,
        'body',  v_body,
        'data',  v_data
      ),
      v_request_id
    from _push_targets pt
    where pt.rn between (v_batch_idx - 1) * 100 + 1 and v_batch_idx * 100;

    v_total := v_total + (
      select count(*) from _push_targets
      where rn between (v_batch_idx - 1) * 100 + 1 and v_batch_idx * 100
    );

    raise notice 'T5.2: batch #% enviado (count=%, request_id=%)',
      v_batch_idx,
      (select count(*) from _push_targets
       where rn between (v_batch_idx - 1) * 100 + 1 and v_batch_idx * 100),
      coalesce(v_request_id::text, 'NULL');
  end loop batch_loop;

  raise notice 'T5.2: dispatch concluido kind=% batches=% tokens_totais=%',
    p_kind, v_batch_idx, v_total;

  drop table if exists _push_targets;
end;
$$;

comment on function public.dispatch_push(text, uuid) is
  'T5.2: Dispatch push Expo via pg_net. Token injetado via SET LOCAL app.expo_token (Vault). Batches de 100 (rate limit Expo 600/s). http_status em push_log fica NULL neste scope (fire-and-forget); preenchimento assincrono futuro em T5.3.';

-- ---------------------------------------------------------------------
-- 4. CRON JOBS (schedule apos functions prontas)
-- ---------------------------------------------------------------------
-- pg_cron UTC puro. BRT = UTC-3 fixo (sem DST desde 2019).
--
-- Schedule BRT -> UTC:
-- | Job                  | BRT      | UTC      | cron         |
-- |----------------------|----------|----------|--------------|
-- | push_monthly_reminder| Seg 09:00| Seg 12:00| '0 12 * * 1' |
-- | push_recap_48h       | Ter 19:00| Ter 22:00| '0 22 * * 2' |
-- | push_match_reminder  | Qui 18:00| Qui 21:00| '0 21 * * 4' |
--
-- p_match_id NULL em mensalista-only (job sem contexto de partida).
-- recap_48h/match_reminder: p_match_id null neste job baseline -
--   dispatch_push tem fallback generico quando match_id IS NULL.
--   Evolucao (T5.3+): injetar query que encontre partida da semana.

select cron.schedule(
  'push_monthly_reminder',
  '0 12 * * 1',
  $$ select public.dispatch_push('monthly_reminder', null); $$
);

select cron.schedule(
  'push_recap_48h',
  '0 22 * * 2',
  $$ select public.dispatch_push('recap_48h', null); $$
);

select cron.schedule(
  'push_match_reminder',
  '0 21 * * 4',
  $$ select public.dispatch_push('match_reminder', null); $$
);

comment on schema cron is 'Scheduler p/ jobs BRT (mensalidades dia 5 T5.1, pushes Seg/Ter/Qui T5.2).';

-- =====================================================================
-- FIM da migration T5.2
-- Resumo:
--   Tabela:    1 (push_log, append-only, RLS admin-only)
--   Index:     1 (push_log_kind_sent_at_idx)
--   Functions: 2 SECURITY DEFINER (get_active_push_tokens, dispatch_push)
--   Cron jobs: 3 (Seg 12:00 UTC, Ter 22:00 UTC, Qui 21:00 UTC = BRT -3h)
--
-- PENDENCIAS FUTURAS (T5.3):
--   P1. Preencher push_log.http_status async via poll net._http_response
--       ou trigger AFTER INSERT (resolver 429/400 logging).
--   P2. Invalidar tokens 4xx (DeviceNotRegistered) -> flag invalidated em
--       device_tokens (nova coluna) + cleanup automatico.
--   P3. Contextualizar recap_48h/match_reminder com o match_id da semana:
--       sub-query dentro do job para listar partida mais proxima.
-- =====================================================================
