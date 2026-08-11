-- 042_rpc_parcerias_destaque_jogador.sql
-- RPC `parcerias_destaque_jogador(p_jogador_id bigint, p_min_partidas integer DEFAULT 5)`
-- Devolve ate 3 linhas com companheiros de time (mesmo time) que mais se
-- associaram ao jogador logado em metricas de gols e notas:
--   - 'mais_gols'   : companheiro com quem o jogador logado mais marcou gols
--                     (SUM de pp.gols do PROPRIO usuario) nas partidas em que
--                     ambos jogaram no mesmo time.
--   - 'melhor_nota' : companheiro cuja presenca no mesmo time coincide com a
--                     maior AVG(partida_notas.avg_rating) do proprio usuario.
--   - 'pior_nota'   : mesma metrica da 'melhor_nota', menor valor.
--
-- Cada metrica vem de uma subquery com LIMIT 1, unidas por UNION ALL, de forma
-- que o resultset tem no maximo 3 linhas (e cada metrica pode faltar se nenhum
-- companheiro satisfizer o HAVING).
--
-- Consideracoes:
--   - Apenas partidas com status IN ('published','closed').
--   - Filtro HAVING COUNT(*) >= p_min_partidas (default 5), igual ao
--     `parcerias_jogador`, para evitar fluke em poucos jogos.
--   - Gols considerados sao apenas `gols` (a favor do proprio time); gols_contra
--     (contra o proprio time) NAO entram.
--   - Nota e SEMPRE do ponto de vista do jogador logado (target_id =
--     p_jogador_id em partida_notas). LEFT JOIN faz AVG ignorar partidas sem
--     nota do usuario.
--   - Exclui jogadores placeholder (posicao='random'), igual ao `pares_racha`.
--   - Desempate generico: metrica -> partidas DESC -> nome ASC.

CREATE OR REPLACE FUNCTION parcerias_destaque_jogador(
  p_jogador_id    bigint,
  p_min_partidas  integer DEFAULT 5
)
RETURNS TABLE (
  metrica           text,
  outro_jogador_id  bigint,
  nome              text,
  partidas          bigint,
  valor             numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  -- CTE 1: partidas do jogador logado (so precisamos de partida_id + time).
  WITH jogador_partidas AS (
    SELECT pp.partida_id, pp.time
    FROM partidas_participantes pp
    JOIN partidas p ON p.id = pp.partida_id
    WHERE pp.jogador_id = p_jogador_id
      AND p.status IN ('published','closed')
  ),
  -- CTE 2: gols do proprio usuario por partida (so `gols`, sem gols_contra).
  --        PK (partida_id, jogador_id) garante 1 linha por partida => o LEFT
  --        JOIN nao infla COUNT(*) em `companheiros`.
  usuario_gols AS (
    SELECT partida_id, gols
    FROM partidas_participantes
    WHERE jogador_id = p_jogador_id
  ),
  -- CTE 3: nota media do proprio usuario por partida (view partida_notas agrega
  --        votes por (partida_id, target_id) => 1 linha por partida tambem).
  usuario_notas AS (
    SELECT partida_id, avg_rating
    FROM partida_notas
    WHERE target_id = p_jogador_id
  ),
  -- CTE 4: companheiros (mesmo time) agregados. Para cada companheiro:
  --        partidas compartilhadas, soma de gols do PROPRIO usuario nessas
  --        partidas, e media das notas do PROPRIO usuario nas partidas em que
  --        ele recebeu nota.
  companheiros AS (
    SELECT
      outp.jogador_id,
      j.nome,
      COUNT(*)::bigint                                       AS partidas,
      COALESCE(SUM(ug.gols), 0)::numeric                     AS gols_usuario,
      AVG(un.avg_rating)::numeric                            AS nota_media_usuario
    FROM jogador_partidas jp
    JOIN partidas_participantes outp
      ON outp.partida_id = jp.partida_id
     AND outp.time       = jp.time
     AND outp.jogador_id <> p_jogador_id
    JOIN jogadores      j   ON j.id  = outp.jogador_id
    LEFT JOIN usuario_gols  ug ON ug.partida_id = jp.partida_id
    LEFT JOIN usuario_notas un ON un.partida_id = jp.partida_id
    WHERE j.posicao <> 'random'
    GROUP BY outp.jogador_id, j.nome
    HAVING COUNT(*) >= p_min_partidas
  )
  (SELECT 'mais_gols'::text   AS metrica,
          jogador_id          AS outro_jogador_id,
          nome,
          partidas,
          gols_usuario        AS valor
   FROM companheiros
   ORDER BY gols_usuario DESC NULLS LAST, partidas DESC, nome ASC
   LIMIT 1)
  UNION ALL
  (SELECT 'melhor_nota'::text AS metrica,
          jogador_id          AS outro_jogador_id,
          nome,
          partidas,
          nota_media_usuario  AS valor
   FROM companheiros
   WHERE nota_media_usuario IS NOT NULL
   ORDER BY nota_media_usuario DESC NULLS LAST, partidas DESC, nome ASC
   LIMIT 1)
  UNION ALL
  (SELECT 'pior_nota'::text   AS metrica,
          jogador_id          AS outro_jogador_id,
          nome,
          partidas,
          nota_media_usuario  AS valor
   FROM companheiros
   WHERE nota_media_usuario IS NOT NULL
   ORDER BY nota_media_usuario ASC NULLS LAST, partidas DESC, nome ASC
   LIMIT 1);
$$;

GRANT EXECUTE ON FUNCTION parcerias_destaque_jogador(bigint, integer) TO anon, authenticated;
