-- 119_stats_jogador_pontos.sql
-- View `stats_jogador` ganha a coluna `pontos` (SUM de v_levantamento.pontos,
-- onde vitoria=3 e empate=1) para o Comparador calcular o aproveitamento
-- (3V+E)/(3xJ) na mesma fórmula do ranking.

CREATE OR REPLACE VIEW stats_jogador AS
SELECT
  l.jogador_id,
  COUNT(*)::bigint                          AS partidas,
  SUM(l.gols)::bigint                       AS gols,
  SUM(l.assistencias)::bigint               AS assistencias,
  COUNT(*) FILTER (WHERE l.vitoria)::bigint AS vitorias,
  SUM(l.gols_contra)::bigint                AS gols_contra,
  SUM(l.pontos)::bigint                     AS pontos
FROM v_levantamento l
GROUP BY l.jogador_id;

GRANT SELECT ON stats_jogador TO anon, authenticated;
