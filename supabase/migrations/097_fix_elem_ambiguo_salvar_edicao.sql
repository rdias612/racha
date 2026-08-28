-- 097_fix_elem_ambiguo_salvar_edicao.sql
--
-- Correção de bug em produção: ao salvar a edição de uma súmula, a RPC
-- `salvar_edicao_partida` falha com o erro PostgreSQL
-- 'column reference "elem" is ambiguous' (HTTP 400 no PostgREST).
--
-- Causa raiz: a migration 079 definiu subqueries para localizar os goleiros
-- do jsonb usando o alias `elem` (ex.: `FROM jsonb_array_elements(p_participantes) elem`),
-- mas `elem` também é o nome da variável plpgsql usada no loop de upsert dos
-- participantes. Com o `plpgsql.variable_conflict` padrão (error), o Postgres
-- se recusa a resolver a referência e toda execução da função é abortada.
--
-- Fix: redeclara a função trocando apenas os aliases das subqueries de `elem`
-- para `e` (mesmo padrão da query de `v_novos_ids`, que não conflita).
-- Nenhuma outra linha da lógica é alterada em relação à versão da migration 079.

CREATE OR REPLACE FUNCTION salvar_edicao_partida(
  p_partida_id    bigint,
  p_participantes jsonb,
  p_primeira_vez   boolean DEFAULT false
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
  elem jsonb;
  v_novos_ids bigint[];
BEGIN
  SELECT status INTO v_status FROM partidas WHERE id = p_partida_id;
  IF v_status IS NULL THEN
    RETURN false;
  END IF;

  SELECT array_agg((e->>'jogador_id')::bigint)
    INTO v_novos_ids
    FROM jsonb_array_elements(p_participantes) e;

  IF v_novos_ids IS NOT NULL THEN
    DELETE FROM partida_eventos
     WHERE partida_id = p_partida_id
       AND (
         jogador_id NOT IN (SELECT unnest(v_novos_ids))
         OR (assistencia_jogador_id IS NOT NULL
             AND assistencia_jogador_id NOT IN (SELECT unnest(v_novos_ids)))
       );

    DELETE FROM votes
     WHERE partida_id = p_partida_id
       AND (
         voter_id NOT IN (SELECT unnest(v_novos_ids))
         OR target_id NOT IN (SELECT unnest(v_novos_ids))
       );

    DELETE FROM dividas
     WHERE partida_id = p_partida_id
       AND tipo = 'avulso'
       AND paga = false
       AND jogador_id NOT IN (SELECT unnest(v_novos_ids));

    DELETE FROM dividas
     WHERE partida_id = p_partida_id
       AND tipo = 'avulso'
       AND paga = false
       AND jogador_id IN (
         SELECT (e->>'jogador_id')::bigint
         FROM jsonb_array_elements(p_participantes) e
         WHERE (e->>'posicao')::text = 'goleiro'
       );

    -- Remove diárias de goleiro em aberto se o atleta saiu ou deixou de ser goleiro
    DELETE FROM dividas
     WHERE partida_id = p_partida_id
       AND natureza = 'despesa'
       AND tipo = 'goleiro'
       AND paga = false
       AND evento_automatico_id IS NOT NULL
       AND jogador_id NOT IN (
         SELECT (e->>'jogador_id')::bigint
         FROM jsonb_array_elements(p_participantes) e
         WHERE (e->>'posicao')::text = 'goleiro'
       );

    DELETE FROM partidas_participantes
     WHERE partida_id = p_partida_id
       AND jogador_id NOT IN (SELECT unnest(v_novos_ids));
  END IF;

  FOR elem IN SELECT * FROM jsonb_array_elements(p_participantes)
  LOOP
    INSERT INTO partidas_participantes (
      partida_id, jogador_id, time, posicao, gols, assistencias, gols_contra,
      status_confirmacao
    )
    VALUES (
      p_partida_id,
      (elem->>'jogador_id')::bigint,
      (elem->>'time')::char(1),
      (elem->>'posicao')::text,
      COALESCE((elem->>'gols')::integer, 0),
      COALESCE((elem->>'assistencias')::integer, 0),
      COALESCE((elem->>'gols_contra')::integer, 0),
      COALESCE((elem->>'status_confirmacao')::text, 'confirmado')
    )
    ON CONFLICT (partida_id, jogador_id) DO UPDATE SET
      time               = EXCLUDED.time,
      posicao            = EXCLUDED.posicao,
      gols               = EXCLUDED.gols,
      assistencias       = EXCLUDED.assistencias,
      gols_contra        = EXCLUDED.gols_contra,
      status_confirmacao = EXCLUDED.status_confirmacao;
  END LOOP;

  IF p_primeira_vez THEN
    IF NOT publicar_partida(p_partida_id) THEN
      RAISE EXCEPTION 'Não foi possível publicar a partida (ela precisa estar em rascunho).';
    END IF;
  ELSIF v_status IN ('published', 'closed') THEN
    PERFORM gerar_avulsos_partida(p_partida_id);
    PERFORM gerar_lancamentos_fim_partida(p_partida_id);
  END IF;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION salvar_edicao_partida(bigint, jsonb, boolean)
  TO anon, authenticated;
