-- Gol contra soma para o adversario e reduz o placar do time que o sofreu.

CREATE OR REPLACE VIEW partida_placar AS
WITH totais AS (
  SELECT
    p.id AS partida_id,
    GREATEST(
      0,
      COALESCE(SUM(CASE WHEN pp.time = 'a' THEN pp.gols - pp.gols_contra ELSE 0 END), 0)
        + COALESCE(SUM(CASE WHEN pp.time = 'b' THEN pp.gols_contra ELSE 0 END), 0)
    ) AS gols_time_a,
    GREATEST(
      0,
      COALESCE(SUM(CASE WHEN pp.time = 'b' THEN pp.gols - pp.gols_contra ELSE 0 END), 0)
        + COALESCE(SUM(CASE WHEN pp.time = 'a' THEN pp.gols_contra ELSE 0 END), 0)
    ) AS gols_time_b
  FROM partidas p
  LEFT JOIN partidas_participantes pp ON pp.partida_id = p.id
  GROUP BY p.id
)
SELECT
  partida_id,
  gols_time_a,
  gols_time_b,
  CASE
    WHEN gols_time_a > gols_time_b THEN 'a'
    WHEN gols_time_a < gols_time_b THEN 'b'
    ELSE 'empate'
  END AS vencedor
FROM totais;