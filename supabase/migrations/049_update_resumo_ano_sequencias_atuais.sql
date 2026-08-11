-- Migration 049: Atualiza resumo_ano(p_ano) para sequencias de vitorias e secas atuais no momento.

CREATE OR REPLACE FUNCTION resumo_ano(p_ano integer)
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
      (pl.vencedor = pp.time) AS venceu,
      ROW_NUMBER() OVER (
        PARTITION BY pp.jogador_id
        ORDER BY p.data_jogo DESC, p.id DESC
      ) AS rn
    FROM partidas_participantes pp
    JOIN partidas_ano pa ON pa.id = pp.partida_id
    JOIN partidas p ON p.id = pa.id
    JOIN partida_placar pl ON pl.partida_id = pp.partida_id
    JOIN jogadores j ON j.id = pp.jogador_id
  ),
  jogador_primeira_derrota AS (
    SELECT
      jogador_id,
      nome,
      MIN(rn) FILTER (WHERE NOT venceu) AS first_loss_rn,
      MAX(rn) AS total_jogos
    FROM jogador_partidas
    GROUP BY jogador_id, nome
  ),
  sequencias_vitorias_atuais AS (
    SELECT
      jogador_id,
      nome,
      COALESCE(first_loss_rn - 1, total_jogos)::bigint AS tamanho
    FROM jogador_primeira_derrota
  ),
  jogador_primeira_vitoria AS (
    SELECT
      jogador_id,
      nome,
      MIN(rn) FILTER (WHERE venceu) AS first_win_rn,
      MAX(rn) AS total_jogos
    FROM jogador_partidas
    GROUP BY jogador_id, nome
  ),
  secas_vitorias_atuais AS (
    SELECT
      jogador_id,
      nome,
      COALESCE(first_win_rn - 1, total_jogos)::bigint AS tamanho
    FROM jogador_primeira_vitoria
  ),
  maior_sequencia_vitorias AS (
    SELECT sv.jogador_id, sv.nome, sv.tamanho
    FROM sequencias_vitorias_atuais sv
    JOIN stats s ON s.jogador_id = sv.jogador_id
    WHERE sv.tamanho > 0
    ORDER BY sv.tamanho DESC, s.partidas DESC, sv.nome ASC
    LIMIT 1
  ),
  maior_seca_vitorias AS (
    SELECT sv.jogador_id, sv.nome, sv.tamanho
    FROM secas_vitorias_atuais sv
    JOIN stats s ON s.jogador_id = sv.jogador_id
    WHERE sv.tamanho > 0
    ORDER BY sv.tamanho DESC, s.partidas DESC, sv.nome ASC
    LIMIT 1
  ),
  artilheiro AS (
    SELECT s.* FROM stats s
    ORDER BY s.gols DESC, s.partidas DESC, s.nome ASC
    LIMIT 1
  ),
  maestro AS (
    SELECT s.* FROM stats s
    ORDER BY s.assistencias DESC, s.partidas DESC, s.nome ASC
    LIMIT 1
  ),
  participante AS (
    SELECT s.* FROM stats s
    ORDER BY s.partidas DESC, s.gols DESC, s.nome ASC
    LIMIT 1
  ),
  eficiente AS (
    SELECT s.* FROM stats s
    CROSS JOIN total t
    WHERE s.partidas * 2 >= t.partidas
    ORDER BY s.vitorias::numeric / NULLIF(s.partidas, 0) DESC,
             s.partidas DESC, s.nome ASC
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
