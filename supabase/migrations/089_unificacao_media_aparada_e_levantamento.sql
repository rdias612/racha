-- 089_unificacao_media_aparada_e_levantamento.sql
--
-- Unificação Canônica de Cálculos SQL (Itens P2-24 e P2-25):
-- 1. Função IMMUTABLE media_aparada(sum, min, max, count):
--    Descarta 1 menor e 1 maior nota quando count >= 3, substituindo a fórmula duplicada.
-- 2. View v_levantamento:
--    Unifica a agregação das participações de partidas com placar e status ('published','closed'),
--    calculando os flags e pontuações (vitoria, empate, derrota, pontos, resultado).
-- 3. Atualização das views e RPCs dependentes:
--    - partida_notas (usa media_aparada)
--    - obter_medias_notas_jogadores (usa media_aparada)
--    - ranking (agrega de v_levantamento)
--    - stats_jogador (agrega de v_levantamento)
--    - parcerias_jogador (agrega de v_levantamento)
--    - parcerias_destaque_jogador (agrega de v_levantamento e partida_notas)
--    - pares_racha (agrega de v_levantamento)
--    - confronto_direto (agrega de v_levantamento e partida_notas)
--    - resumo_ano (agrega de v_levantamento)

-- 1) Função Pura: Média Aparada
CREATE OR REPLACE FUNCTION media_aparada(
  p_sum   numeric,
  p_min   numeric,
  p_max   numeric,
  p_count bigint
)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN p_count >= 3 THEN (p_sum - p_min - p_max)::numeric / (p_count - 2)
    WHEN p_count > 0 THEN p_sum::numeric / p_count
    ELSE NULL
  END;
$$;

GRANT EXECUTE ON FUNCTION media_aparada(numeric, numeric, numeric, bigint) TO anon, authenticated;

-- 2) View Intermediária de Levantamento de Participações e Resultados
CREATE OR REPLACE VIEW v_levantamento AS
SELECT
  pp.partida_id,
  pp.jogador_id,
  pp.time,
  COALESCE(pp.gols, 0)::bigint AS gols,
  COALESCE(pp.assistencias, 0)::bigint AS assistencias,
  COALESCE(pp.gols_contra, 0)::bigint AS gols_contra,
  pl.vencedor,
  CASE
    WHEN pl.vencedor = pp.time THEN 'vitoria'
    WHEN pl.vencedor = 'empate' THEN 'empate'
    ELSE 'derrota'
  END AS resultado,
  CASE
    WHEN pl.vencedor = pp.time THEN 3
    WHEN pl.vencedor = 'empate' THEN 1
    ELSE 0
  END AS pontos,
  (pl.vencedor = pp.time) AS vitoria,
  (pl.vencedor = 'empate') AS empate,
  (pl.vencedor <> pp.time AND pl.vencedor <> 'empate') AS derrota,
  p.data_jogo
FROM partidas_participantes pp
JOIN partidas p ON p.id = pp.partida_id
JOIN partida_placar pl ON pl.partida_id = pp.partida_id
WHERE p.status IN ('published', 'closed');

GRANT SELECT ON v_levantamento TO anon, authenticated;

-- 3) View partida_notas com media_aparada
CREATE OR REPLACE VIEW partida_notas AS
WITH raw_agg AS (
  SELECT
    v.partida_id,
    v.target_id,
    j.username,
    media_aparada(SUM(v.rating), MIN(v.rating), MAX(v.rating), COUNT(*)) AS avg_rating,
    COUNT(*)::bigint                                                    AS vote_count
  FROM votes v
  JOIN jogadores j ON j.id = v.target_id
  GROUP BY v.partida_id, v.target_id, j.username
),
agg AS (
  SELECT
    partida_id,
    target_id,
    username,
    avg_rating,
    vote_count,
    RANK() OVER (
      PARTITION BY partida_id
      ORDER BY avg_rating DESC, vote_count DESC, username ASC
    )                                                                   AS rk
  FROM raw_agg
)
SELECT
  partida_id,
  target_id,
  username,
  avg_rating,
  vote_count,
  (rk = 1) AS is_craque
FROM agg;

GRANT SELECT ON partida_notas TO anon, authenticated;

-- 4) RPC obter_medias_notas_jogadores com media_aparada
CREATE OR REPLACE FUNCTION obter_medias_notas_jogadores()
RETURNS TABLE (
  jogador_id bigint,
  media_nota numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    v.target_id AS jogador_id,
    ROUND(
      media_aparada(SUM(v.rating), MIN(v.rating), MAX(v.rating), COUNT(*)),
      2
    ) AS media_nota
  FROM votes v
  GROUP BY v.target_id;
$$;

GRANT EXECUTE ON FUNCTION obter_medias_notas_jogadores() TO anon, authenticated;

-- 5) View ranking a partir de v_levantamento
CREATE OR REPLACE VIEW ranking AS
SELECT
  l.jogador_id,
  j.username,
  SUM(l.pontos)::bigint                                     AS pontos,
  COUNT(*) FILTER (WHERE l.vitoria)::bigint                 AS vitorias,
  COUNT(*) FILTER (WHERE l.empate)::bigint                  AS empates,
  COUNT(*) FILTER (WHERE l.derrota)::bigint                 AS derrotas,
  COUNT(*)::bigint                                          AS partidas,
  SUM(l.gols)::bigint                                       AS gols,
  SUM(l.assistencias)::bigint                               AS assistencias,
  SUM(l.gols_contra)::bigint                                AS gols_contra,
  j.posicao
FROM v_levantamento l
JOIN jogadores j ON j.id = l.jogador_id
GROUP BY l.jogador_id, j.username, j.posicao;

GRANT SELECT ON ranking TO anon, authenticated;

-- 6) View stats_jogador a partir de v_levantamento
CREATE OR REPLACE VIEW stats_jogador AS
SELECT
  l.jogador_id,
  COUNT(*)::bigint                                          AS partidas,
  SUM(l.gols)::bigint                                       AS gols,
  SUM(l.assistencias)::bigint                               AS assistencias,
  COUNT(*) FILTER (WHERE l.vitoria)::bigint                 AS vitorias,
  SUM(l.gols_contra)::bigint                                AS gols_contra
FROM v_levantamento l
GROUP BY l.jogador_id;

GRANT SELECT ON stats_jogador TO anon, authenticated;

-- 7) RPC parcerias_jogador a partir de v_levantamento
CREATE OR REPLACE FUNCTION parcerias_jogador(
  p_jogador_id    bigint,
  p_min_partidas  integer DEFAULT 5
)
RETURNS TABLE (
  tipo             text,
  outro_jogador_id bigint,
  username         text,
  partidas         bigint,
  vitorias         bigint,
  empates          bigint,
  derrotas         bigint,
  pontos           bigint,
  percentual       numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH jogador_partidas AS (
    SELECT partida_id, time, vitoria, empate, derrota, pontos
    FROM v_levantamento
    WHERE jogador_id = p_jogador_id
  ),
  companheiros AS (
    SELECT
      'companheiro'::text AS tipo,
      outl.jogador_id,
      j.username,
      COUNT(*)::bigint                                          AS partidas,
      COUNT(*) FILTER (WHERE jp.vitoria)::bigint                AS vitorias,
      COUNT(*) FILTER (WHERE jp.empate)::bigint                 AS empates,
      COUNT(*) FILTER (WHERE jp.derrota)::bigint                AS derrotas
    FROM jogador_partidas jp
    JOIN v_levantamento outl
      ON outl.partida_id = jp.partida_id
     AND outl.time       = jp.time
     AND outl.jogador_id <> p_jogador_id
    JOIN jogadores j ON j.id = outl.jogador_id
    GROUP BY outl.jogador_id, j.username
    HAVING COUNT(*) >= p_min_partidas
  ),
  adversarios AS (
    SELECT
      'adversario'::text AS tipo,
      outl.jogador_id,
      j.username,
      COUNT(*)::bigint                                          AS partidas,
      COUNT(*) FILTER (WHERE jp.vitoria)::bigint                AS vitorias,
      COUNT(*) FILTER (WHERE jp.empate)::bigint                 AS empates,
      COUNT(*) FILTER (WHERE jp.derrota)::bigint                AS derrotas
    FROM jogador_partidas jp
    JOIN v_levantamento outl
      ON outl.partida_id = jp.partida_id
     AND outl.time       <> jp.time
     AND outl.jogador_id <> p_jogador_id
    JOIN jogadores j ON j.id = outl.jogador_id
    GROUP BY outl.jogador_id, j.username
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
    username,
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
    pontos DESC,
    partidas DESC,
    vitorias DESC,
    username ASC;
$$;

GRANT EXECUTE ON FUNCTION parcerias_jogador(bigint, integer) TO anon, authenticated;

-- 8) RPC parcerias_destaque_jogador a partir de v_levantamento e partida_notas
CREATE OR REPLACE FUNCTION parcerias_destaque_jogador(
  p_jogador_id   bigint,
  p_min_partidas integer DEFAULT 3
)
RETURNS TABLE (
  metrica          text,
  outro_jogador_id bigint,
  username         text,
  partidas         bigint,
  valor            numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH jogador_partidas AS (
    SELECT partida_id, time, gols
    FROM v_levantamento
    WHERE jogador_id = p_jogador_id
  ),
  usuario_notas AS (
    SELECT partida_id, avg_rating
    FROM partida_notas
    WHERE target_id = p_jogador_id
  ),
  companheiros AS (
    SELECT
      outl.jogador_id,
      j.username,
      COUNT(*)::bigint                                       AS partidas,
      COALESCE(SUM(jp.gols), 0)::numeric                     AS gols_usuario,
      AVG(un.avg_rating)::numeric                            AS nota_media_usuario
    FROM jogador_partidas jp
    JOIN v_levantamento outl
      ON outl.partida_id = jp.partida_id
     AND outl.time       = jp.time
     AND outl.jogador_id <> p_jogador_id
    JOIN jogadores      j   ON j.id  = outl.jogador_id
    LEFT JOIN usuario_notas un ON un.partida_id = jp.partida_id
    WHERE j.posicao <> 'random'
    GROUP BY outl.jogador_id, j.username
    HAVING COUNT(*) >= p_min_partidas
  )
  (SELECT 'mais_gols'::text   AS metrica,
          jogador_id          AS outro_jogador_id,
          username,
          partidas,
          gols_usuario        AS valor
   FROM companheiros
   ORDER BY gols_usuario DESC NULLS LAST, partidas DESC, username ASC
   LIMIT 1)
  UNION ALL
  (SELECT 'melhor_nota'::text AS metrica,
          jogador_id          AS outro_jogador_id,
          username,
          partidas,
          nota_media_usuario  AS valor
   FROM companheiros
   WHERE nota_media_usuario IS NOT NULL
   ORDER BY nota_media_usuario DESC NULLS LAST, partidas DESC, username ASC
   LIMIT 1)
  UNION ALL
  (SELECT 'pior_nota'::text   AS metrica,
          jogador_id          AS outro_jogador_id,
          username,
          partidas,
          nota_media_usuario  AS valor
   FROM companheiros
   WHERE nota_media_usuario IS NOT NULL
   ORDER BY nota_media_usuario ASC NULLS LAST, partidas DESC, username ASC
   LIMIT 1);
$$;

GRANT EXECUTE ON FUNCTION parcerias_destaque_jogador(bigint, integer) TO anon, authenticated;

-- 9) RPC pares_racha a partir de v_levantamento
CREATE OR REPLACE FUNCTION pares_racha(
  p_min_partidas integer DEFAULT 5
)
RETURNS TABLE (
  jogador_a_id   bigint,
  jogador_b_id   bigint,
  jogador_a_username text,
  jogador_b_username text,
  partidas       bigint,
  vitorias       bigint,
  empates        bigint,
  derrotas       bigint,
  pontos         bigint,
  percentual     numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH participacoes AS (
    SELECT
      l.partida_id,
      l.time,
      l.jogador_id,
      l.vitoria,
      l.empate,
      l.derrota
    FROM v_levantamento l
    JOIN jogadores j ON j.id = l.jogador_id
    WHERE j.posicao <> 'random'
  ),
  pares AS (
    SELECT
      a.jogador_id AS jogador_a_id,
      b.jogador_id AS jogador_b_id,
      a.vitoria,
      a.empate,
      a.derrota
    FROM participacoes a
    JOIN participacoes b
      ON b.partida_id = a.partida_id
     AND b.time       = a.time
     AND b.jogador_id > a.jogador_id
  ),
  agregado AS (
    SELECT
      jogador_a_id,
      jogador_b_id,
      COUNT(*)::bigint                                      AS partidas,
      COUNT(*) FILTER (WHERE vitoria)::bigint               AS vitorias,
      COUNT(*) FILTER (WHERE empate)::bigint                AS empates,
      COUNT(*) FILTER (WHERE derrota)::bigint               AS derrotas
    FROM pares
    GROUP BY jogador_a_id, jogador_b_id
    HAVING COUNT(*) >= p_min_partidas
  )
  SELECT
    a.jogador_a_id,
    a.jogador_b_id,
    ja.username AS jogador_a_username,
    jb.username AS jogador_b_username,
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
    pontos             DESC,
    partidas           DESC,
    vitorias           DESC,
    jogador_a_username ASC,
    jogador_b_username ASC;
$$;

GRANT EXECUTE ON FUNCTION pares_racha(integer) TO anon, authenticated;

-- 10) RPC confronto_direto a partir de v_levantamento e partida_notas
CREATE OR REPLACE FUNCTION confronto_direto(
  p_jogador_a    bigint,
  p_jogador_b    bigint
)
RETURNS TABLE (
  lado           text,
  bloco          text,
  partidas       bigint,
  gols           bigint,
  assistencias   bigint,
  gols_contra    bigint,
  vitorias       bigint,
  empates        bigint,
  derrotas       bigint,
  media_nota     numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1) Validações dos parâmetros.
  IF p_jogador_a = p_jogador_b THEN
    RAISE EXCEPTION 'Selecione dois atletas diferentes.';
  END IF;

  IF (SELECT COUNT(*) FROM jogadores j
       WHERE j.id IN (p_jogador_a, p_jogador_b)
         AND j.posicao <> 'random') <> 2 THEN
    RAISE EXCEPTION 'Atleta não encontrado.';
  END IF;

  -- 2) Agregados por (lado, bloco); o LEFT JOIN final garante as 4 linhas.
  RETURN QUERY
  WITH encontros AS (
    SELECT
      la.partida_id               AS partida_id,
      la.time                     AS time_a,
      lb.time                     AS time_b,
      la.vitoria                  AS vitoria_a,
      lb.vitoria                  AS vitoria_b,
      la.empate                   AS empate,
      la.derrota                  AS derrota_a,
      lb.derrota                  AS derrota_b,
      la.gols                     AS gols_a,
      lb.gols                     AS gols_b,
      la.assistencias             AS assistencias_a,
      lb.assistencias             AS assistencias_b,
      la.gols_contra              AS gols_contra_a,
      lb.gols_contra              AS gols_contra_b
    FROM v_levantamento la
    JOIN v_levantamento lb
      ON lb.partida_id = la.partida_id
     AND lb.jogador_id = p_jogador_b
    WHERE la.jogador_id = p_jogador_a
  ),
  lados AS (
    SELECT 'a'::text AS lado, p_jogador_a AS jogador_id
    UNION ALL
    SELECT 'b'::text, p_jogador_b
  ),
  encontros_lado AS (
    SELECT
      ld.lado,
      ld.jogador_id,
      en.partida_id,
      CASE WHEN en.time_a = en.time_b THEN 'juntos' ELSE 'adversos' END AS relacao,
      CASE WHEN ld.lado = 'a' THEN en.gols_a ELSE en.gols_b END AS gols,
      CASE WHEN ld.lado = 'a' THEN en.assistencias_a ELSE en.assistencias_b END AS assistencias,
      CASE WHEN ld.lado = 'a' THEN en.gols_contra_a ELSE en.gols_contra_b END AS gols_contra,
      CASE WHEN ld.lado = 'a' THEN en.vitoria_a ELSE en.vitoria_b END AS vitoria,
      en.empate,
      CASE WHEN ld.lado = 'a' THEN en.derrota_a ELSE en.derrota_b END AS derrota
    FROM encontros en
    CROSS JOIN lados ld
  ),
  por_contexto AS (
    SELECT
      el.lado,
      el.relacao,
      COUNT(*)::bigint                                             AS qtd_partidas,
      COALESCE(SUM(el.gols), 0)::bigint                           AS qtd_gols,
      COALESCE(SUM(el.assistencias), 0)::bigint                   AS qtd_assistencias,
      COALESCE(SUM(el.gols_contra), 0)::bigint                    AS qtd_gols_contra,
      COUNT(*) FILTER (WHERE el.vitoria)::bigint                  AS qtd_vitorias,
      COUNT(*) FILTER (WHERE el.empate)::bigint                   AS qtd_empates,
      COUNT(*) FILTER (WHERE el.derrota)::bigint                  AS qtd_derrotas,
      AVG(pn.avg_rating)::numeric                                 AS val_media_nota
    FROM encontros_lado el
    LEFT JOIN partida_notas pn
      ON pn.partida_id = el.partida_id
     AND pn.target_id  = el.jogador_id
    GROUP BY el.lado, el.relacao
  ),
  combinacoes(lado, bloco) AS (
    VALUES ('a','juntos'), ('a','adversos'), ('b','juntos'), ('b','adversos')
  )
  SELECT
    cb.lado                                   AS lado,
    cb.bloco                                  AS bloco,
    COALESCE(pc.qtd_partidas, 0)              AS partidas,
    COALESCE(pc.qtd_gols, 0)                  AS gols,
    COALESCE(pc.qtd_assistencias, 0)          AS assistencias,
    COALESCE(pc.qtd_gols_contra, 0)           AS gols_contra,
    COALESCE(pc.qtd_vitorias, 0)              AS vitorias,
    COALESCE(pc.qtd_empates, 0)               AS empates,
    COALESCE(pc.qtd_derrotas, 0)              AS derrotas,
    pc.val_media_nota                         AS media_nota
  FROM combinacoes cb
  LEFT JOIN por_contexto pc
    ON pc.lado    = cb.lado
   AND pc.relacao = cb.bloco
  ORDER BY cb.bloco, cb.lado;
END;
$$;

GRANT EXECUTE ON FUNCTION confronto_direto(bigint, bigint) TO anon, authenticated;

-- 11) RPC resumo_ano a partir de v_levantamento
CREATE OR REPLACE FUNCTION resumo_ano(p_ano integer)
RETURNS TABLE (
  ano integer,
  total_partidas bigint,
  artilheiro_jogador_id bigint,
  artilheiro_username text,
  artilheiro_gols bigint,
  artilheiro_partidas bigint,
  maestro_jogador_id bigint,
  maestro_username text,
  maestro_assistencias bigint,
  maestro_partidas bigint,
  participante_jogador_id bigint,
  participante_username text,
  participante_partidas bigint,
  eficiente_jogador_id bigint,
  eficiente_username text,
  eficiente_vitorias bigint,
  eficiente_partidas bigint,
  eficiente_percentual numeric,
  sequencia_vitorias_jogador_id bigint,
  sequencia_vitorias_username text,
  sequencia_vitorias bigint,
  seca_vitorias_jogador_id bigint,
  seca_vitorias_username text,
  seca_vitorias bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH partidas_ano AS (
    SELECT DISTINCT l.partida_id AS id, l.data_jogo
    FROM v_levantamento l
    WHERE EXTRACT(
        YEAR FROM l.data_jogo AT TIME ZONE 'America/Sao_Paulo'
      )::integer = p_ano
  ),
  total AS (
    SELECT COUNT(*)::bigint AS partidas
    FROM partidas_ano
  ),
  stats AS (
    SELECT
      l.jogador_id,
      j.username,
      COUNT(*)::bigint AS partidas,
      SUM(l.gols)::bigint AS gols,
      SUM(l.assistencias)::bigint AS assistencias,
      COUNT(*) FILTER (WHERE l.vitoria)::bigint AS vitorias
    FROM v_levantamento l
    JOIN jogadores j ON j.id = l.jogador_id
    WHERE j.posicao <> 'random'
      AND EXTRACT(
        YEAR FROM l.data_jogo AT TIME ZONE 'America/Sao_Paulo'
      )::integer = p_ano
    GROUP BY l.jogador_id, j.username
  ),
  stats_elegiveis AS (
    SELECT s.*
    FROM stats s
    CROSS JOIN total t
    WHERE t.partidas > 0
      AND (s.partidas::numeric / t.partidas) >= 0.33
  ),
  jogador_partidas AS (
    SELECT
      l.jogador_id,
      j.username,
      l.partida_id,
      l.data_jogo,
      l.vitoria AS venceu,
      ROW_NUMBER() OVER (
        PARTITION BY l.jogador_id
        ORDER BY l.data_jogo DESC, l.partida_id DESC
      ) AS rn
    FROM v_levantamento l
    JOIN jogadores j ON j.id = l.jogador_id
    WHERE j.posicao <> 'random'
      AND EXTRACT(
        YEAR FROM l.data_jogo AT TIME ZONE 'America/Sao_Paulo'
      )::integer = p_ano
  ),
  jogador_primeira_derrota AS (
    SELECT
      jogador_id,
      username,
      MIN(rn) FILTER (WHERE NOT venceu) AS first_loss_rn,
      MAX(rn) AS total_jogos
    FROM jogador_partidas
    GROUP BY jogador_id, username
  ),
  sequencias_vitorias_atuais AS (
    SELECT
      jogador_id,
      username,
      COALESCE(first_loss_rn - 1, total_jogos)::bigint AS tamanho
    FROM jogador_primeira_derrota
  ),
  jogador_primeira_vitoria AS (
    SELECT
      jogador_id,
      username,
      MIN(rn) FILTER (WHERE venceu) AS first_win_rn,
      MAX(rn) AS total_jogos
    FROM jogador_partidas
    GROUP BY jogador_id, username
  ),
  secas_vitorias_atuais AS (
    SELECT
      jogador_id,
      username,
      COALESCE(first_win_rn - 1, total_jogos)::bigint AS tamanho
    FROM jogador_primeira_vitoria
  ),
  artilheiro AS (
    SELECT s.jogador_id, s.username, s.gols, s.partidas
    FROM stats_elegiveis s
    WHERE s.gols > 0
    ORDER BY s.gols DESC, s.partidas DESC, s.username ASC
    LIMIT 1
  ),
  maestro AS (
    SELECT s.jogador_id, s.username, s.assistencias, s.partidas
    FROM stats_elegiveis s
    WHERE s.assistencias > 0
    ORDER BY s.assistencias DESC, s.partidas DESC, s.username ASC
    LIMIT 1
  ),
  participante AS (
    SELECT s.jogador_id, s.username, s.partidas
    FROM stats s
    ORDER BY s.partidas DESC, s.gols DESC, s.username ASC
    LIMIT 1
  ),
  eficiente AS (
    SELECT
      s.jogador_id,
      s.username,
      s.vitorias,
      s.partidas,
      ROUND((s.vitorias::numeric / NULLIF(s.partidas, 0)) * 100, 1) AS percentual
    FROM stats_elegiveis s
    ORDER BY (s.vitorias::numeric / NULLIF(s.partidas, 0)) DESC,
             s.vitorias DESC,
             s.partidas DESC,
             s.username ASC
    LIMIT 1
  ),
  sequencia_vitorias AS (
    SELECT sva.jogador_id, sva.username, sva.tamanho
    FROM sequencias_vitorias_atuais sva
    ORDER BY sva.tamanho DESC, sva.username ASC
    LIMIT 1
  ),
  seca_vitorias AS (
    SELECT sva.jogador_id, sva.username, sva.tamanho
    FROM secas_vitorias_atuais sva
    ORDER BY sva.tamanho DESC, sva.username ASC
    LIMIT 1
  )
  SELECT
    p_ano,
    COALESCE((SELECT partidas FROM total), 0::bigint),
    a.jogador_id,
    a.username,
    a.gols,
    a.partidas,
    m.jogador_id,
    m.username,
    m.assistencias,
    m.partidas,
    pt.jogador_id,
    pt.username,
    pt.partidas,
    e.jogador_id,
    e.username,
    e.vitorias,
    e.partidas,
    e.percentual,
    sv.jogador_id,
    sv.username,
    sv.tamanho,
    sc.jogador_id,
    sc.username,
    sc.tamanho
  FROM (SELECT 1) _
  LEFT JOIN artilheiro a ON true
  LEFT JOIN maestro m ON true
  LEFT JOIN participante pt ON true
  LEFT JOIN eficiente e ON true
  LEFT JOIN sequencia_vitorias sv ON true
  LEFT JOIN seca_vitorias sc ON true;
$$;

GRANT EXECUTE ON FUNCTION resumo_ano(integer) TO anon, authenticated;
