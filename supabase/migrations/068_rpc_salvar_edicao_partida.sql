-- 068_rpc_salvar_edicao_partida.sql
--
-- RPC transacional para salvar edição completa de partida (PartidaEditar.tsx).
-- Substitui a cadeia de deletes e updates client-side não atômica por uma única
-- transação ACID.
--
-- Fluxo:
--   1. Valida existência da partida.
--   2. Identifica e remove participantes removidos:
--      - Remove eventos vinculados (partida_eventos) onde jogador é autor ou assistente;
--      - Remove votos vinculados (votes) onde jogador é voter ou target;
--      - Remove dívidas avulsas em aberto da partida (dividas onde tipo='avulso' AND paga=false);
--      - Remove de partidas_participantes.
--   3. Faz upsert dos participantes enviados (mantidos e adicionados) em partidas_participantes.
--   4. Se p_primeira_vez = true (draft -> published):
--      - Chama publicar_partida(p_partida_id) (publica e gera avulsos).
--   5. Se p_primeira_vez = false e status da partida for 'published' ou 'closed':
--      - Chama gerar_avulsos_partida(p_partida_id) para garantir geração idempotente de avulso para novos jogadores.
--   6. Retorna true em sucesso; em erro lança exceção provocando rollback.

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
  -- 1) Validação da partida
  SELECT status INTO v_status FROM partidas WHERE id = p_partida_id;
  IF v_status IS NULL THEN
    RETURN false;
  END IF;

  -- Coleta os IDs enviados no jsonb
  SELECT array_agg((e->>'jogador_id')::bigint)
    INTO v_novos_ids
    FROM jsonb_array_elements(p_participantes) e;

  -- 2) Limpeza dos participantes que foram removidos
  IF v_novos_ids IS NOT NULL THEN
    -- Deleta eventos vinculados aos jogadores removidos
    DELETE FROM partida_eventos
     WHERE partida_id = p_partida_id
       AND (
         jogador_id NOT IN (SELECT unnest(v_novos_ids))
         OR (assistencia_jogador_id IS NOT NULL AND assistencia_jogador_id NOT IN (SELECT unnest(v_novos_ids)))
       );

    -- Deleta votos vinculados aos jogadores removidos
    DELETE FROM votes
     WHERE partida_id = p_partida_id
       AND (
         voter_id NOT IN (SELECT unnest(v_novos_ids))
         OR target_id NOT IN (SELECT unnest(v_novos_ids))
       );

    -- Deleta dívidas avulsas em aberto vinculadas aos jogadores removidos nesta partida
    DELETE FROM dividas
     WHERE partida_id = p_partida_id
       AND tipo = 'avulso'
       AND paga = false
       AND jogador_id NOT IN (SELECT unnest(v_novos_ids));

    -- Deleta os participantes da tabela partidas_participantes
    DELETE FROM partidas_participantes
     WHERE partida_id = p_partida_id
       AND jogador_id NOT IN (SELECT unnest(v_novos_ids));
  END IF;

  -- 3) Upsert dos participantes mantidos/adicionados
  FOR elem IN SELECT * FROM jsonb_array_elements(p_participantes)
  LOOP
    INSERT INTO partidas_participantes (
      partida_id,
      jogador_id,
      time,
      posicao,
      gols,
      assistencias,
      gols_contra,
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

  -- 4) Se for primeira publicação (draft -> published)
  IF p_primeira_vez THEN
    IF NOT publicar_partida(p_partida_id) THEN
      RAISE EXCEPTION 'Não foi possível publicar a partida (ela precisa estar em rascunho).';
    END IF;
  ELSIF v_status IN ('published', 'closed') THEN
    -- Sincroniza avulsos de participantes adicionados
    PERFORM gerar_avulsos_partida(p_partida_id);
  END IF;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION salvar_edicao_partida(bigint, jsonb, boolean) TO anon, authenticated;
