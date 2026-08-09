-- 010_view_stats_jogador.sql
-- View `stats_jogador` com colunas: jogador_id, partidas, gols, assistencias, vitorias.
-- Similar ao ranking, mas sem pontos/derrotas/empates. Alimenta a tela de Perfil.
--   - Considera apenas partidas com status IN ('published','closed').
--   - vitorias = participacoes onde o time do jogador == vencedor da partida
--     (join com partida_placar, mesmas regras do ranking).

CREATE OR REPLACE VIEW stats_jogador AS
SELECT
  pp.jogador_id,
  COUNT(*)                                  AS partidas,
  COALESCE(SUM(pp.gols), 0)                 AS gols,
  COALESCE(SUM(pp.assistencias), 0)         AS assistencias,
  COUNT(*) FILTER (WHERE pl.vencedor = pp.time) AS vitorias
FROM partidas_participantes pp
JOIN partidas       p  ON p.id  = pp.partida_id
JOIN partida_placar pl ON pl.partida_id = pp.partida_id
WHERE p.status IN ('published','closed')
GROUP BY pp.jogador_id;
