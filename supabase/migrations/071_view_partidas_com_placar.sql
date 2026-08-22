-- 071_view_partidas_com_placar.sql
--
-- View `partidas_com_placar` com colunas: id, data_jogo, status, gols_time_a, gols_time_b.
-- LEFT JOIN de `partidas` com a view agregada `partida_placar` para que o mural
-- de Jogos resolva partidas + placares em UMA unica query, eliminando o
-- waterfall no client (query 1: `partidas`; espera; query 2: `partida_placar.in(ids)`).
--
-- Atencao a partidas SEM placar (rascunho recem-criado, partida sem gols):
--   mesmo principio do LEFT JOIN da view `partida_placar` (007): COALESCE(...,0)
--   garante que toda partida apareca com placar 0x0 mesmo sem linha agregada.
--   A UI continua exibindo o placar tracejado para partidas em status 'draft'.

CREATE OR REPLACE VIEW partidas_com_placar AS
SELECT
  p.id                        AS id,
  p.data_jogo                 AS data_jogo,
  p.status                    AS status,
  COALESCE(pp.gols_time_a, 0) AS gols_time_a,
  COALESCE(pp.gols_time_b, 0) AS gols_time_b
FROM partidas p
LEFT JOIN partida_placar pp ON pp.partida_id = p.id;

GRANT SELECT ON partidas_com_placar TO anon, authenticated;
