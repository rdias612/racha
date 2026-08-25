-- 077_configuracoes_notificacoes.sql
--
-- Gestão de Notificações Push no Painel de Administração:
-- 1. Cria a tabela singleton `notificacoes_config`.
-- 2. Relaxa o CHECK de `reminder_key` em `push_reminder_deliveries` para suportar 'reforco'.
-- 3. RPC `obter_configuracoes_notificacoes(p_admin_id bigint)` (STABLE).
-- 4. RPC `salvar_configuracoes_notificacoes(p_admin_id bigint, p_config jsonb)` (VOLATILE).
-- 5. RPC `disparar_confirmacao_manual(p_admin_id bigint, p_partida_id bigint)`.
-- 6. RPC `disparar_push_teste(p_admin_id bigint)`.
-- 7. Reagendamento do cron `enviar-push-reminders-1min` (votação + reforço).

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 1. Tabela singleton notificacoes_config
CREATE TABLE IF NOT EXISTS notificacoes_config (
  id                          integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  confirmacao_ativo           boolean NOT NULL DEFAULT true,
  confirmacao_dia_semana      smallint NOT NULL DEFAULT 1 CHECK (confirmacao_dia_semana BETWEEN 1 AND 3),
  confirmacao_horario         time NOT NULL DEFAULT '10:00' CHECK (confirmacao_horario < time '21:00'),
  confirmacao_titulo          text CHECK (char_length(confirmacao_titulo) <= 120),
  confirmacao_mensagem        text CHECK (char_length(confirmacao_mensagem) <= 500),
  reforco_ativo               boolean NOT NULL DEFAULT true,
  reforco_horas_antes_prazo   smallint NOT NULL DEFAULT 4 CHECK (reforco_horas_antes_prazo BETWEEN 1 AND 48),
  reforco_titulo              text CHECK (char_length(reforco_titulo) <= 120),
  reforco_mensagem            text CHECK (char_length(reforco_mensagem) <= 500),
  votacao_ativo               boolean NOT NULL DEFAULT true,
  votacao_bucket_6h           boolean NOT NULL DEFAULT true,
  votacao_bucket_3h           boolean NOT NULL DEFAULT true,
  votacao_bucket_1h           boolean NOT NULL DEFAULT true,
  votacao_bucket_30m          boolean NOT NULL DEFAULT true,
  votacao_template_6h_titulo  text CHECK (char_length(votacao_template_6h_titulo) <= 120),
  votacao_template_6h_msg     text CHECK (char_length(votacao_template_6h_msg) <= 500),
  votacao_template_3h_titulo  text CHECK (char_length(votacao_template_3h_titulo) <= 120),
  votacao_template_3h_msg     text CHECK (char_length(votacao_template_3h_msg) <= 500),
  votacao_template_1h_titulo  text CHECK (char_length(votacao_template_1h_titulo) <= 120),
  votacao_template_1h_msg     text CHECK (char_length(votacao_template_1h_msg) <= 500),
  votacao_template_30m_titulo text CHECK (char_length(votacao_template_30m_titulo) <= 120),
  votacao_template_30m_msg    text CHECK (char_length(votacao_template_30m_msg) <= 500),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  updated_by                  bigint REFERENCES jogadores(id),
  CONSTRAINT notificacoes_config_dia_hora_valido CHECK (
    confirmacao_dia_semana < 3 OR confirmacao_horario < time '16:00'
  )
);

-- Seed singleton (garante existência da linha padrão)
INSERT INTO notificacoes_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Restringe escrita direta: client só altera via RPC; Edge Functions lêem via service_role
REVOKE ALL ON notificacoes_config FROM anon, authenticated;
GRANT SELECT ON notificacoes_config TO service_role;

-- 2. Relaxa o CHECK de reminder_key em push_reminder_deliveries (preservando o formato histórico)
ALTER TABLE push_reminder_deliveries
  DROP CONSTRAINT IF EXISTS push_reminder_deliveries_reminder_key_check;

ALTER TABLE push_reminder_deliveries
  ADD CONSTRAINT push_reminder_deliveries_reminder_key_check
  CHECK (
    reminder_key IN ('6h','3h','1h','30m','confirmacao','reforco')
    OR reminder_key ~ '^([01][0-9]|2[0-3]):(00|15|30|45)$'
  );

-- 3. RPC obter_configuracoes_notificacoes(p_admin_id bigint)
CREATE OR REPLACE FUNCTION obter_configuracoes_notificacoes(p_admin_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_res jsonb;
BEGIN
  SELECT is_admin INTO v_is_admin FROM jogadores WHERE id = p_admin_id;
  IF v_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso restrito a administradores.';
  END IF;

  SELECT to_jsonb(c) INTO v_res FROM notificacoes_config c WHERE c.id = 1;
  RETURN v_res;
END;
$$;

GRANT EXECUTE ON FUNCTION obter_configuracoes_notificacoes(bigint) TO anon, authenticated;

-- 4. RPC salvar_configuracoes_notificacoes(p_admin_id bigint, p_config jsonb)
CREATE OR REPLACE FUNCTION salvar_configuracoes_notificacoes(
  p_admin_id bigint,
  p_config   jsonb
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $rpc$
DECLARE
  v_is_admin   boolean;
  v_dia_semana smallint;
  v_horario    time;
  v_minuto     integer;
  v_hora_utc   integer;
  v_cron_expr  text;
  v_reagendar  boolean := false;
BEGIN
  SELECT is_admin INTO v_is_admin FROM jogadores WHERE id = p_admin_id;
  IF v_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso restrito a administradores.';
  END IF;

  IF p_config IS NULL THEN
    RETURN false;
  END IF;

  IF p_config ? 'confirmacao_dia_semana' OR p_config ? 'confirmacao_horario' THEN
    v_reagendar := true;
  END IF;

  UPDATE notificacoes_config
  SET
    confirmacao_ativo = COALESCE((p_config->>'confirmacao_ativo')::boolean, confirmacao_ativo),
    confirmacao_dia_semana = COALESCE((p_config->>'confirmacao_dia_semana')::smallint, confirmacao_dia_semana),
    confirmacao_horario = COALESCE((p_config->>'confirmacao_horario')::time, confirmacao_horario),
    confirmacao_titulo = CASE WHEN p_config ? 'confirmacao_titulo' THEN (p_config->>'confirmacao_titulo') ELSE confirmacao_titulo END,
    confirmacao_mensagem = CASE WHEN p_config ? 'confirmacao_mensagem' THEN (p_config->>'confirmacao_mensagem') ELSE confirmacao_mensagem END,
    reforco_ativo = COALESCE((p_config->>'reforco_ativo')::boolean, reforco_ativo),
    reforco_horas_antes_prazo = COALESCE((p_config->>'reforco_horas_antes_prazo')::smallint, reforco_horas_antes_prazo),
    reforco_titulo = CASE WHEN p_config ? 'reforco_titulo' THEN (p_config->>'reforco_titulo') ELSE reforco_titulo END,
    reforco_mensagem = CASE WHEN p_config ? 'reforco_mensagem' THEN (p_config->>'reforco_mensagem') ELSE reforco_mensagem END,
    votacao_ativo = COALESCE((p_config->>'votacao_ativo')::boolean, votacao_ativo),
    votacao_bucket_6h = COALESCE((p_config->>'votacao_bucket_6h')::boolean, votacao_bucket_6h),
    votacao_bucket_3h = COALESCE((p_config->>'votacao_bucket_3h')::boolean, votacao_bucket_3h),
    votacao_bucket_1h = COALESCE((p_config->>'votacao_bucket_1h')::boolean, votacao_bucket_1h),
    votacao_bucket_30m = COALESCE((p_config->>'votacao_bucket_30m')::boolean, votacao_bucket_30m),
    votacao_template_6h_titulo = CASE WHEN p_config ? 'votacao_template_6h_titulo' THEN (p_config->>'votacao_template_6h_titulo') ELSE votacao_template_6h_titulo END,
    votacao_template_6h_msg = CASE WHEN p_config ? 'votacao_template_6h_msg' THEN (p_config->>'votacao_template_6h_msg') ELSE votacao_template_6h_msg END,
    votacao_template_3h_titulo = CASE WHEN p_config ? 'votacao_template_3h_titulo' THEN (p_config->>'votacao_template_3h_titulo') ELSE votacao_template_3h_titulo END,
    votacao_template_3h_msg = CASE WHEN p_config ? 'votacao_template_3h_msg' THEN (p_config->>'votacao_template_3h_msg') ELSE votacao_template_3h_msg END,
    votacao_template_1h_titulo = CASE WHEN p_config ? 'votacao_template_1h_titulo' THEN (p_config->>'votacao_template_1h_titulo') ELSE votacao_template_1h_titulo END,
    votacao_template_1h_msg = CASE WHEN p_config ? 'votacao_template_1h_msg' THEN (p_config->>'votacao_template_1h_msg') ELSE votacao_template_1h_msg END,
    votacao_template_30m_titulo = CASE WHEN p_config ? 'votacao_template_30m_titulo' THEN (p_config->>'votacao_template_30m_titulo') ELSE votacao_template_30m_titulo END,
    votacao_template_30m_msg = CASE WHEN p_config ? 'votacao_template_30m_msg' THEN (p_config->>'votacao_template_30m_msg') ELSE votacao_template_30m_msg END,
    updated_at = now(),
    updated_by = p_admin_id
  WHERE id = 1
  RETURNING confirmacao_dia_semana, confirmacao_horario INTO v_dia_semana, v_horario;

  IF v_reagendar THEN
    v_minuto := EXTRACT(MINUTE FROM v_horario)::integer;
    v_hora_utc := (EXTRACT(HOUR FROM v_horario)::integer + 3) % 24;
    v_cron_expr := format('%s %s * * %s', v_minuto, v_hora_utc, v_dia_semana);

    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'agendar-partida-semanal') THEN
      PERFORM cron.unschedule('agendar-partida-semanal');
    END IF;

    PERFORM cron.schedule(
      'agendar-partida-semanal',
      v_cron_expr,
      $semanal$
      DO $$
      DECLARE
        v_partida_id bigint;
        v_secret     text;
      BEGIN
        SELECT criar_partida_semanal_mensalistas() INTO v_partida_id;
        IF v_partida_id IS NOT NULL THEN
          SELECT decrypted_secret INTO v_secret
            FROM vault.decrypted_secrets
            WHERE name = 'push_cron_secret'
            LIMIT 1;
          PERFORM net.http_post(
            url := 'https://jtavmrlllyctkuxefhpc.supabase.co/functions/v1/send-confirmation-requests',
            headers := jsonb_build_object(
              'Content-Type', 'application/json',
              'x-push-cron-secret', v_secret
            ),
            body := jsonb_build_object('partida_id', v_partida_id)
          );
        END IF;
      END $$;
      $semanal$
    );
  END IF;

  RETURN true;
END;
$rpc$;

GRANT EXECUTE ON FUNCTION salvar_configuracoes_notificacoes(bigint, jsonb) TO anon, authenticated;

-- 5. RPC disparar_confirmacao_manual(p_admin_id bigint, p_partida_id bigint)
CREATE OR REPLACE FUNCTION disparar_confirmacao_manual(
  p_admin_id   bigint,
  p_partida_id bigint
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin   boolean;
  v_status     text;
  v_secret     text;
BEGIN
  SELECT is_admin INTO v_is_admin FROM jogadores WHERE id = p_admin_id;
  IF v_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso restrito a administradores.';
  END IF;

  SELECT status INTO v_status FROM partidas WHERE id = p_partida_id;
  IF v_status IS NULL OR v_status <> 'draft' THEN
    RAISE EXCEPTION 'Partida inválida ou não está em rascunho (draft).';
  END IF;

  SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets
    WHERE name = 'push_cron_secret'
    LIMIT 1;

  PERFORM net.http_post(
    url := 'https://jtavmrlllyctkuxefhpc.supabase.co/functions/v1/send-confirmation-requests',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-cron-secret', v_secret
    ),
    body := jsonb_build_object('partida_id', p_partida_id, 'reenviar', true)
  );

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION disparar_confirmacao_manual(bigint, bigint) TO anon, authenticated;

-- 6. RPC disparar_push_teste(p_admin_id bigint)
CREATE OR REPLACE FUNCTION disparar_push_teste(
  p_admin_id bigint
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_secret   text;
BEGIN
  SELECT is_admin INTO v_is_admin FROM jogadores WHERE id = p_admin_id;
  IF v_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso restrito a administradores.';
  END IF;

  SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets
    WHERE name = 'push_cron_secret'
    LIMIT 1;

  PERFORM net.http_post(
    url := 'https://jtavmrlllyctkuxefhpc.supabase.co/functions/v1/send-test-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-cron-secret', v_secret
    ),
    body := jsonb_build_object('jogador_id', p_admin_id)
  );

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION disparar_push_teste(bigint) TO anon, authenticated;

-- 7. Reagendamento do cron de 1 minuto para push reminders (Votação + Reforço de Confirmação)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'enviar-lembretes-votacao-1min') THEN
    PERFORM cron.unschedule('enviar-lembretes-votacao-1min');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'enviar-lembretes-votacao-15min') THEN
    PERFORM cron.unschedule('enviar-lembretes-votacao-15min');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'enviar-push-reminders-1min') THEN
    PERFORM cron.unschedule('enviar-push-reminders-1min');
  END IF;
END;
$$;

SELECT cron.schedule(
  'enviar-push-reminders-1min',
  '* * * * *',
  $push_job$
  DO $$
  DECLARE
    v_secret text;
  BEGIN
    SELECT decrypted_secret INTO v_secret
      FROM vault.decrypted_secrets
      WHERE name = 'push_cron_secret'
      LIMIT 1;

    -- 1. Lembretes de Votação
    PERFORM net.http_post(
      url := 'https://jtavmrlllyctkuxefhpc.supabase.co/functions/v1/send-voting-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-push-cron-secret', v_secret
      ),
      body := '{}'::jsonb
    );

    -- 2. Reforço de Confirmação de Presença
    PERFORM net.http_post(
      url := 'https://jtavmrlllyctkuxefhpc.supabase.co/functions/v1/send-confirmation-requests',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-push-cron-secret', v_secret
      ),
      body := '{}'::jsonb
    );
  END $$;
  $push_job$
);
