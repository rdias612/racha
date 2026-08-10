-- 030_rpc_parcerias_jogador.sql
-- RPC `parcerias_jogador(p_jogador_id bigint, p_min_partidas integer DEFAULT 5)`
-- Devolve o ranking de parcerias do jogador logado:
--   - companheiros (mesmo time) e adversarios (time diferente) num unico resultset.
--   - coluna `tipo` distingue os dois ('companheiro' | 'adversario').
--   - metrica: pontos = vitorias*3 + empates*1 (mesmo criterio do `ranking`).
--   - percentual = pontos / (partidas * 3) -> razao sobre o maximo possivel.
--   - filtro HAVING COUNT(*) >= p_min_partidas (default 5) para evitar fluke.
--   - vitorias/empates/derrotas sao SEMPRE do ponto de vista do jogador logado
--     (jp.time vs pl.vencedor), igual ao ranking/stats_jogador.
-- Considera apenas partidas com status IN ('published','closed').

CREATE OR REPLACE FUNCTION parcerias_jogador(
  p_jogador_id    bigint,
  p_min_partidas  integer DEFAULT 5
)
RETURNS TABLE (
  tipo            text,
  outro_jogador_id bigint,
  nome            text,
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
  -- CTE 1: todas as partidas do jogador logado com seu time + vencedor
  WITH jogador_partidas AS (
    SELECT pp.partida_id, pp.time, pl.vencedor
    FROM partidas_participantes pp
    JOIN partidas       p  ON p.id  = pp.partida_id
    JOIN partida_placar pl ON pl.partida_id = pp.partida_id
    WHERE pp.jogador_id = p_jogador_id
      AND p.status IN ('published','closed')
  ),
  -- CTE 2: companheiros (mesmo time)
  companheiros AS (
    SELECT
      'companheiro'::text AS tipo,
      outp.jogador_id,
      j.nome,
      COUNT(*)::bigint                                          AS partidas,
      COUNT(*) FILTER (WHERE jp.vencedor = jp.time)::bigint     AS vitorias,
      COUNT(*) FILTER (WHERE jp.vencedor = 'empate')::bigint    AS empates,
      COUNT(*) FILTER (WHERE jp.vencedor <> jp.time
                        AND jp.vencedor <> 'empate')::bigint     AS derrotas
    FROM jogador_partidas jp
    JOIN partidas_participantes outp
      ON outp.partida_id = jp.partida_id
     AND outp.time       = jp.time                 -- mesmo time
     AND outp.jogador_id <> p_jogador_id
    JOIN jogadores j ON j.id = outp.jogador_id
    GROUP BY outp.jogador_id, j.nome
    HAVING COUNT(*) >= p_min_partidas
  ),
  -- CTE 3: adversarios (time diferente)
  adversarios AS (
    SELECT
      'adversario'::text AS tipo,
      outp.jogador_id,
      j.nome,
      COUNT(*)::bigint                                          AS partidas,
      COUNT(*) FILTER (WHERE jp.vencedor = jp.time)::bigint     AS vitorias,
      COUNT(*) FILTER (WHERE jp.vencedor = 'empate')::bigint    AS empates,
      COUNT(*) FILTER (WHERE jp.vencedor <> jp.time
                        AND jp.vencedor <> 'empate')::bigint     AS derrotas
    FROM jogador_partidas jp
    JOIN partidas_participantes outp
      ON outp.partida_id = jp.partida_id
     AND outp.time       <> jp.time                -- time diferente
     AND outp.jogador_id <> p_jogador_id
    JOIN jogadores j ON j.id = outp.jogador_id
    GROUP BY outp.jogador_id, j.nome
    HAVING COUNT(*) >= p_min_partidas
  ),
  todos AS (
    SELECT * FROM companheiros
    UNION ALL
    SELECT * FROM adversarios
  )
  SELECT
    tipo,
    jogador_id AS outro_jogador_id,
    nome,
    partidas,
    vitorias,
    empates,
    derrotas,
    (vitorias * 3 + empates)::bigint AS pontos,
    (vitorias * 3 + empates)::numeric
      / NULLIF(partidas * 3, 0) AS percentual
  FROM todos
  ORDER BY
    tipo ASC,
    percentual DESC NULLS LAST,
    partidas DESC,
    vitorias DESC,
    nome ASC;
$$;

GRANT EXECUTE ON FUNCTION parcerias_jogador(bigint, integer) TO anon, authenticated;
