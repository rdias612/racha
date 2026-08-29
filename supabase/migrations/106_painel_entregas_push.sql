-- P6 da análise de push (docs/analise-notificacoes-push.md): visibilidade de
-- entrega por jogador. Uma linha por atleta ativo (não-random), com aparelhos
-- inscritos, última entrega real do ledger e último erro. O batimento da cron
-- (cron_execucoes, migration 104) NÃO entra aqui: "disparo enfileirado" ≠ entrega.

-- O RETURN ROW mudou em relação à primeira versão aplicada desta migration
-- (coluna `nome` não existe em jogadores; a identidade exibida é `username`).
DROP FUNCTION IF EXISTS obter_painel_entregas_push(bigint, integer);

CREATE OR REPLACE FUNCTION obter_painel_entregas_push(
  p_admin_id bigint,
  p_limite   integer DEFAULT 200
)
RETURNS TABLE (
  jogador_id             bigint,
  username               text,
  is_mensalista          boolean,
  posicao                text,
  qtd_aparelhos          bigint,
  primeira_inscricao_em  timestamptz,
  ultima_inscricao_em    timestamptz,
  aparelhos              jsonb,
  total_entregas         bigint,
  ultima_entrega_em      timestamptz,
  ultima_entrega_key     text,
  ultima_entrega_partida bigint,
  total_erros            bigint,
  ultimo_erro            text,
  ultimo_erro_em         timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  -- Gate admin (colunas do RETURNS TABLE colidem: qualificar jogadores.id — lição da 104).
  SELECT is_admin INTO v_is_admin FROM jogadores WHERE jogadores.id = p_admin_id;
  IF v_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso restrito a administradores.';
  END IF;

  RETURN QUERY
  WITH aparelhos AS (
    SELECT
      ps.jogador_id,
      count(*)::bigint   AS qtd,
      min(ps.created_at) AS primeira,
      max(ps.updated_at) AS ultima,
      jsonb_agg(
        jsonb_build_object(
          'endpoint', right(ps.endpoint, 16),   -- nunca expor o endpoint completo
          'criado_em', ps.created_at,
          'atualizado_em', ps.updated_at
        ) ORDER BY ps.updated_at DESC
      ) AS lista
    FROM push_subscriptions ps
    GROUP BY ps.jogador_id
  ),
  entregas AS (
    SELECT
      d.jogador_id,
      count(*) FILTER (WHERE d.sent_at IS NOT NULL)::bigint AS total_ok,
      max(d.sent_at)                                        AS ultima_ok
    FROM push_reminder_deliveries d
    GROUP BY d.jogador_id
  ),
  ultima_entrega AS (
    SELECT DISTINCT ON (d.jogador_id)
      d.jogador_id, d.reminder_key, d.partida_id, d.sent_at
    FROM push_reminder_deliveries d
    WHERE d.sent_at IS NOT NULL
    ORDER BY d.jogador_id, d.sent_at DESC
  ),
  erros AS (
    SELECT
      d.jogador_id,
      count(*) FILTER (WHERE d.error_message IS NOT NULL)::bigint AS total_erro
    FROM push_reminder_deliveries d
    GROUP BY d.jogador_id
  ),
  ultimo_erro AS (
    SELECT DISTINCT ON (d.jogador_id)
      d.jogador_id, d.error_message, d.claimed_at
    FROM push_reminder_deliveries d
    WHERE d.error_message IS NOT NULL
    ORDER BY d.jogador_id, d.claimed_at DESC
  )
  SELECT
    j.id,
    j.username,
    j.is_mensalista,
    j.posicao,
    COALESCE(a.qtd, 0),
    a.primeira,
    a.ultima,
    COALESCE(a.lista, '[]'::jsonb),
    COALESCE(e.total_ok, 0),
    e.ultima_ok,
    ue.reminder_key,
    ue.partida_id,
    COALESCE(er.total_erro, 0),
    err.error_message,
    err.claimed_at
  FROM jogadores j
  LEFT JOIN aparelhos      a   ON a.jogador_id   = j.id
  LEFT JOIN entregas       e   ON e.jogador_id   = j.id
  LEFT JOIN ultima_entrega ue  ON ue.jogador_id  = j.id
  LEFT JOIN erros          er  ON er.jogador_id  = j.id
  LEFT JOIN ultimo_erro    err ON err.jogador_id = j.id
  WHERE j.is_ativo
    AND j.username NOT ILIKE 'random%'
  ORDER BY
    (e.ultima_ok IS NULL) DESC,
    e.ultima_ok ASC NULLS LAST,
    j.username
  LIMIT LEAST(GREATEST(COALESCE(p_limite, 200), 1), 500);
END;
$$;

GRANT EXECUTE ON FUNCTION obter_painel_entregas_push(bigint, integer) TO anon, authenticated;
