-- Acrescenta ao resumo anual a maior sequencia de vitorias e a maior seca.
-- Considera partidas publicadas/encerradas do ano informado.

DROP FUNCTION IF EXISTS resumo_ano(integer);

CREATE FUNCTION resumo_ano(p_ano integer)
RETURNS TABLE (
  ano integer,
  total_partidas bigint,
  artilheiro_jogador_id bigint,
  artilheiro_nome text,
  artilheiro_gols bigint,
  artilheiro_partidas bigint,
  maestro_jogador_id bigint,
  maestro_nome text,
  maestro_assistencias bigint,
  maestro_partidas bigint,
  participante_jogador_id bigint,
  participante_nome text,
  participante_partidas bigint,
  eficiente_jogador_id bigint,
  eficiente_nome text,
  eficiente_vitorias bigint,
  eficiente_partidas bigint,
  eficiente_percentual numeric,
  sequencia_vitorias_jogador_id bigint,
  sequencia_vitorias_nome text,
  sequencia_vitorias bigint,
  seca_vitorias_jogador_id bigint,
  seca_vitorias_nome text,
  seca_vitorias bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH partidas_ano AS (
    SELECT p.id, p.data_jogo
    FROM partidas p
    WHERE p.status IN ('published', 'closed')
      AND EXTRACT(
        YEAR FROM p.data_jogo AT TIME ZONE 'America/Sao_Paulo'
      )::integer = p_ano
  ),
  total AS (
    SELECT COUNT(*)::bigint AS partidas
    FROM partidas_ano
  ),
  stats AS (
    SELECT
      pp.jogador_id,
      j.nome,
      COUNT(*)::bigint AS partidas,
      COALESCE(SUM(pp.gols), 0)::bigint AS gols,
      COALESCE(SUM(pp.assistencias), 0)::bigint AS assistencias,
      COUNT(*) FILTER (WHERE pl.vencedor = pp.time)::bigint AS vitorias
    FROM partidas_participantes pp
    JOIN partidas p ON p.id = pp.partida_id
    JOIN partidas_ano pa ON pa.id = p.id
    JOIN partida_placar pl ON pl.partida_id = pp.partida_id
    JOIN jogadores j ON j.id = pp.jogador_id
    GROUP BY pp.jogador_id, j.nome
  ),
  jogador_partidas AS (
    SELECT
      pp.jogador_id,
      j.nome,
      p.id AS partida_id,
      p.data_jogo,
      (pl.vencedor = pp.time) AS venceu
    FROM partidas_participantes pp
    JOIN partidas_ano pa ON pa.id = pp.partida_id
    JOIN partidas p ON p.id = pa.id
    JOIN partida_placar pl ON pl.partida_id = pp.partida_id
    JOIN jogadores j ON j.id = pp.jogador_id
  ),
  sequencias_marcadas AS (
    SELECT
      jp.*,
      SUM(CASE WHEN NOT jp.venceu THEN 1 ELSE 0 END) OVER (
        PARTITION BY jp.jogador_id
        ORDER BY jp.data_jogo, jp.partida_id
        ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
      ) AS grupo_vitorias,
      SUM(CASE WHEN jp.venceu THEN 1 ELSE 0 END) OVER (
        PARTITION BY jp.jogador_id
        ORDER BY jp.data_jogo, jp.partida_id
        ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
      ) AS grupo_secas
    FROM jogador_partidas jp
  ),
  sequencias_vitorias AS (
    SELECT
      jogador_id,
      nome,
      grupo_vitorias AS grupo,
      COUNT(*)::bigint AS tamanho
    FROM sequencias_marcadas
    WHERE venceu
    GROUP BY jogador_id, nome, grupo_vitorias
  ),
  secas_vitorias AS (
    SELECT
      jogador_id,
      nome,
      grupo_secas AS grupo,
      COUNT(*)::bigint AS tamanho
    FROM sequencias_marcadas
    WHERE NOT venceu
    GROUP BY jogador_id, nome, grupo_secas
  ),
  maior_sequencia_vitorias AS (
    SELECT sv.jogador_id, sv.nome, sv.tamanho
    FROM sequencias_vitorias sv
    JOIN stats s ON s.jogador_id = sv.jogador_id
    ORDER BY sv.tamanho DESC, s.partidas DESC, sv.nome ASC
    LIMIT 1
  ),
  maior_seca_vitorias AS (
    SELECT sv.jogador_id, sv.nome, sv.tamanho
    FROM secas_vitorias sv
    JOIN stats s ON s.jogador_id = sv.jogador_id
    ORDER BY sv.tamanho DESC, s.partidas DESC, sv.nome ASC
    LIMIT 1
  ),
  artilheiro AS (
    SELECT s.*
    FROM stats s
    ORDER BY s.gols DESC, s.partidas DESC, s.nome ASC
    LIMIT 1
  ),
  maestro AS (
    SELECT s.*
    FROM stats s
    ORDER BY s.assistencias DESC, s.partidas DESC, s.nome ASC
    LIMIT 1
  ),
  participante AS (
    SELECT s.*
    FROM stats s
    ORDER BY s.partidas DESC, s.gols DESC, s.nome ASC
    LIMIT 1
  ),
  eficiente AS (
    SELECT s.*
    FROM stats s
    CROSS JOIN total t
    WHERE s.partidas * 2 >= t.partidas
    ORDER BY s.vitorias::numeric / NULLIF(s.partidas, 0) DESC,
             s.partidas DESC,
             s.nome ASC
    LIMIT 1
  )
  SELECT
    p_ano,
    t.partidas,
    a.jogador_id,
    a.nome,
    a.gols,
    a.partidas,
    m.jogador_id,
    m.nome,
    m.assistencias,
    m.partidas,
    pt.jogador_id,
    pt.nome,
    pt.partidas,
    e.jogador_id,
    e.nome,
    e.vitorias,
    e.partidas,
    CASE
      WHEN e.jogador_id IS NULL THEN NULL
      ELSE e.vitorias::numeric / NULLIF(e.partidas, 0)
    END,
    sv.jogador_id,
    sv.nome,
    sv.tamanho,
    ss.jogador_id,
    ss.nome,
    ss.tamanho
  FROM total t
  LEFT JOIN artilheiro a ON true
  LEFT JOIN maestro m ON true
  LEFT JOIN participante pt ON true
  LEFT JOIN eficiente e ON true
  LEFT JOIN maior_sequencia_vitorias sv ON true
  LEFT JOIN maior_seca_vitorias ss ON true;
$$;

GRANT EXECUTE ON FUNCTION resumo_ano(integer) TO anon, authenticated;
