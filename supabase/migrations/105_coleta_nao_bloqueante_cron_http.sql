-- Continuação do P5 (docs/analise-notificacoes-push.md), após a 104.
--
-- A 104 tornou os jobs de cron fire-and-forget, mas os disparos manuais do
-- admin (`disparar_push_teste`, `disparar_confirmacao_manual`) ainda usam a
-- `disparar_e_registrar_cron_http` da 099 para capturar o corpo da resposta.
-- Na 099 a coleta tenta `net._http_response` e, no hosted Supabase (sem
-- acesso a essa tabela interna), cai SEMPRE no fallback síncrono
-- `net.http_collect_response(async := false)` — que faz pg_sleep interno
-- ignorando o orçamento da função. Em cold start da Edge Function o
-- statement_timeout da sessão cancela o statement, o erro escapa e o rollback
-- descarta até o push já enfileirado.
--
-- Fix: coleta no modo ASSÍNCRONO (`async := true`), que retorna imediatamente
-- com status 'pending' até a resposta existir. Cada iteração do loop passa a
-- ser rápida e o orçamento `p_timeout_ms` passa a valer de verdade. Assinatura
-- e comportamento de log preservados (póio falso "Timeout" em cold start:
-- o push commitado é entregue mesmo assim — observabilidade real no P6).

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
  v_estado          text;
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

  -- 2) Coleta NÃO bloqueante: http_collect_response(async := true) retorna na
  --    hora ('pending' até a resposta existir), sem pg_sleep escondido.
  IF v_request_id IS NOT NULL THEN
    WHILE (EXTRACT(EPOCH FROM (clock_timestamp() - v_start_time)) * 1000) < v_timeout_efetivo LOOP
      BEGIN
        SELECT
          (res).status,
          (res).response.status_code,
          (res).response.body,
          (res).message
        INTO
          v_estado,
          v_status_code,
          v_resposta,
          v_erro
        FROM net.http_collect_response(v_request_id, true) AS res;

        IF v_estado IS DISTINCT FROM 'pending' THEN
          v_collected := true;
          EXIT;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        -- Resposta ainda não pronta ou indisponível: nova tentativa até o orçamento.
        NULL;
      END;
      PERFORM pg_sleep(0.05);
    END LOOP;

    IF v_collected THEN
      IF v_estado = 'success' AND v_status_code >= 200 AND v_status_code < 300 THEN
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

GRANT EXECUTE ON FUNCTION disparar_e_registrar_cron_http(text, text, jsonb, jsonb, integer)
  TO anon, authenticated;
