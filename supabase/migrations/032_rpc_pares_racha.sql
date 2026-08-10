-- 032_rpc_pares_racha.sql
-- RPC `pares_racha(p_min_partidas integer DEFAULT 5)`
-- Ranking GLOBAL de duplas (2 jogadores que jogaram JUNTOS no mesmo time):
--   - par nao-ordenado: (jogador_a_id, jogador_b_id) com a.id < b.id garante
--     que cada dupla apareca uma unica vez (sem LEAST/GREATEST).
--   - metrica: pontos = vitorias*3 + empates*1 (mesmo criterio do `ranking` e
--     do `parcerias_jogador`).
--   - percentual = pontos / (partidas*3) -> razao sobre o maximo possivel.
--   - filtro HAVING COUNT(*) >= p_min_partidas (default 5) para evitar fluke.
--   - vitorias empregadas sao SEMPRE do ponto de vista do time conjugado:
--     a.time vs pl.vencedor (igual ranking/parcerias_jogador).
--   - exclui jogadores com posicao='random' (placeholders random1..6).
-- Considera apenas partidas com status IN ('published','closed').
-- O ORDER BY pontos DESC coloca a "melhor dupla" no topo e a "pior" no fim.

CREATE OR REPLACE FUNCTION pares_racha(
  p_min_partidas integer DEFAULT 5
)
RETURNS TABLE (
  jogador_a_id    bigint,
  jogador_b_id    bigint,
  jogador_a_nome  text,
  jogador_b_nome  text,
  partidas        bigint,
  vitorias        bigint,
  empates         bigint,
  derrotas        bigint,
  pontos          bigint,
  percentual      numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  -- CTE 1: cada (partida, time, jogador) com o vencedor da partida.
  --        Filtra status e exclui jogadores placeholder 'random'.
  WITH participacoes AS (
    SELECT
      pp.partida_id,
      pp.time,
      pp.jogador_id,
      pl.vencedor
    FROM partidas_participantes pp
    JOIN partidas       p  ON p.id  = pp.partida_id
    JOIN partida_placar pl ON pl.partida_id = pp.partida_id
    JOIN jogadores      j  ON j.id  = pp.jogador_id
    WHERE p.status IN ('published','closed')
      AND j.posicao <> 'random'
  ),
  -- CTE 2: self-join na mesma (partida, time) -> cada par de companheiros.
  --        a.jogador_id < b.jogador_id garante o par nao-ordenado (unico).
  pares AS (
    SELECT
      a.jogador_id AS jogador_a_id,
      b.jogador_id AS jogador_b_id,
      a.vencedor   AS vencedor,
      a.time       AS time
    FROM participacoes a
    JOIN participacoes b
      ON b.partida_id = a.partida_id
     AND b.time       = a.time
     AND b.jogador_id > a.jogador_id
  ),
  -- CTE 3: agrega por par, contando V/E/D e aplicando o filtro de minimo.
  agregado AS (
    SELECT
      jogador_a_id,
      jogador_b_id,
      COUNT(*)::bigint                                      AS partidas,
      COUNT(*) FILTER (WHERE vencedor = time)::bigint       AS vitorias,
      COUNT(*) FILTER (WHERE vencedor = 'empate')::bigint   AS empates,
      COUNT(*) FILTER (WHERE vencedor <> time
                        AND vencedor <> 'empate')::bigint    AS derrotas
    FROM pares
    GROUP BY jogador_a_id, jogador_b_id
    HAVING COUNT(*) >= p_min_partidas
  )
  SELECT
    a.jogador_a_id,
    a.jogador_b_id,
    ja.nome AS jogador_a_nome,
    jb.nome AS jogador_b_nome,
    a.partidas,
    a.vitorias,
    a.empates,
    a.derrotas,
    (a.vitorias * 3 + a.empates)::bigint AS pontos,
    (a.vitorias * 3 + a.empates)::numeric
      / NULLIF(a.partidas * 3, 0) AS percentual
  FROM agregado a
  JOIN jogadores ja ON ja.id = a.jogador_a_id
  JOIN jogadores jb ON jb.id = a.jogador_b_id
  ORDER BY
    pontos         DESC,
    partidas       DESC,
    vitorias       DESC,
    jogador_a_nome ASC,
    jogador_b_nome ASC;
$$;

GRANT EXECUTE ON FUNCTION pares_racha(integer) TO anon, authenticated;
