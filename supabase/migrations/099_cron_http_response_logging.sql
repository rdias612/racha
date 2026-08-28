-- 099_cron_http_response_logging.sql
--
-- Implementa logging e verificação de resposta HTTP nas chamadas de Edge Functions
-- disparadas por cron jobs e RPCs administrativas (P1-16 do plano de refatorações).
--
-- 1. Cria a tabela `cron_execucoes` para auditoria e histórico de execuções com retenção de 30 dias.
-- 2. Cria a função central `disparar_e_registrar_cron_http` com timeout, captura de código HTTP,
--    coleta de corpo de resposta ou mensagem de erro, gravação em `cron_execucoes` e limpeza automática.
-- 3. Cria a função `obter_execucoes_cron` para consulta administrativa das últimas execuções.
-- 4. Atualiza as RPCs `disparar_confirmacao_manual`, `disparar_push_teste` e `salvar_configuracoes_notificacoes`
--    para utilizarem o novo pipeline de disparo com registro e tratamento de secret nulo.
-- 5. Reagenda os cron jobs `enviar-push-reminders-1min` e `agendar-partida-semanal` integrados ao logging.
-- 6. Concede permissões e grants nos padrões canônicos de segurança (AGENTS.md).

-- ----------------------------------------------------------------------------
-- 1. TABELA DE AUDITORIA DE EXECUÇÕES DE CRON / EDGE FUNCTIONS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cron_execucoes (
  id           bigserial PRIMARY KEY,
  job_nome     text NOT NULL,
  status_code  integer,
  sucesso      boolean NOT NULL DEFAULT false,
  resposta     text,
  erro         text,
  executado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cron_execucoes_job_data ON cron_execucoes (job_nome, executado_em DESC);
CREATE INDEX IF NOT EXISTS idx_cron_execucoes_sucesso ON cron_execucoes (sucesso, executado_em DESC);

-- ----------------------------------------------------------------------------
-- 2. FUNÇÃO DISPARADORA COM LOGGING E RETENÇÃO AUTOMÁTICA
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION disparar_e_registrar_cron_http(
  p_job_nome   text,
  p_url        text,
  p_headers    jsonb,
  p_body       jsonb DEFAULT '{}'::jsonb,
  p_timeout_ms integer DEFAULT 8000
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request_id      bigint;
  v_status_code     integer;
  v_resposta        text;
  v_erro            text;
  v_sucesso         boolean := false;
  v_execucao_id     bigint;
  v_start_time      timestamptz := clock_timestamp();
  v_collected       boolean := false;
  v_timeout_efetivo integer;
BEGIN
  IF p_job_nome IS NULL OR p_url IS NULL THEN
    INSERT INTO cron_execucoes (job_nome, sucesso, erro)
    VALUES (COALESCE(p_job_nome, 'desconhecido'), false, 'Parâmetros inválidos: job_nome ou url nulo.')
    RETURNING id INTO v_execucao_id;
    RETURN v_execucao_id;
  END IF;

  v_timeout_efetivo := LEAST(GREATEST(COALESCE(p_timeout_ms, 8000), 1000), 30000);

  -- 1) Disparo da requisição HTTP via pg_net
  BEGIN
    SELECT net.http_post(
      url := p_url,
      headers := COALESCE(p_headers, '{}'::jsonb),
      body := COALESCE(p_body, '{}'::jsonb),
      timeout_milliseconds := v_timeout_efetivo
    ) INTO v_request_id;
  EXCEPTION WHEN OTHERS THEN
    v_erro := format('Falha ao disparar net.http_post: %s (%s)', SQLERRM, SQLSTATE);
    v_sucesso := false;
  END;

  -- 2) Coleta e verificação da resposta com timeout
  IF v_request_id IS NOT NULL THEN
    WHILE (EXTRACT(EPOCH FROM (clock_timestamp() - v_start_time)) * 1000) < v_timeout_efetivo LOOP
      BEGIN
        -- Tenta consultar a tabela de respostas do pg_net
        SELECT
          status_code,
          body,
          error_msg
        INTO
          v_status_code,
          v_resposta,
          v_erro
        FROM net._http_response
        WHERE id = v_request_id;

        IF FOUND THEN
          v_collected := true;
          EXIT;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        -- Fallback para função wrapper se tabela interna não estiver acessível
        BEGIN
          SELECT
            (res).response.status_code,
            (res).response.body,
            (res).message
          INTO
            v_status_code,
            v_resposta,
            v_erro
          FROM net.http_collect_response(v_request_id, false) AS res;

          IF v_status_code IS NOT NULL OR v_erro IS NOT NULL THEN
            v_collected := true;
            EXIT;
          END IF;
        EXCEPTION WHEN OTHERS THEN
          NULL;
        END;
      END;

      PERFORM pg_sleep(0.05);
    END LOOP;

    IF v_collected THEN
      IF v_status_code >= 200 AND v_status_code < 300 THEN
        v_sucesso := true;
      ELSE
        v_sucesso := false;
        IF v_erro IS NULL THEN
          v_erro := format('HTTP status %s retornado pela Edge Function.', COALESCE(v_status_code::text, 'nulo'));
        END IF;
      END IF;
    ELSE
      v_sucesso := false;
      v_erro := COALESCE(v_erro, format('Timeout aguardando resposta HTTP após %s ms.', v_timeout_efetivo));
    END IF;
  END IF;

  -- 3) Gravação do log de execução
  INSERT INTO cron_execucoes (
    job_nome,
    status_code,
    sucesso,
    resposta,
    erro,
    executado_em
  ) VALUES (
    p_job_nome,
    v_status_code,
    v_sucesso,
    substring(v_resposta FROM 1 FOR 5000),
    substring(v_erro FROM 1 FOR 2000),
    now()
  )
  RETURNING id INTO v_execucao_id;

  -- 4) Limpeza de histórico com retenção de 30 dias (defensivo)
  BEGIN
    DELETE FROM cron_execucoes
    WHERE executado_em < (now() - interval '30 days');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN v_execucao_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. RPC PARA ADMIN CONSULTAR ÚLTIMAS EXECUÇÕES DO CRON
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION obter_execucoes_cron(
  p_admin_id bigint,
  p_limite   integer DEFAULT 50
)
RETURNS TABLE (
  id           bigint,
  job_nome     text,
  status_code  integer,
  sucesso      boolean,
  resposta     text,
  erro         text,
  executado_em timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  SELECT is_admin INTO v_is_admin FROM jogadores WHERE id = p_admin_id;
  IF v_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso restrito a administradores.';
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.job_nome,
    c.status_code,
    c.sucesso,
    c.resposta,
    c.erro,
    c.executado_em
  FROM cron_execucoes c
  ORDER BY c.executado_em DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limite, 50), 1), 200);
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. ATUALIZAÇÃO DAS RPCS DE DISPARO MANUAL E CONFIGURAÇÕES
-- ----------------------------------------------------------------------------

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
  v_headers    jsonb;
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

  IF v_secret IS NULL THEN
    INSERT INTO cron_execucoes (job_nome, sucesso, erro)
    VALUES ('disparar_confirmacao_manual', false, 'Secret push_cron_secret não encontrado no vault.');
    RAISE EXCEPTION 'Secret push_cron_secret não configurado no vault.';
  END IF;

  v_headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'x-push-cron-secret', v_secret
  );

  PERFORM disparar_e_registrar_cron_http(
    'disparar_confirmacao_manual',
    'https://jtavmrlllyctkuxefhpc.supabase.co/functions/v1/send-confirmation-requests',
    v_headers,
    jsonb_build_object('partida_id', p_partida_id, 'reenviar', true)
  );

  RETURN true;
END;
$$;

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
  v_headers  jsonb;
BEGIN
  SELECT is_admin INTO v_is_admin FROM jogadores WHERE id = p_admin_id;
  IF v_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso restrito a administradores.';
  END IF;

  SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets
    WHERE name = 'push_cron_secret'
    LIMIT 1;

  IF v_secret IS NULL THEN
    INSERT INTO cron_execucoes (job_nome, sucesso, erro)
    VALUES ('disparar_push_teste', false, 'Secret push_cron_secret não encontrado no vault.');
    RAISE EXCEPTION 'Secret push_cron_secret não configurado no vault.';
  END IF;

  v_headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'x-push-cron-secret', v_secret
  );

  PERFORM disparar_e_registrar_cron_http(
    'disparar_push_teste',
    'https://jtavmrlllyctkuxefhpc.supabase.co/functions/v1/send-test-push',
    v_headers,
    jsonb_build_object('jogador_id', p_admin_id)
  );

  RETURN true;
END;
$$;

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
        v_headers    jsonb;
      BEGIN
        SELECT criar_partida_semanal_mensalistas() INTO v_partida_id;
        IF v_partida_id IS NULL THEN
          SELECT p.id INTO v_partida_id
            FROM partidas p
            WHERE p.status = 'draft'
              AND date_trunc('week', p.data_jogo AT TIME ZONE 'America/Sao_Paulo') = date_trunc('week', now() AT TIME ZONE 'America/Sao_Paulo')
            ORDER BY p.id DESC
            LIMIT 1;
        END IF;

        IF v_partida_id IS NOT NULL THEN
          SELECT decrypted_secret INTO v_secret
            FROM vault.decrypted_secrets
            WHERE name = 'push_cron_secret'
            LIMIT 1;

          IF v_secret IS NULL THEN
            INSERT INTO cron_execucoes (job_nome, sucesso, erro)
            VALUES ('agendar-partida-semanal', false, 'Secret push_cron_secret não encontrado no vault.');
            RETURN;
          END IF;

          v_headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-push-cron-secret', v_secret
          );

          PERFORM disparar_e_registrar_cron_http(
            'agendar-partida-semanal:send-confirmation-requests',
            'https://jtavmrlllyctkuxefhpc.supabase.co/functions/v1/send-confirmation-requests',
            v_headers,
            jsonb_build_object('partida_id', v_partida_id)
          );
        END IF;
      END $$;
      $semanal$
    );
  END IF;

  RETURN true;
END;
$rpc$;

-- ----------------------------------------------------------------------------
-- 5. REAGENDAMENTO DOS CRON JOBS COM LOGGING INTEGRADO
-- ----------------------------------------------------------------------------

-- 5.1 Enviar Push Reminders (1 minuto)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'enviar-lembretes-votacao-15m') THEN
    PERFORM cron.unschedule('enviar-lembretes-votacao-15m');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'enviar-lembretes-votacao-15min') THEN
    PERFORM cron.unschedule('enviar-lembretes-votacao-15min');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'enviar-lembretes-votacao-1min') THEN
    PERFORM cron.unschedule('enviar-lembretes-votacao-1min');
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
    v_secret  text;
    v_headers jsonb;
  BEGIN
    SELECT decrypted_secret INTO v_secret
      FROM vault.decrypted_secrets
      WHERE name = 'push_cron_secret'
      LIMIT 1;

    IF v_secret IS NULL THEN
      INSERT INTO cron_execucoes (job_nome, sucesso, erro)
      VALUES ('enviar-push-reminders-1min', false, 'Secret push_cron_secret não encontrado no vault.');
      RETURN;
    END IF;

    v_headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-cron-secret', v_secret
    );

    -- 1. Lembretes de Votação
    PERFORM disparar_e_registrar_cron_http(
      'send-voting-reminders',
      'https://jtavmrlllyctkuxefhpc.supabase.co/functions/v1/send-voting-reminders',
      v_headers,
      '{}'::jsonb
    );

    -- 2. Reforço de Confirmação de Presença
    PERFORM disparar_e_registrar_cron_http(
      'send-confirmation-requests',
      'https://jtavmrlllyctkuxefhpc.supabase.co/functions/v1/send-confirmation-requests',
      v_headers,
      '{}'::jsonb
    );
  END $$;
  $push_job$
);

-- 5.2 Agendar Partida Semanal (Com Horário Configurado)
DO $outer$
DECLARE
  v_dia_semana smallint;
  v_horario    time;
  v_minuto     integer;
  v_hora_utc   integer;
  v_cron_expr  text;
BEGIN
  SELECT confirmacao_dia_semana, confirmacao_horario
    INTO v_dia_semana, v_horario
    FROM notificacoes_config
    WHERE id = 1;

  IF v_dia_semana IS NULL THEN
    v_dia_semana := 1;
    v_horario := '10:00'::time;
  END IF;

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
      v_headers    jsonb;
    BEGIN
      SELECT criar_partida_semanal_mensalistas() INTO v_partida_id;
      IF v_partida_id IS NULL THEN
        SELECT p.id INTO v_partida_id
          FROM partidas p
          WHERE p.status = 'draft'
            AND date_trunc('week', p.data_jogo AT TIME ZONE 'America/Sao_Paulo') = date_trunc('week', now() AT TIME ZONE 'America/Sao_Paulo')
          ORDER BY p.id DESC
          LIMIT 1;
      END IF;

      IF v_partida_id IS NOT NULL THEN
        SELECT decrypted_secret INTO v_secret
          FROM vault.decrypted_secrets
          WHERE name = 'push_cron_secret'
          LIMIT 1;

        IF v_secret IS NULL THEN
          INSERT INTO cron_execucoes (job_nome, sucesso, erro)
          VALUES ('agendar-partida-semanal', false, 'Secret push_cron_secret não encontrado no vault.');
          RETURN;
        END IF;

        v_headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-push-cron-secret', v_secret
        );

        PERFORM disparar_e_registrar_cron_http(
          'agendar-partida-semanal:send-confirmation-requests',
          'https://jtavmrlllyctkuxefhpc.supabase.co/functions/v1/send-confirmation-requests',
          v_headers,
          jsonb_build_object('partida_id', v_partida_id)
        );
      END IF;
    END $$;
    $semanal$
  );
END $outer$;

-- ----------------------------------------------------------------------------
-- 6. GRANTS E PERMISSÕES
-- ----------------------------------------------------------------------------
GRANT SELECT ON TABLE cron_execucoes TO anon, authenticated;
GRANT EXECUTE ON FUNCTION disparar_e_registrar_cron_http(text, text, jsonb, jsonb, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION obter_execucoes_cron(bigint, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION disparar_confirmacao_manual(bigint, bigint) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION disparar_push_teste(bigint) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION salvar_configuracoes_notificacoes(bigint, jsonb) TO anon, authenticated;
