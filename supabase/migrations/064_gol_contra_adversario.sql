-- Gol contra beneficia o time adversario, sem retirar gols normais.

CREATE OR REPLACE VIEW partida_placar AS
SELECT
  p.id AS partida_id,
  COALESCE(SUM(CASE WHEN pp.time = 'a' THEN pp.gols ELSE 0 END), 0)
    + COALESCE(SUM(CASE WHEN pp.time = 'b' THEN pp.gols_contra ELSE 0 END), 0)
    AS gols_time_a,
  COALESCE(SUM(CASE WHEN pp.time = 'b' THEN pp.gols ELSE 0 END), 0)
    + COALESCE(SUM(CASE WHEN pp.time = 'a' THEN pp.gols_contra ELSE 0 END), 0)
    AS gols_time_b,
  CASE
    WHEN (
      COALESCE(SUM(CASE WHEN pp.time = 'a' THEN pp.gols ELSE 0 END), 0)
      + COALESCE(SUM(CASE WHEN pp.time = 'b' THEN pp.gols_contra ELSE 0 END), 0)
    ) > (
      COALESCE(SUM(CASE WHEN pp.time = 'b' THEN pp.gols ELSE 0 END), 0)
      + COALESCE(SUM(CASE WHEN pp.time = 'a' THEN pp.gols_contra ELSE 0 END), 0)
    ) THEN 'a'
    WHEN (
      COALESCE(SUM(CASE WHEN pp.time = 'a' THEN pp.gols ELSE 0 END), 0)
      + COALESCE(SUM(CASE WHEN pp.time = 'b' THEN pp.gols_contra ELSE 0 END), 0)
    ) < (
      COALESCE(SUM(CASE WHEN pp.time = 'b' THEN pp.gols ELSE 0 END), 0)
      + COALESCE(SUM(CASE WHEN pp.time = 'a' THEN pp.gols_contra ELSE 0 END), 0)
    ) THEN 'b'
    ELSE 'empate'
  END AS vencedor
FROM partidas p
LEFT JOIN partidas_participantes pp ON pp.partida_id = p.id
GROUP BY p.id;