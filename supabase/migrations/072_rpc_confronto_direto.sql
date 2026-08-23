-- 072_rpc_confronto_direto.sql
--
-- RPCs do Comparador Cara-a-Cara (Confronto Direto). Toda a agregação vive no
-- PostgreSQL (regra 7.5 do AGENTS.md: nunca baixar tabelas para agregar no client).
-- Precedentes de leitura agregada: `parcerias_jogador` (030) e
-- `parcerias_destaque_jogador` (042).
--
-- Função 1 — `confronto_direto(p_jogador_a, p_jogador_b)`:
--   Devolve SEMPRE 4 linhas (lado 'a'/'b' × bloco 'juntos'/'adversos') com a
--   produção individual (gols/assistências/gols_contra), o retrospecto V/E/D do
--   time do atleta e a média de nota (aparada, via view `partida_notas`) de cada
--   atleta no contexto:
--     - 'juntos'   = encontros em que ambos vestiram o MESMO time (time_a =
--                    time_b); o retrospecto é comum aos dois lados;
--     - 'adversos' = encontros em times opostos (time_a <> time_b); o
--                    retrospecto é individual e espelhado (vitória de A =
--                    derrota de B), pois cada linha compara o PRÓPRIO time do
--                    atleta com o `vencedor` da partida.
--   Contexto sem nenhuma partida devolve a linha com zeros e `media_nota` NULL
--   (o client decide exibir ou não o bloco). A ordenação `bloco, lado` é
--   cortesia; o client mapeia por (lado, bloco), nunca por índice.
--
-- Função 2 — `confronto_direto_partidas(p_jogador_a, p_jogador_b, p_limite)`:
--   Histórico das últimas partidas compartilhadas (mais recentes primeiro):
--   data, relação ('juntos'/'adversos'), time do jogador A ('a'/'b'), placar
--   final e vencedor. Atenção à semântica das colunas de placar: `gols_time_a` /
--   `gols_time_b` são os gols dos times 'a' e 'b' DA PARTIDA (passthrough da
--   view `partida_placar`), NÃO o placar do time de cada atleta comparado — o
--   client cruza com `time_a` para saber de que lado cada um jogou.
--   `p_limite` sofre clamp defensivo: LEAST(GREATEST(p_limite, 1), 50).
--
-- Regras comuns às duas funções:
--   - Encontros = partidas com status IN ('published','closed') em que AMBOS os
--     atletas participaram (draft/live não contam, igual ao ranking e às
--     parcerias). O vencedor e o placar vêm da view `partida_placar`, mesma
--     fonte das views `ranking`/`stats_jogador` (gols contra já corrigidos
--     pelas migrations 061-064).
--   - Validações server-side via RAISE EXCEPTION (por isso LANGUAGE plpgsql,
--     pois RAISE não existe em funções LANGUAGE sql — precedente
--     `salvar_edicao_partida`, 068):
--       * p_jogador_a = p_jogador_b                 -> 'Selecione dois atletas diferentes.'
--       * id inexistente OU posicao = 'random'      -> 'Atleta não encontrado.'
--     (placeholders `random\d*` ficam fora dos relatórios — regra 8.6.)
--   - Notas: LEFT JOIN com a view `partida_notas`, que agrega por
--     (partida_id, target_id) => 1 linha por partida, logo o JOIN não infla
--     COUNT/AVG (mesmo artifício da 042). Partida sem nota apenas sai do AVG.
--   - Em plpgsql TODAS as colunas do RETURNS TABLE viram variáveis: todas as
--     referências de coluna estão qualificadas com alias de tabela (`pp.gols`,
--     `p.status`, `pl.vencedor`...) para evitar a ambiguidade corrigida na
--     migration 044.
--   - STABLE (leitura agregada pura), SECURITY DEFINER + SET search_path =
--     public, GRANT EXECUTE explícito para anon/authenticated. ZERO UUID
--     (apenas bigint/bigserial).
--
-- Nota de nomenclatura (regra 7.3-1): a diretriz pede infinitivo, porém as RPCs
-- de leitura canônicas do projeto são substantivos (`parcerias_jogador`,
-- `pares_racha`, `parcerias_destaque_jogador`) — mantém-se o substantivo
-- `confronto_direto` pelo precedente interno.

CREATE OR REPLACE FUNCTION confronto_direto(
  p_jogador_a    bigint,
  p_jogador_b    bigint
)
RETURNS TABLE (
  lado           text,    -- 'a' | 'b' (referente a p_jogador_a / p_jogador_b)
  bloco          text,    -- 'juntos' | 'adversos'
  partidas       bigint,
  gols           bigint,  -- produção do atleta nas partidas do contexto
  assistencias   bigint,
  gols_contra    bigint,
  vitorias       bigint,  -- retrospecto do time do atleta no contexto
  empates        bigint,
  derrotas       bigint,
  media_nota     numeric  -- AVG(partida_notas.avg_rating) do atleta no contexto (NULL se nunca recebeu nota)
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
    -- Partidas decididas em que AMBOS participaram, com o time de cada um e o
    -- vencedor oficial. PK (partida_id, jogador_id) garante 1 linha por partida.
    SELECT
      pa.partida_id               AS partida_id,
      pa.time                     AS time_a,
      pb.time                     AS time_b,
      pl.vencedor                 AS vencedor
    FROM partidas_participantes pa
    JOIN partidas_participantes pb
      ON pb.partida_id = pa.partida_id
     AND pb.jogador_id = p_jogador_b
    JOIN partidas       p  ON p.id  = pa.partida_id
    JOIN partida_placar pl ON pl.partida_id = pa.partida_id
    WHERE pa.jogador_id = p_jogador_a
      AND p.status IN ('published','closed')
  ),
  lados AS (
    -- Espelha os encontros para os dois atletas (lado 'a' = p_jogador_a).
    SELECT 'a'::text AS lado, p_jogador_a AS jogador_id
    UNION ALL
    SELECT 'b'::text, p_jogador_b
  ),
  encontros_lado AS (
    SELECT
      ld.lado,
      ld.jogador_id,
      en.partida_id,
      -- Time do atleta naquela partida e a relação entre os dois.
      CASE WHEN ld.lado = 'a' THEN en.time_a ELSE en.time_b END AS time_atleta,
      CASE WHEN en.time_a = en.time_b THEN 'juntos' ELSE 'adversos' END AS relacao,
      en.vencedor
    FROM encontros en
    CROSS JOIN lados ld
  ),
  por_contexto AS (
    -- Produção + retrospecto + nota média de cada atleta em cada contexto.
    -- O JOIN com partidas_participantes é 1:1 (PK partida_id + jogador_id) e
    -- partida_notas agrega 1 linha por (partida_id, target_id): COUNT e AVG
    -- ficam exatos, sem inflar.
    SELECT
      el.lado,
      el.relacao,
      COUNT(*)::bigint                                             AS qtd_partidas,
      COALESCE(SUM(pp.gols), 0)::bigint                           AS qtd_gols,
      COALESCE(SUM(pp.assistencias), 0)::bigint                   AS qtd_assistencias,
      COALESCE(SUM(pp.gols_contra), 0)::bigint                    AS qtd_gols_contra,
      COUNT(*) FILTER (WHERE el.vencedor = el.time_atleta)::bigint AS qtd_vitorias,
      COUNT(*) FILTER (WHERE el.vencedor = 'empate')::bigint      AS qtd_empates,
      COUNT(*) FILTER (WHERE el.vencedor <> el.time_atleta
                         AND el.vencedor <> 'empate')::bigint      AS qtd_derrotas,
      AVG(pn.avg_rating)::numeric                                 AS val_media_nota
    FROM encontros_lado el
    JOIN partidas_participantes pp
      ON pp.partida_id = el.partida_id
     AND pp.jogador_id  = el.jogador_id
    LEFT JOIN partida_notas pn
      ON pn.partida_id = el.partida_id
     AND pn.target_id  = el.jogador_id
    GROUP BY el.lado, el.relacao
  ),
  combinacoes(lado, bloco) AS (
    -- As 4 saídas contratadas, existam ou não partidas no contexto.
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

-- Função 2: histórico das últimas partidas compartilhadas (as duas relações
-- juntas, mais recentes primeiro).

CREATE OR REPLACE FUNCTION confronto_direto_partidas(
  p_jogador_a  bigint,
  p_jogador_b  bigint,
  p_limite     integer DEFAULT 10
)
RETURNS TABLE (
  partida_id    bigint,
  data_jogo     timestamptz,  -- partidas.data_jogo
  relacao       text,         -- 'juntos' | 'adversos'
  time_a        text,         -- time ('a'|'b') do jogador A naquela partida
  gols_time_a   bigint,       -- placar final do time 'a' da partida (partida_placar)
  gols_time_b   bigint,       -- placar final do time 'b' da partida (partida_placar)
  vencedor      text          -- 'a' | 'b' | 'empate'
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1) Mesmas validações da confronto_direto.
  IF p_jogador_a = p_jogador_b THEN
    RAISE EXCEPTION 'Selecione dois atletas diferentes.';
  END IF;

  IF (SELECT COUNT(*) FROM jogadores j
       WHERE j.id IN (p_jogador_a, p_jogador_b)
         AND j.posicao <> 'random') <> 2 THEN
    RAISE EXCEPTION 'Atleta não encontrado.';
  END IF;

  -- 2) Lista cronológica inversa com clamp defensivo do limite (1..50).
  RETURN QUERY
  WITH encontros AS (
    SELECT
      pa.partida_id               AS partida_id,
      p.data_jogo                 AS data_jogo,
      pa.time                     AS time_a,
      pb.time                     AS time_b,
      pl.gols_time_a              AS gols_time_a,
      pl.gols_time_b              AS gols_time_b,
      pl.vencedor                 AS vencedor
    FROM partidas_participantes pa
    JOIN partidas_participantes pb
      ON pb.partida_id = pa.partida_id
     AND pb.jogador_id = p_jogador_b
    JOIN partidas       p  ON p.id  = pa.partida_id
    JOIN partida_placar pl ON pl.partida_id = pa.partida_id
    WHERE pa.jogador_id = p_jogador_a
      AND p.status IN ('published','closed')
  )
  SELECT
    en.partida_id                                                AS partida_id,
    en.data_jogo                                                 AS data_jogo,
    CASE WHEN en.time_a = en.time_b THEN 'juntos' ELSE 'adversos' END AS relacao,
    en.time_a::text                                              AS time_a,
    en.gols_time_a                                               AS gols_time_a,
    en.gols_time_b                                               AS gols_time_b,
    en.vencedor                                                  AS vencedor
  FROM encontros en
  ORDER BY en.data_jogo DESC
  LIMIT LEAST(GREATEST(p_limite, 1), 50);
END;
$$;

GRANT EXECUTE ON FUNCTION confronto_direto_partidas(bigint, bigint, integer) TO anon, authenticated;
