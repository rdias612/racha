-- 076_remover_coluna_nome_jogadores.sql
-- Remove a coluna `nome` da tabela `jogadores` e unifica a identidade dos atletas exclusivamente em `username`.
-- Recria views e RPCs dependentes de `nome`.

-- 1. Recriação da view `partida_notas` sem a coluna `nome`
DROP VIEW IF EXISTS partida_notas CASCADE;

CREATE OR REPLACE VIEW partida_notas AS
WITH raw_agg AS (
  SELECT
    v.partida_id,
    v.target_id,
    j.username,
    CASE
      WHEN COUNT(*) >= 3 THEN (SUM(v.rating) - MIN(v.rating) - MAX(v.rating))::numeric / (COUNT(*) - 2)
      ELSE AVG(v.rating)::numeric
    END                                                        AS avg_rating,
    COUNT(*)::bigint                                           AS vote_count
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
    )                                                          AS rk
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

-- 2. Recriação da view `ranking` sem a coluna `nome`
DROP VIEW IF EXISTS ranking CASCADE;

CREATE OR REPLACE VIEW ranking AS
SELECT
  pp.jogador_id,
  j.username,
  (
    COUNT(*) FILTER (
      WHERE pl.vencedor = pp.time
    ) * 3
    +
    COUNT(*) FILTER (
      WHERE pl.vencedor = 'empate'
    ) * 1
  )                                                         AS pontos,
  COUNT(*) FILTER (WHERE pl.vencedor = pp.time)             AS vitorias,
  COUNT(*) FILTER (WHERE pl.vencedor = 'empate')            AS empates,
  COUNT(*) FILTER (WHERE pl.vencedor <> pp.time
                    AND pl.vencedor <> 'empate')            AS derrotas,
  COUNT(*)                                                  AS partidas,
  COALESCE(SUM(pp.gols), 0)                                 AS gols,
  COALESCE(SUM(pp.assistencias), 0)                         AS assistencias,
  COALESCE(SUM(pp.gols_contra), 0)                          AS gols_contra,
  j.posicao
FROM partidas_participantes pp
JOIN partidas      p  ON p.id  = pp.partida_id
JOIN partida_placar pl ON pl.partida_id = pp.partida_id
JOIN jogadores     j  ON j.id  = pp.jogador_id
WHERE p.status IN ('published','closed')
GROUP BY pp.jogador_id, j.username, j.posicao;

GRANT SELECT ON ranking TO anon, authenticated;

-- 3. Recriação da view `dividas_resumo` sem a coluna `nome`
DROP VIEW IF EXISTS dividas_resumo CASCADE;

CREATE OR REPLACE VIEW dividas_resumo AS
SELECT
  j.id            AS jogador_id,
  j.username      AS username,
  j.is_mensalista AS is_mensalista,
  COALESCE(SUM(d.valor) FILTER (WHERE d.paga = false), 0)::numeric AS total_devido,
  COUNT(d.id)     FILTER (WHERE d.paga = false)::bigint          AS qtd_dividas
FROM jogadores j
LEFT JOIN dividas d ON d.jogador_id = j.id
GROUP BY j.id, j.username, j.is_mensalista;

GRANT SELECT ON dividas_resumo TO anon, authenticated;

-- 4. Recriação da RPC `fazer_login` sem a coluna `nome`
DROP FUNCTION IF EXISTS fazer_login(text, text);

CREATE OR REPLACE FUNCTION fazer_login(p_username text, p_senha text)
RETURNS TABLE (
  id             bigint,
  username       text,
  posicao        text,
  is_admin       boolean,
  is_ativo       boolean,
  is_mensalista  boolean,
  posicao_b      text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_jogador jogadores%ROWTYPE;
BEGIN
  SELECT * INTO v_jogador
  FROM jogadores
  WHERE username = p_username
    AND is_ativo = true
  LIMIT 1;

  IF v_jogador.id IS NULL THEN
    RETURN;
  END IF;

  IF p_senha <> v_jogador.senha_hash THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    v_jogador.id,
    v_jogador.username,
    v_jogador.posicao,
    v_jogador.is_admin,
    v_jogador.is_ativo,
    v_jogador.is_mensalista,
    v_jogador.posicao_b;
END;
$$;

GRANT EXECUTE ON FUNCTION fazer_login(text, text) TO anon, authenticated;

-- 5. Recriação da RPC `criar_jogador` sem o parâmetro `p_nome`
DROP FUNCTION IF EXISTS criar_jogador(text, text, text, boolean, text, boolean);
DROP FUNCTION IF EXISTS criar_jogador(text, text, boolean, text, boolean);

CREATE OR REPLACE FUNCTION criar_jogador(
  p_username      text,
  p_posicao       text,
  p_is_admin      boolean,
  p_posicao_b     text DEFAULT 'meia',
  p_is_mensalista boolean DEFAULT false
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id bigint;
  v_posicao_b text;
  v_is_mensalista boolean;
BEGIN
  v_posicao_b := CASE WHEN p_posicao = 'goleiro' THEN NULL ELSE p_posicao_b END;
  v_is_mensalista := CASE WHEN p_posicao = 'goleiro' THEN false ELSE COALESCE(p_is_mensalista, false) END;

  INSERT INTO jogadores (username, senha_hash, posicao, is_admin, is_ativo, posicao_b, is_mensalista)
  VALUES (p_username, '123', p_posicao, p_is_admin, true, v_posicao_b, v_is_mensalista)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION criar_jogador(text, text, boolean, text, boolean) TO anon, authenticated;

-- 6. Recriação da RPC `resumo_ano` com campos `*_username`
DROP FUNCTION IF EXISTS resumo_ano(integer);

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
SECURITY DEFINER
SET search_path = public
AS $$
  WITH partidas_ano AS (
    SELECT p.id, p.data_jogo
    FROM partidas p
    WHERE p.status IN ('published', 'closed')
      AND EXTRACT(
        YEAR FROM p.data_jogo AT TIME ZONE 'America/Sao_Paulo'
      )::integer = p_ano
  ),
  total AS (
    SELECT COUNT(*)::bigint AS partidas
    FROM partidas_ano
  ),
  stats AS (
    SELECT
      pp.jogador_id,
      j.username,
      COUNT(*)::bigint AS partidas,
      COALESCE(SUM(pp.gols), 0)::bigint AS gols,
      COALESCE(SUM(pp.assistencias), 0)::bigint AS assistencias,
      COUNT(*) FILTER (WHERE pl.vencedor = pp.time)::bigint AS vitorias
    FROM partidas_participantes pp
    JOIN partidas p ON p.id = pp.partida_id
    JOIN partidas_ano pa ON pa.id = p.id
    JOIN partida_placar pl ON pl.partida_id = pp.partida_id
    JOIN jogadores j ON j.id = pp.jogador_id
    WHERE j.posicao <> 'random'
    GROUP BY pp.jogador_id, j.username
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
      pp.jogador_id,
      j.username,
      p.id AS partida_id,
      p.data_jogo,
      (pl.vencedor = pp.time) AS venceu,
      ROW_NUMBER() OVER (
        PARTITION BY pp.jogador_id
        ORDER BY p.data_jogo DESC, p.id DESC
      ) AS rn
    FROM partidas_participantes pp
    JOIN partidas_ano pa ON pa.id = pp.partida_id
    JOIN partidas p ON p.id = pa.id
    JOIN partida_placar pl ON pl.partida_id = pp.partida_id
    JOIN jogadores j ON j.id = pp.jogador_id
    WHERE j.posicao <> 'random'
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

-- 7. Recriação da RPC `parcerias_jogador`
DROP FUNCTION IF EXISTS parcerias_jogador(bigint, integer);

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
SECURITY DEFINER
SET search_path = public
AS $$
  WITH jogador_partidas AS (
    SELECT pp.partida_id, pp.time, pl.vencedor
    FROM partidas_participantes pp
    JOIN partidas       p  ON p.id  = pp.partida_id
    JOIN partida_placar pl ON pl.partida_id = pp.partida_id
    WHERE pp.jogador_id = p_jogador_id
      AND p.status IN ('published','closed')
  ),
  companheiros AS (
    SELECT
      'companheiro'::text AS tipo,
      outp.jogador_id,
      j.username,
      COUNT(*)::bigint                                          AS partidas,
      COUNT(*) FILTER (WHERE jp.vencedor = jp.time)::bigint     AS vitorias,
      COUNT(*) FILTER (WHERE jp.vencedor = 'empate')::bigint    AS empates,
      COUNT(*) FILTER (WHERE jp.vencedor <> jp.time
                        AND jp.vencedor <> 'empate')::bigint     AS derrotas
    FROM jogador_partidas jp
    JOIN partidas_participantes outp
      ON outp.partida_id = jp.partida_id
     AND outp.time       = jp.time
     AND outp.jogador_id <> p_jogador_id
    JOIN jogadores j ON j.id = outp.jogador_id
    GROUP BY outp.jogador_id, j.username
    HAVING COUNT(*) >= p_min_partidas
  ),
  adversarios AS (
    SELECT
      'adversario'::text AS tipo,
      outp.jogador_id,
      j.username,
      COUNT(*)::bigint                                          AS partidas,
      COUNT(*) FILTER (WHERE jp.vencedor = jp.time)::bigint     AS vitorias,
      COUNT(*) FILTER (WHERE jp.vencedor = 'empate')::bigint    AS empates,
      COUNT(*) FILTER (WHERE jp.vencedor <> jp.time
                        AND jp.vencedor <> 'empate')::bigint     AS derrotas
    FROM jogador_partidas jp
    JOIN partidas_participantes outp
      ON outp.partida_id = jp.partida_id
     AND outp.time       <> jp.time
     AND outp.jogador_id <> p_jogador_id
    JOIN jogadores j ON j.id = outp.jogador_id
    GROUP BY outp.jogador_id, j.username
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

-- 8. Recriação da RPC `parcerias_destaque_jogador`
DROP FUNCTION IF EXISTS parcerias_destaque_jogador(bigint, integer);

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
SECURITY DEFINER
SET search_path = public
AS $$
  WITH jogador_partidas AS (
    SELECT pp.partida_id, pp.time
    FROM partidas_participantes pp
    JOIN partidas p ON p.id = pp.partida_id
    WHERE pp.jogador_id = p_jogador_id
      AND p.status IN ('published', 'closed')
  ),
  usuario_gols AS (
    SELECT pp.partida_id, COALESCE(pp.gols, 0) AS gols
    FROM partidas_participantes pp
    WHERE pp.jogador_id = p_jogador_id
  ),
  usuario_notas AS (
    SELECT partida_id, avg_rating
    FROM partida_notas
    WHERE target_id = p_jogador_id
  ),
  companheiros AS (
    SELECT
      outp.jogador_id,
      j.username,
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
    GROUP BY outp.jogador_id, j.username
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

-- 9. Recriação da RPC `pares_racha`
DROP FUNCTION IF EXISTS pares_racha(integer);

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
SECURITY DEFINER
SET search_path = public
AS $$
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

-- 10. Remoção da coluna `nome` da tabela `jogadores`
ALTER TABLE jogadores DROP COLUMN IF EXISTS nome;

-- 11. Atualização dos Grants de Leitura
REVOKE SELECT ON jogadores FROM anon, authenticated;

GRANT SELECT (
  id,
  username,
  posicao,
  posicao_b,
  is_admin,
  is_ativo,
  is_mensalista,
  created_at
) ON jogadores TO anon, authenticated;
