-- =====================================================================
-- Migration: 00000000000010_vault.sql
-- Task: T5.0 - Supabase Vault secret p/ Expo access token (pg_cron dispatch)
-- Stack: PostgreSQL 15 / Supabase Vault (+ pg_cron + pg_net em T5.2)
--
-- OBJETIVO:
--   Resolver blocker H3: armazenar EXPO_ACCESS_TOKEN de forma segura fora
--   do APK e fora de migrations versionadas. O Supabase Vault guarda o
--   secret server-side; jobs pg_cron (T5.2) injetam o token via
--   `SET LOCAL app.expo_token = (SELECT vault.decrypted_secret(...))`.
--
-- MODELO DE AMEACA (B-H1 / B-H3):
--   * APK e disassemblavel -> NUNCA empacotar SERVICE_ROLE ou EXPO_ACCESS_TOKEN.
--   * .env.example (cliente) so EXPO_PUBLIC_*; .env.server.example so dev/migrations.
--   * Migration NUNCA commita token literal - placeholder abaixo.
--
-- COMPONENTES:
--   1. Criar secret 'expo_access_token' (placeholder) no schema `vault`.
--      Idempotente via checagem em vault.secret (nao reescreve se ja existe
--      com valor real setado via dashboard/CLI).
--   2. Garantir permissoes: roles `postgres`/`service_role` leem o secret;
--      `anon`/`authenticated` NAO leem (RLS do Vault + GRANT restritivo).
--   3. Helper SQL documentado: `vault.decrypted_secret('expo_access_token')`.
--
-- DEPENDENCIAS: T1.3a (extensao `vault` ja criada em 00000000000001_schema.sql).
-- IDEMPOTENCIA: DO block checa existence por `name` antes de criar.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Sanity: extensao vault deve estar presente (criada em T1.3a).
-- ---------------------------------------------------------------------
-- `vault` ja vem habilitada por default no Supabase; T1.3a tambem da CREATE
-- EXTENSION IF NOT EXISTS implicito via schema public.coment. Aqui soh
-- garantimos o schema para a chamada qualificada.
do $$
begin
  if not exists (
    select 1 from pg_extension where extname = 'supabase_vault'
  ) then
    raise exception 'T5.0: extensao supabase_vault ausente. Habilite em Dashboard > Database > Extensions ou CREATE EXTENSION supabase_vault; (T1.3a deveria ter feito).';
  end if;
end
$$;

-- ---------------------------------------------------------------------
-- 1. Criar secret 'expo_access_token' (PLACEHOLDER - ver instrucoes abaixo)
-- ---------------------------------------------------------------------
-- IMPORTANTE: o valor abaixo e PLACEHOLDER. Nunca commitamos o token real.
-- Para PRODUCAO/DEV remoto:
--   (a) Apos `supabase db push`, va em Dashboard > Database > Secrets
--       (ou SQL Editor) e rode:
--         UPDATE vault.secrets
--         SET secret = '<TOKEN_REAL_EXPO>'
--         WHERE name = 'expo_access_token';
--   (b) Ou via psql puro:
--         SELECT vault.update_secret_name_or_value('expo_access_token', '<TOKEN>');
--   (c) Local dev: `supabase db reset` re-aplica placeholder; re-sete o real.
--
-- Idempotencia: se o nome ja existe (re-run, ou ja populado via dashboard),
-- NAO sobrescrevemos para nao apagar token real configurado pelo operador.
do $$
declare
  v_existing_name text;
begin
  select name into v_existing_name
    from vault.secrets
    where name = 'expo_access_token'
    limit 1;

  if v_existing_name is null then
    perform vault.create_secret(
      'PLACEHOLDER_SET_VIA_DASHBOARD',                 -- new_secret (trocar!)
      'expo_access_token',                             -- new_name
      'Bearer token p/ Expo Push API (T5.0). Sete valor real via Dashboard > Secrets.'  -- new_description
    );
    raise notice 'T5.0: secret "expo_access_token" criado (placeholder).';
  else
    raise notice 'T5.0: secret "expo_access_token" ja existe -> preservando valor (nao sobrescrever token real).';
  end if;
end
$$;

-- ---------------------------------------------------------------------
-- 2. Permissoes (defesa em profundidade alem do RLS do Vault)
-- ---------------------------------------------------------------------
-- O schema `vault` ja aplica RLS que restringe leitura a roles privilegiadas
-- (postgres + service_role). Negamos explicitamente a anon/authenticated por
-- redundancia: mesmo um futuro `GRANT` acidental nao abre leak se RLS falhar.
--
-- Nota: Nao concedemos a `authenticated` - jobs pg_cron rodam como `postgres`
-- (SECURITY DEFINER na function de dispatch T5.2); clients mobile usam anon
-- key e jamais devem tocar o Vault.
revoke all on schema vault from public, anon, authenticated;
revoke all on all tables in schema vault from public, anon, authenticated;
revoke all on all functions in schema vault from public, anon, authenticated;

-- service_role precisa ler decrypted_secret (bypass RLS, porem explicitamos).
grant usage on schema vault to service_role;
grant select on vault.decrypted_secrets to service_role;

comment on schema vault is 'T5.0: Vault guarda expo_access_token. Acesso NEGADO a anon/authenticated; somente service_role/postgres.';
comment on column vault.decrypted_secrets.secret is 'T5.0: NUNCA expor via API anon/authenticated. Leitura soh via cron/dispatch (T5.2).';

-- ---------------------------------------------------------------------
-- 3. Padrao de uso em jobs pg_cron (T5.2) - DOCUMENTACAO INLINE
-- ---------------------------------------------------------------------
-- job SQL de dispatch deve abrir com:
--
--   SET LOCAL app.expo_token = (
--     SELECT vault.decrypted_secret('expo_access_token')
--   );
--
-- Depois usar current_setting('app.expo_token') no header Authorization
-- do pg_net.http_post:
--
--   select net.http_post(
--     url    := 'https://exp.host/api/v2/push/send',
--     headers := jsonb_build_object(
--       'Content-Type',  'application/json',
--       'Authorization', 'Bearer ' || current_setting('app.expo_token')
--     ),
--     body   := ...  -- payload Expo Push
--   );
--
-- Vantagem de SET LOCAL:
--   * Setting dura apenas a transacao do job -> nao persiste em `pg_settings`.
--   * Token real resfria no Vault; nao vaza em pg_stat_statements / logs
--     (a menos que RAISE NOTICE imprima - evite logar current_setting).
--
-- Query de validacao (rodar manualmente):
--   SELECT vault.decrypted_secret('expo_access_token');
--   -> deve retornar o bearer real (depois do handoff no dashboard).

-- =====================================================================
-- FIM da migration T5.0
-- Resumo:
--   * 1 secret vault 'expo_access_token' (placeholder) -> setar real manual.
--   * Permissoes restritivas: anon/authenticated REVOKED, service_role GRANT.
--   * Pattern SET LOCAL app.expo_token documentado (consumido por T5.2).
-- Handoff (fora do commit):
--   UPDATE vault.secrets SET secret='<real>' WHERE name='expo_access_token';
-- =====================================================================
