-- 007_view_partida_placar.sql
-- View `partida_placar` com colunas: partida_id, gols_time_a, gols_time_b, vencedor.
--   gols_time_a = SUM(gols) WHERE time='a' por partida.
--   gols_time_b = SUM(gols) WHERE time='b' por partida.
--   vencedor: 'a' | 'b' | 'empate' (derivado comparando os placares).
--
-- Atenco a partidas SEM participantes (rascunho recem-criado, partida vazia):
--   usamos LEFT JOIN partidas + COALESCE(...,0) para que toda partida apareca
--   com placar 0x0 e vencedor='empate' mesmo sem gols/participantes.
--   Sem o LEFT JOIN, uma partida sem participantes sumiria do resultado.

CREATE OR REPLACE VIEW partida_placar AS
SELECT
  p.id                                                          AS partida_id,
  COALESCE(SUM(CASE WHEN pp.time = 'a' THEN pp.gols END), 0)    AS gols_time_a,
  COALESCE(SUM(CASE WHEN pp.time = 'b' THEN pp.gols END), 0)    AS gols_time_b,
  CASE
    WHEN COALESCE(SUM(CASE WHEN pp.time = 'a' THEN pp.gols END), 0)
       > COALESCE(SUM(CASE WHEN pp.time = 'b' THEN pp.gols END), 0)
      THEN 'a'
    WHEN COALESCE(SUM(CASE WHEN pp.time = 'a' THEN pp.gols END), 0)
       < COALESCE(SUM(CASE WHEN pp.time = 'b' THEN pp.gols END), 0)
      THEN 'b'
    ELSE 'empate'
  END                                                           AS vencedor
FROM partidas p
LEFT JOIN partidas_participantes pp ON pp.partida_id = p.id
GROUP BY p.id;
