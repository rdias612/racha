-- ============================================================================
-- 107 — P3 da análise de push (docs/analise-notificacoes-push.md):
--       push imediato de "Votação Aberta" no ato da publicação
-- ============================================================================
-- A partida tem DOIS caminhos que gravam status='published' e ambos disparam:
--   1. finalizar_partida (live -> published), chamada por PartidaAoVivo;
--   2. salvar_edicao_partida com p_primeira_vez=true (draft -> published,
--      via publicar_partida), chamada por PartidaEditar.
-- Pipeline: RPC disparar_push_votacao_aberta -> pg_net com coleta de 2s
-- (padrão dos disparos manuais da 104) -> Edge Function send-voting-reminders
-- no novo modo "abertura" (body {partida_id, abertura:true}) ->
-- listar_pendentes_votacao_abertura -> ledger push_reminder_deliveries com
-- reminder_key='votacao-aberta' (dedupe por PK + catch 23505).

-- ----------------------------------------------------------------------------
-- 1. Ledger aceita a nova chave (mesmo mecanismo das relaxas 057/077)
-- ----------------------------------------------------------------------------
ALTER TABLE push_reminder_deliveries
  DROP CONSTRAINT IF EXISTS push_reminder_deliveries_reminder_key_check;

ALTER TABLE push_reminder_deliveries
  ADD CONSTRAINT push_reminder_deliveries_reminder_key_check
  CHECK (
    reminder_key IN ('6h','3h','1h','30m','confirmacao','reforco','votacao-aberta')
    OR reminder_key ~ '^([01][0-9]|2[0-3]):(00|15|30|45)$'
  );

-- ----------------------------------------------------------------------------
-- 2. Config: gate próprio da abertura + templates (NULL = fallback hardcoded
--    na Edge Function, na linha dos templates dos buckets da 077)
-- ----------------------------------------------------------------------------
ALTER TABLE notificacoes_config
  ADD COLUMN votacao_abertura_ativo           boolean NOT NULL DEFAULT true,
  ADD COLUMN votacao_template_abertura_titulo text CHECK (char_length(votacao_template_abertura_titulo) <= 120),
  ADD COLUMN votacao_template_abertura_msg    text CHECK (char_length(votacao_template_abertura_msg) <= 500);

-- ----------------------------------------------------------------------------
-- 3. Listagem dos aptos a votar na abertura — irmã da listar_pendentes_votacao
--    (090): mesma elegibilidade, filtrada por partida e SEM janela de bucket
--    (a partida recém-publicada fecha em +24h, fora do teto de 6h10m da irmã)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION listar_pendentes_votacao_abertura(
  p_partida_id bigint
)
RETURNS TABLE (
  partida_id       bigint,
  jogador_id       bigint,
  voting_closes_at timestamptz,
  subscriptions    jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id                                               AS partida_id,
    pp.jogador_id                                      AS jogador_id,
    p.voting_closes_at                                 AS voting_closes_at,
    jsonb_agg(
      jsonb_build_object(
        'endpoint', ps.endpoint,
        'p256dh', ps.p256dh,
        'auth', ps.auth
      )
    )                                                  AS subscriptions
  FROM partidas p
  JOIN partidas_participantes pp ON pp.partida_id = p.id
  JOIN jogadores j ON j.id = pp.jogador_id
  JOIN push_subscriptions ps ON ps.jogador_id = pp.jogador_id
  WHERE p.id = p_partida_id
    AND p.status = 'published'
    AND p.voting_closes_at > now()
    AND pp.posicao <> 'goleiro'
    AND j.is_ativo = true
    AND j.posicao <> 'random'
    AND j.username NOT ILIKE 'random%'
    AND NOT EXISTS (
      SELECT 1 FROM votes v
      WHERE v.partida_id = pp.partida_id
        AND v.voter_id = pp.jogador_id
    )
  GROUP BY p.id, pp.jogador_id, p.voting_closes_at;
$$;

GRANT EXECUTE ON FUNCTION listar_pendentes_votacao_abertura(bigint) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4. Disparo no ato da publicação — padrão dos disparos manuais da 104
--    (coleta de 2s cabe no statement_timeout do anon, 3s; cold start da
--    Edge Function pode registrar "Timeout" falso-negativo com o push
--    entregue mesmo assim; observabilidade de entrega = ledger/painel do P6)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION disparar_push_votacao_aberta(
  p_admin_id   bigint,
  p_partida_id bigint
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_status   text;
  v_secret   text;
  v_headers  jsonb;
BEGIN
  SELECT is_admin INTO v_is_admin FROM jogadores WHERE jogadores.id = p_admin_id;
  IF v_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso restrito a administradores.';
  END IF;

  -- Só faz sentido para partida recém-publicada e com a urna ainda aberta.
  SELECT status INTO v_status FROM partidas WHERE partidas.id = p_partida_id;
  IF v_status IS NULL OR v_status <> 'published' THEN
    RAISE EXCEPTION 'Partida inválida ou não está publicada (votação aberta).';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM partidas
    WHERE id = p_partida_id AND voting_closes_at > now()
  ) THEN
    RAISE EXCEPTION 'A votação desta partida já está fechada.';
  END IF;

  SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets
    WHERE name = 'push_cron_secret'
    LIMIT 1;

  IF v_secret IS NULL THEN
    INSERT INTO cron_execucoes (job_nome, sucesso, erro)
    VALUES ('disparar_push_votacao_aberta', false, 'Secret push_cron_secret não encontrado no vault.');
    RAISE EXCEPTION 'Secret push_cron_secret não configurado no vault.';
  END IF;

  v_headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'x-push-cron-secret', v_secret
  );

  PERFORM disparar_e_registrar_cron_http(
    'disparar_push_votacao_aberta',
    'https://jtavmrlllyctkuxefhpc.supabase.co/functions/v1/send-voting-reminders',
    v_headers,
    jsonb_build_object('partida_id', p_partida_id, 'abertura', true),
    2000
  );

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION disparar_push_votacao_aberta(bigint, bigint) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 5. SALVAR CONFIGURAÇÕES — mesmo corpo da 104 acrescido dos 3 campos novos
--    (reagenda o job semanal com corpo fire-and-forget)
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
    votacao_abertura_ativo = COALESCE((p_config->>'votacao_abertura_ativo')::boolean, votacao_abertura_ativo),
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
    votacao_template_abertura_titulo = CASE WHEN p_config ? 'votacao_template_abertura_titulo' THEN (p_config->>'votacao_template_abertura_titulo') ELSE votacao_template_abertura_titulo END,
    votacao_template_abertura_msg = CASE WHEN p_config ? 'votacao_template_abertura_msg' THEN (p_config->>'votacao_template_abertura_msg') ELSE votacao_template_abertura_msg END,
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

GRANT EXECUTE ON FUNCTION salvar_configuracoes_notificacoes(bigint, jsonb) TO anon, authenticated;
