-- 008_view_partida_notas.sql
-- View `partida_notas` com colunas: partida_id, target_id, nome, avg_rating,
-- vote_count, is_craque.
--   - Agrega `votes` por (partida_id, target_id):
--       avg_rating = AVG(rating), vote_count = COUNT(*).
--   - Join com jogadores para trazer `nome`.
--   - `is_craque` boolean resolvido via window function:
--       RANK() OVER (PARTITION BY partida_id
--                    ORDER BY avg_rating DESC, vote_count DESC, nome ASC) = 1
--     Desempate: maior media -> mais votos -> nome alfabetico.
--     Calculado numa CTE primeiro; depois `is_craque = (rk = 1)`.
--   - NAO expoe voter_id: esta view e a unica fonte de notas/craque na UI,
--     preservando a propriedade de "anonimato da UX" (Regra 6).
--
-- Nota: pode haver empate no rank 1 (dois jogadores com mesma media, mesmos
-- votos e mesmo nome - improvavel, mas o RANK() atribui 1 a todos os empatados
-- e ambos ficariam is_craque=true). Isso e aceitavel para o MVP.

CREATE OR REPLACE VIEW partida_notas AS
WITH agg AS (
  SELECT
    v.partida_id,
    v.target_id,
    j.nome,
    AVG(v.rating)::numeric                                     AS avg_rating,
    COUNT(*)::bigint                                           AS vote_count,
    RANK() OVER (
      PARTITION BY v.partida_id
      ORDER BY AVG(v.rating) DESC, COUNT(*) DESC, j.nome ASC
    )                                                          AS rk
  FROM votes v
  JOIN jogadores j ON j.id = v.target_id
  GROUP BY v.partida_id, v.target_id, j.nome
)
SELECT
  partida_id,
  target_id,
  nome,
  avg_rating,
  vote_count,
  (rk = 1) AS is_craque
FROM agg;
