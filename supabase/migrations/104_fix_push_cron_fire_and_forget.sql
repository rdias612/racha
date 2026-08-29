-- P5 da análise de push (docs/analise-notificacoes-push.md): o job
-- `enviar-push-reminders-1min` falhava 100% das execuções e NENHUM push da
-- cron era entregue desde a 099. Causa: a coleta da resposta no
-- `disparar_e_registrar_cron_http` cai no caminho bloqueante
-- `net.http_collect_response` (pg_sleep interno), o statement_timeout da
-- sessão cancela o statement, o erro escapa e o rollback da transação inteira
-- descarta até o push já enfileirado no `net.http_post`.
--
-- Correções (opção "fire-and-forget" prescrita no doc):
--   1. Jobs `enviar-push-reminders-1min` e `agendar-partida-semanal` passam a
--      enfileirar o POST via pg_net sem polling, commitam e gravam um
--      batimento honesto em cron_execucoes ("disparo enfileirado" ≠ entrega;
--      a entrega por jogador vive no ledger push_reminder_deliveries).
--   2. `salvar_configuracoes_notificacoes` (que reagenda o job semanal ao
--      salvar config) recebe o mesmo corpo fire-and-forget.
--   3. Disparos manuais (`disparar_confirmacao_manual`, `disparar_push_teste`)
--      passam a coletar a resposta com timeout de 2s para caber no
--      statement_timeout do role anon (3s). Cold start da Edge Function pode
--      registrar falso "Timeout" com o push entregue mesmo assim (limite
--      conhecido do P5; observabilidade real de entrega = painel do P6).
--   4. `obter_execucoes_cron`: o `id` do RETURNS TABLE colidia com a coluna
--      na query de checagem de admin (42702 ambiguous; mesma classe do fix
--      097) — qualifica `jogadores.id`.

-- ----------------------------------------------------------------------------
-- 1. CONSULTA ADMIN DAS EXECUÇÕES (fix 42702)
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
  SELECT is_admin INTO v_is_admin FROM jogadores WHERE jogadores.id = p_admin_id;
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
-- 2. DISPAROS MANUAIS COM COLETA CURTA (2s, cabe no timeout do anon)
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
  SELECT is_admin INTO v_is_admin FROM jogadores WHERE jogadores.id = p_admin_id;
  IF v_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso restrito a administradores.';
  END IF;

  SELECT status INTO v_status FROM partidas WHERE partidas.id = p_partida_id;
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
    jsonb_build_object('partida_id', p_partida_id, 'reenviar', true),
    2000
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
  SELECT is_admin INTO v_is_admin FROM jogadores WHERE jogadores.id = p_admin_id;
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
    jsonb_build_object('jogador_id', p_admin_id),
    2000
  );

  RETURN true;
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. SALVAR CONFIGURAÇÕES (reagenda o job semanal com corpo fire-and-forget)
-- ----------------------------------------------------------------------------

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
  SELECT is_admin INTO v_is_admin FROM jogadores WHERE jogadores.id = p_admin_id;
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
        v_req        bigint;
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

          -- Fire-and-forget (P5): enfileira e commita, sem polling bloqueante.
          SELECT net.http_post(
            url := 'https://jtavmrlllyctkuxefhpc.supabase.co/functions/v1/send-confirmation-requests',
            headers := v_headers,
            body := jsonb_build_object('partida_id', v_partida_id),
            timeout_milliseconds := 8000
          ) INTO v_req;

          IF v_req IS NOT NULL THEN
            INSERT INTO cron_execucoes (job_nome, sucesso, resposta)
            VALUES ('agendar-partida-semanal', true,
                    'Disparo fire-and-forget enfileirado para partida ' || v_partida_id::text || ' (migration 104).');
          ELSE
            INSERT INTO cron_execucoes (job_nome, sucesso, erro)
            VALUES ('agendar-partida-semanal', false, 'Falha ao enfileirar net.http_post.');
          END IF;
        END IF;
      END $$;
      $semanal$
    );
  END IF;

  RETURN true;
END;
$rpc$;

-- ----------------------------------------------------------------------------
-- 4. REAGENDAR O JOB DE 1 MINUTO (fire-and-forget) E O SEMANAL (agora)
-- ----------------------------------------------------------------------------

DO $$
BEGIN
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
    v_req_1   bigint;
    v_req_2   bigint;
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

    -- Fire-and-forget (P5): enfileira e commita, sem polling bloqueante.
    SELECT net.http_post(
      url := 'https://jtavmrlllyctkuxefhpc.supabase.co/functions/v1/send-voting-reminders',
      headers := v_headers,
      body := '{}'::jsonb,
      timeout_milliseconds := 8000
    ) INTO v_req_1;

    SELECT net.http_post(
      url := 'https://jtavmrlllyctkuxefhpc.supabase.co/functions/v1/send-confirmation-requests',
      headers := v_headers,
      body := '{}'::jsonb,
      timeout_milliseconds := 8000
    ) INTO v_req_2;

    IF v_req_1 IS NOT NULL AND v_req_2 IS NOT NULL THEN
      INSERT INTO cron_execucoes (job_nome, sucesso, resposta)
      VALUES ('enviar-push-reminders-1min', true,
              'Disparos fire-and-forget enfileirados (votação + confirmação), migration 104.');
    ELSE
      INSERT INTO cron_execucoes (job_nome, sucesso, erro)
      VALUES ('enviar-push-reminders-1min', false, 'Falha ao enfileirar net.http_post.');
    END IF;

    DELETE FROM cron_execucoes
    WHERE executado_em < (now() - interval '30 days');
  END $$;
  $push_job$
);

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
      v_req        bigint;
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

        SELECT net.http_post(
          url := 'https://jtavmrlllyctkuxefhpc.supabase.co/functions/v1/send-confirmation-requests',
          headers := v_headers,
          body := jsonb_build_object('partida_id', v_partida_id),
          timeout_milliseconds := 8000
        ) INTO v_req;

        IF v_req IS NOT NULL THEN
          INSERT INTO cron_execucoes (job_nome, sucesso, resposta)
          VALUES ('agendar-partida-semanal', true,
                  'Disparo fire-and-forget enfileirado para partida ' || v_partida_id::text || ' (migration 104).');
        ELSE
          INSERT INTO cron_execucoes (job_nome, sucesso, erro)
          VALUES ('agendar-partida-semanal', false, 'Falha ao enfileirar net.http_post.');
        END IF;
      END IF;
    END $$;
    $semanal$
  );
END $outer$;

-- ----------------------------------------------------------------------------
-- 5. GRANTS
-- ----------------------------------------------------------------------------

GRANT EXECUTE ON FUNCTION obter_execucoes_cron(bigint, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION disparar_confirmacao_manual(bigint, bigint) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION disparar_push_teste(bigint) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION salvar_configuracoes_notificacoes(bigint, jsonb) TO anon, authenticated;
