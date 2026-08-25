-- 086_rpc_partidas_recentes_jogadores.sql
--
-- RPC para obter a contagem de partidas jogadas por cada atleta nos últimos N meses
-- (padrão 2 meses), considerando partidas com status 'live', 'published' ou 'closed'
-- onde o atleta foi efetivamente escalado (time IS NOT NULL).
-- Utilizado para ordenar a lista de avulsos disponíveis por assiduidade recente.

CREATE OR REPLACE FUNCTION obter_partidas_recentes_jogadores(
  p_meses integer DEFAULT 2
)
RETURNS TABLE (
  jogador_id bigint,
  partidas_recentes bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    pp.jogador_id,
    COUNT(DISTINCT pp.partida_id)::bigint AS partidas_recentes
  FROM partidas_participantes pp
  JOIN partidas p ON p.id = pp.partida_id
  WHERE p.status IN ('live', 'published', 'closed')
    AND p.data_jogo >= (now() - (COALESCE(p_meses, 2) || ' months')::interval)
    AND pp.time IS NOT NULL
  GROUP BY pp.jogador_id;
$$;

GRANT EXECUTE ON FUNCTION obter_partidas_recentes_jogadores(integer) TO anon, authenticated;
