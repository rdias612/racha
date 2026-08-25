-- 081_fix_cron_partida_semanal_fallback_draft.sql
--
-- Correção no cron `agendar-partida-semanal`:
-- Se a partida da semana já existir em 'draft' (ex.: criada antes da alteração de horário ou manualmente),
-- `criar_partida_semanal_mensalistas()` retorna NULL por idempotência.
-- O cron agora busca a partida draft existente da semana para disparar o push aos mensalistas pendentes.

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

-- Reagenda o cron atual imediatamente com o bloco corrigido (usando tag $outer$ para não colidir com DO $$)
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
END $outer$;
