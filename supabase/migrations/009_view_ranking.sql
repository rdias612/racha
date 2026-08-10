-- 009_view_ranking.sql
-- View `ranking` por jogador com colunas:
--   jogador_id, nome, pontos, vitorias, empates, derrotas, partidas, gols, assistencias.
--
-- Regras:
--   - Considera apenas partidas com status IN ('published','closed'). Drafts nao
--     contam (o admin ainda esta montando).
--   - Para cada participante, determina o resultado (vitoria/empate/derrota)
--     comparando o time dele ('a'/'b') com o `vencedor` da view partida_placar:
--       vitoria  = (time_do_jogador = vencedor)
--       empate   = (vencedor = 'empate')
--       derrota  = caso contrario.
--   - pontos = vitorias*3 + empates*1.
--   - Soma gols e assistencias de todas as participacoes do jogador.
--   - Agrupa por (jogador_id, nome).
--
-- Ordenacao final da query do app (NAO na view - views nao garantem ordem):
--   ORDER BY pontos DESC, vitorias DESC, partidas DESC, gols DESC,
--            assistencias DESC, nome ASC
-- A view inclui todas as colunas necessarias para esse ORDER BY.

CREATE OR REPLACE VIEW ranking AS
SELECT
  pp.jogador_id,
  j.nome,
  -- pontos = 3 por vitoria + 1 por empate
  (
    COUNT(*) FILTER (
      WHERE pl.vencedor = pp.time
    ) * 3
    +
    COUNT(*) FILTER (
      WHERE pl.vencedor = 'empate'
    ) * 1
  )                                                         AS pontos,
  COUNT(*) FILTER (WHERE pl.vencedor = pp.time)             AS vitorias,
  COUNT(*) FILTER (WHERE pl.vencedor = 'empate')            AS empates,
  COUNT(*) FILTER (WHERE pl.vencedor <> pp.time
                    AND pl.vencedor <> 'empate')            AS derrotas,
  COUNT(*)                                                  AS partidas,
  COALESCE(SUM(pp.gols), 0)                                 AS gols,
  COALESCE(SUM(pp.assistencias), 0)                         AS assistencias,
  COALESCE(SUM(pp.gols_contra), 0)                          AS gols_contra
FROM partidas_participantes pp
JOIN partidas      p  ON p.id  = pp.partida_id
JOIN partida_placar pl ON pl.partida_id = pp.partida_id
JOIN jogadores     j  ON j.id  = pp.jogador_id
WHERE p.status IN ('published','closed')
GROUP BY pp.jogador_id, j.nome;
