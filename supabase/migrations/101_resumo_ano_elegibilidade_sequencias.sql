-- Migration 101: Restaura a exigência de elegibilidade (mínimo de 33% das partidas do ano)
-- para os cards de 'Maior Sequência' (Embalado) e 'Maior Seca' (Jejum) na RPC resumo_ano(p_ano).
-- Garante também que apenas sequências positivas (tamanho > 0) sejam consideradas e desempate por partidas jogadas.

CREATE OR REPLACE FUNCTION resumo_ano(p_ano integer)
RETURNS TABLE (
  ano integer,
  total_partidas bigint,
  artilheiro_jogador_id bigint,
  artilheiro_username text,
  artilheiro_gols bigint,
  artilheiro_partidas bigint,
  maestro_jogador_id bigint,
  maestro_username text,
  maestro_assistencias bigint,
  maestro_partidas bigint,
  participante_jogador_id bigint,
  participante_username text,
  participante_partidas bigint,
  eficiente_jogador_id bigint,
  eficiente_username text,
  eficiente_vitorias bigint,
  eficiente_partidas bigint,
  eficiente_percentual numeric,
  sequencia_vitorias_jogador_id bigint,
  sequencia_vitorias_username text,
  sequencia_vitorias bigint,
  seca_vitorias_jogador_id bigint,
  seca_vitorias_username text,
  seca_vitorias bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH partidas_ano AS (
    SELECT DISTINCT l.partida_id AS id, l.data_jogo
    FROM v_levantamento l
    WHERE EXTRACT(
        YEAR FROM l.data_jogo AT TIME ZONE 'America/Sao_Paulo'
      )::integer = p_ano
  ),
  total AS (
    SELECT COUNT(*)::bigint AS partidas
    FROM partidas_ano
  ),
  stats AS (
    SELECT
      l.jogador_id,
      j.username,
      COUNT(*)::bigint AS partidas,
      SUM(l.gols)::bigint AS gols,
      SUM(l.assistencias)::bigint AS assistencias,
      COUNT(*) FILTER (WHERE l.vitoria)::bigint AS vitorias
    FROM v_levantamento l
    JOIN jogadores j ON j.id = l.jogador_id
    WHERE j.posicao <> 'random'
      AND EXTRACT(
        YEAR FROM l.data_jogo AT TIME ZONE 'America/Sao_Paulo'
      )::integer = p_ano
    GROUP BY l.jogador_id, j.username
  ),
  stats_elegiveis AS (
    SELECT s.*
    FROM stats s
    CROSS JOIN total t
    WHERE t.partidas > 0
      AND (s.partidas::numeric / t.partidas) >= 0.33
  ),
  jogador_partidas AS (
    SELECT
      l.jogador_id,
      j.username,
      l.partida_id,
      l.data_jogo,
      l.vitoria AS venceu,
      ROW_NUMBER() OVER (
        PARTITION BY l.jogador_id
        ORDER BY l.data_jogo DESC, l.partida_id DESC
      ) AS rn
    FROM v_levantamento l
    JOIN jogadores j ON j.id = l.jogador_id
    WHERE j.posicao <> 'random'
      AND EXTRACT(
        YEAR FROM l.data_jogo AT TIME ZONE 'America/Sao_Paulo'
      )::integer = p_ano
  ),
  jogador_primeira_derrota AS (
    SELECT
      jogador_id,
      username,
      MIN(rn) FILTER (WHERE NOT venceu) AS first_loss_rn,
      MAX(rn) AS total_jogos
    FROM jogador_partidas
    GROUP BY jogador_id, username
  ),
  sequencias_vitorias_atuais AS (
    SELECT
      jogador_id,
      username,
      COALESCE(first_loss_rn - 1, total_jogos)::bigint AS tamanho
    FROM jogador_primeira_derrota
  ),
  jogador_primeira_vitoria AS (
    SELECT
      jogador_id,
      username,
      MIN(rn) FILTER (WHERE venceu) AS first_win_rn,
      MAX(rn) AS total_jogos
    FROM jogador_partidas
    GROUP BY jogador_id, username
  ),
  secas_vitorias_atuais AS (
    SELECT
      jogador_id,
      username,
      COALESCE(first_win_rn - 1, total_jogos)::bigint AS tamanho
    FROM jogador_primeira_vitoria
  ),
  artilheiro AS (
    SELECT s.jogador_id, s.username, s.gols, s.partidas
    FROM stats_elegiveis s
    WHERE s.gols > 0
    ORDER BY s.gols DESC, s.partidas DESC, s.username ASC
    LIMIT 1
  ),
  maestro AS (
    SELECT s.jogador_id, s.username, s.assistencias, s.partidas
    FROM stats_elegiveis s
    WHERE s.assistencias > 0
    ORDER BY s.assistencias DESC, s.partidas DESC, s.username ASC
    LIMIT 1
  ),
  participante AS (
    SELECT s.jogador_id, s.username, s.partidas
    FROM stats s
    ORDER BY s.partidas DESC, s.gols DESC, s.username ASC
    LIMIT 1
  ),
  eficiente AS (
    SELECT
      s.jogador_id,
      s.username,
      s.vitorias,
      s.partidas,
      ROUND((s.vitorias::numeric / NULLIF(s.partidas, 0)) * 100, 1) AS percentual
    FROM stats_elegiveis s
    ORDER BY (s.vitorias::numeric / NULLIF(s.partidas, 0)) DESC,
             s.vitorias DESC,
             s.partidas DESC,
             s.username ASC
    LIMIT 1
  ),
  sequencia_vitorias AS (
    SELECT sva.jogador_id, sva.username, sva.tamanho
    FROM sequencias_vitorias_atuais sva
    JOIN stats_elegiveis s ON s.jogador_id = sva.jogador_id
    WHERE sva.tamanho > 0
    ORDER BY sva.tamanho DESC, s.partidas DESC, sva.username ASC
    LIMIT 1
  ),
  seca_vitorias AS (
    SELECT sva.jogador_id, sva.username, sva.tamanho
    FROM secas_vitorias_atuais sva
    JOIN stats_elegiveis s ON s.jogador_id = sva.jogador_id
    WHERE sva.tamanho > 0
    ORDER BY sva.tamanho DESC, s.partidas DESC, sva.username ASC
    LIMIT 1
  )
  SELECT
    p_ano,
    COALESCE((SELECT partidas FROM total), 0::bigint),
    a.jogador_id,
    a.username,
    a.gols,
    a.partidas,
    m.jogador_id,
    m.username,
    m.assistencias,
    m.partidas,
    pt.jogador_id,
    pt.username,
    pt.partidas,
    e.jogador_id,
    e.username,
    e.vitorias,
    e.partidas,
    e.percentual,
    sv.jogador_id,
    sv.username,
    sv.tamanho,
    sc.jogador_id,
    sc.username,
    sc.tamanho
  FROM (SELECT 1) _
  LEFT JOIN artilheiro a ON true
  LEFT JOIN maestro m ON true
  LEFT JOIN participante pt ON true
  LEFT JOIN eficiente e ON true
  LEFT JOIN sequencia_vitorias sv ON true
  LEFT JOIN seca_vitorias sc ON true;
$$;

GRANT EXECUTE ON FUNCTION resumo_ano(integer) TO anon, authenticated;
