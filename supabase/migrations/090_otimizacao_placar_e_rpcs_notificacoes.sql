-- 090_otimizacao_placar_e_rpcs_notificacoes.sql
--
-- Otimizações de Banco e Edge Functions (Itens P2-26, P2-27, P2-28):
-- 1. P2-26: Confirmação e garantia de STABLE em todas as RPCs puras de leitura.
-- 2. P2-27: Criação das RPCs listar_pendentes_votacao() e listar_pendentes_confirmacao()
--    eliminando o padrão N+1 nas Edge Functions de Web Push.
-- 3. P2-28: Otimização da view partida_placar (agregação em passo único) e índices de cobertura.

-- ----------------------------------------------------------------------------
-- 1. P2-28: Índices de Cobertura e Otimização de partida_placar
-- ----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_partidas_participantes_placar
  ON partidas_participantes (partida_id, time)
  INCLUDE (gols, gols_contra);

CREATE INDEX IF NOT EXISTS idx_partidas_data_jogo
  ON partidas (data_jogo DESC);

CREATE OR REPLACE VIEW partida_placar AS
WITH agg AS (
  SELECT
    partida_id,
    (COALESCE(SUM(gols) FILTER (WHERE time = 'a'), 0) + COALESCE(SUM(gols_contra) FILTER (WHERE time = 'b'), 0))::bigint AS gols_time_a,
    (COALESCE(SUM(gols) FILTER (WHERE time = 'b'), 0) + COALESCE(SUM(gols_contra) FILTER (WHERE time = 'a'), 0))::bigint AS gols_time_b
  FROM partidas_participantes
  GROUP BY partida_id
)
SELECT
  p.id AS partida_id,
  COALESCE(a.gols_time_a, 0)::bigint AS gols_time_a,
  COALESCE(a.gols_time_b, 0)::bigint AS gols_time_b,
  CASE
    WHEN COALESCE(a.gols_time_a, 0) > COALESCE(a.gols_time_b, 0) THEN 'a'
    WHEN COALESCE(a.gols_time_b, 0) > COALESCE(a.gols_time_a, 0) THEN 'b'
    ELSE 'empate'
  END AS vencedor
FROM partidas p
LEFT JOIN agg a ON a.partida_id = p.id;

GRANT SELECT ON partida_placar TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. P2-27: RPCs Canônicas para Eliminação de N+1 em Web Push
-- ----------------------------------------------------------------------------

-- 2.1 Listar Pendentes de Votação (Candidatos + Subscriptions em 1 Round-Trip)
CREATE OR REPLACE FUNCTION listar_pendentes_votacao(
  p_janela_maxima_interval interval DEFAULT interval '6 hours 10 minutes'
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
    p.id                                              AS partida_id,
    pp.jogador_id                                     AS jogador_id,
    p.voting_closes_at                                AS voting_closes_at,
    jsonb_agg(
      jsonb_build_object(
        'endpoint', ps.endpoint,
        'p256dh', ps.p256dh,
        'auth', ps.auth
      )
    )                                                 AS subscriptions
  FROM partidas p
  JOIN partidas_participantes pp ON pp.partida_id = p.id
  JOIN jogadores j ON j.id = pp.jogador_id
  JOIN push_subscriptions ps ON ps.jogador_id = pp.jogador_id
  WHERE p.status = 'published'
    AND p.voting_closes_at > now()
    AND p.voting_closes_at <= now() + COALESCE(p_janela_maxima_interval, interval '6 hours 10 minutes')
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

GRANT EXECUTE ON FUNCTION listar_pendentes_votacao(interval) TO anon, authenticated;

-- 2.2 Listar Pendentes de Confirmação (Candidatos + Subscriptions em 1 Round-Trip)
CREATE OR REPLACE FUNCTION listar_pendentes_confirmacao(
  p_partida_id bigint DEFAULT NULL
)
RETURNS TABLE (
  partida_id            bigint,
  jogador_id            bigint,
  data_jogo             timestamptz,
  confirmacao_closes_at timestamptz,
  subscriptions         jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_partida_id bigint;
BEGIN
  IF p_partida_id IS NOT NULL THEN
    SELECT id INTO v_target_partida_id
    FROM partidas
    WHERE id = p_partida_id AND status = 'draft';
  ELSE
    SELECT id INTO v_target_partida_id
    FROM partidas
    WHERE status = 'draft' AND confirmacao_closes_at IS NOT NULL
    ORDER BY id DESC
    LIMIT 1;
  END IF;

  IF v_target_partida_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.id                                              AS partida_id,
    pp.jogador_id                                     AS jogador_id,
    p.data_jogo                                       AS data_jogo,
    p.confirmacao_closes_at                           AS confirmacao_closes_at,
    jsonb_agg(
      jsonb_build_object(
        'endpoint', ps.endpoint,
        'p256dh', ps.p256dh,
        'auth', ps.auth
      )
    )                                                 AS subscriptions
  FROM partidas p
  JOIN partidas_participantes pp ON pp.partida_id = p.id
  JOIN jogadores j ON j.id = pp.jogador_id
  JOIN push_subscriptions ps ON ps.jogador_id = pp.jogador_id
  WHERE p.id = v_target_partida_id
    AND p.status = 'draft'
    AND pp.status_confirmacao = 'pendente'
    AND pp.posicao <> 'goleiro'
    AND j.is_ativo = true
    AND j.posicao <> 'random'
    AND j.username NOT ILIKE 'random%'
  GROUP BY p.id, pp.jogador_id, p.data_jogo, p.confirmacao_closes_at;
END;
$$;

GRANT EXECUTE ON FUNCTION listar_pendentes_confirmacao(bigint) TO anon, authenticated;
