-- 029_add_posicao_view_ranking.sql
-- Adiciona coluna `posicao` à view `ranking` (cópia de 009_view_ranking.sql).
--
-- Motivo: O filtro por posição nos Rankings (tela /ranking/:metrica) agora é
-- aplicado no servidor, via `.eq('posicao', x)` na query Supabase. Para isso,
-- a view precisa expor `j.posicao`. Jogadores `random` não casam com nenhuma
-- posição real e portanto são naturalmente excluídos quando uma posição
-- específica é selecionada (aparecem apenas em "Todas").
--
-- Sem alteração nas regras de cálculo (pontos/vitorias/empates/derrotas/
-- partidas/gols/assistencias/gols_contra). Apenas adiciona `j.posicao` no
-- SELECT e no GROUP BY.
--
-- NOTA: `j.posicao` vai no FINAL do SELECT (não após `nome`) porque o
-- Postgres proíbe `CREATE OR REPLACE VIEW` de mudar nomes de colunas
-- existentes por casamento posicional (erro 42P16). Coluna nova precisa
-- entrar após as colunas já existentes.

CREATE OR REPLACE VIEW ranking AS
SELECT
  pp.jogador_id,
  j.nome,
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
  COALESCE(SUM(pp.gols_contra), 0)                          AS gols_contra,
  j.posicao
FROM partidas_participantes pp
JOIN partidas      p  ON p.id  = pp.partida_id
JOIN partida_placar pl ON pl.partida_id = pp.partida_id
JOIN jogadores     j  ON j.id  = pp.jogador_id
WHERE p.status IN ('published','closed')
GROUP BY pp.jogador_id, j.nome, j.posicao;
