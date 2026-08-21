-- 067_desconsiderar_menor_maior_nota_partida.sql
-- Atualiza a view `partida_notas` para desconsiderar a menor e a maior nota recebida
-- no cálculo da média (avg_rating) de cada jogador na partida.
--
-- Regra:
--   - Se o jogador tiver 3 ou mais votos (COUNT >= 3), descarta exatamente uma menor nota
--     e uma maior nota: (SUM(rating) - MIN(rating) - MAX(rating)) / (COUNT - 2).
--   - Se tiver menos de 3 votos (1 ou 2), calcula a média simples normal.
--   - vote_count continua refletindo o total de votos recebidos.
--   - is_craque continua sendo o rank 1 por maior avg_rating -> mais votos -> nome alfabético.

CREATE OR REPLACE VIEW partida_notas AS
WITH raw_agg AS (
  SELECT
    v.partida_id,
    v.target_id,
    j.nome,
    CASE
      WHEN COUNT(*) >= 3 THEN (SUM(v.rating) - MIN(v.rating) - MAX(v.rating))::numeric / (COUNT(*) - 2)
      ELSE AVG(v.rating)::numeric
    END                                                        AS avg_rating,
    COUNT(*)::bigint                                           AS vote_count
  FROM votes v
  JOIN jogadores j ON j.id = v.target_id
  GROUP BY v.partida_id, v.target_id, j.nome
),
agg AS (
  SELECT
    partida_id,
    target_id,
    nome,
    avg_rating,
    vote_count,
    RANK() OVER (
      PARTITION BY partida_id
      ORDER BY avg_rating DESC, vote_count DESC, nome ASC
    )                                                          AS rk
  FROM raw_agg
)
SELECT
  partida_id,
  target_id,
  nome,
  avg_rating,
  vote_count,
  (rk = 1) AS is_craque
FROM agg;

GRANT SELECT ON partida_notas TO anon, authenticated;
