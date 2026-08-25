-- 074_isencao_dividas_goleiros.sql
--
-- Regra de Domínio: Goleiros NÃO pagam para jogar no racha (são isentos de taxas
-- de avulso por partida e de mensalidades).
--
-- Esta migration:
-- 1. Redefine `gerar_avulsos_partida` para ignorar goleiros na partida (`pp.posicao <> 'goleiro'`)
--    e atletas registrados com posição primária 'goleiro' (`j.posicao <> 'goleiro'`).
-- 2. Redefine `salvar_edicao_partida` para limpar dívidas avulsas em aberto caso
--    um jogador passe a jogar como goleiro na súmula editada.
-- 3. Re-agenda o cron `gerar-mensalidades-mensal` garantindo que goleiros não recebam mensalidade.
-- 4. Redefine `criar_jogador` para forçar `is_mensalista = false` em goleiros.
-- 5. Limpa débitos em aberto (avulso / mensalidade) indevidamente gerados para goleiros
--    e remove o status `is_mensalista` de goleiros no banco.

-- 1) Atualiza gerar_avulsos_partida
CREATE OR REPLACE FUNCTION gerar_avulsos_partida(p_partida_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO dividas (jogador_id, tipo, valor, partida_id, data_divida, referencia, descricao)
  SELECT
    pp.jogador_id,
    'avulso',
    20.00,
    p.id,
    (p.data_jogo AT TIME ZONE 'America/Sao_Paulo')::date,
    to_char(p.data_jogo AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM'),
    'Avulso — partida ' || to_char(p.data_jogo AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY')
  FROM partidas_participantes pp
  JOIN jogadores j ON j.id = pp.jogador_id
  JOIN partidas   p ON p.id = pp.partida_id
  WHERE pp.partida_id = p_partida_id
    AND j.is_mensalista = false
    AND pp.posicao <> 'goleiro'
    AND j.posicao <> 'goleiro'
  ON CONFLICT DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION gerar_avulsos_partida(bigint) TO anon, authenticated;

-- 2) Atualiza salvar_edicao_partida
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

  -- 2) Limpeza dos participantes que foram removidos ou viraram goleiros
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

    -- Deleta dívidas avulsas em aberto vinculadas aos jogadores escalados como goleiro nesta partida
    DELETE FROM dividas
     WHERE partida_id = p_partida_id
       AND tipo = 'avulso'
       AND paga = false
       AND jogador_id IN (
         SELECT (elem->>'jogador_id')::bigint
         FROM jsonb_array_elements(p_participantes) elem
         WHERE (elem->>'posicao')::text = 'goleiro'
       );

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

-- 3) Atualiza o cron mensal de mensalidades (exclui goleiros)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'gerar-mensalidades-mensal') THEN
    PERFORM cron.unschedule('gerar-mensalidades-mensal');
  END IF;
END;
$$;

SELECT cron.schedule(
  'gerar-mensalidades-mensal',
  '0 13 1 * *',
  $$
  INSERT INTO dividas (jogador_id, tipo, valor, referencia, data_divida, descricao)
  SELECT
    j.id,
    'mensalidade',
    90.00,
    to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM'),
    (now() AT TIME ZONE 'America/Sao_Paulo')::date,
    'Mensalidade ' || to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'MM/YYYY')
  FROM jogadores j
  WHERE j.is_mensalista = true
    AND j.is_ativo = true
    AND j.posicao <> 'goleiro'
  ON CONFLICT DO NOTHING;
  $$
);

-- 4) Atualiza a RPC criar_jogador para impedir que goleiros virem mensalistas
CREATE OR REPLACE FUNCTION criar_jogador(
  p_username      text,
  p_nome          text,
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
  -- Goleiros primários não têm posição secundária e são isentos de pagamentos
  v_posicao_b := CASE WHEN p_posicao = 'goleiro' THEN NULL ELSE p_posicao_b END;
  v_is_mensalista := CASE WHEN p_posicao = 'goleiro' THEN false ELSE COALESCE(p_is_mensalista, false) END;

  INSERT INTO jogadores (username, senha_hash, nome, posicao, is_admin, is_ativo, posicao_b, is_mensalista)
  VALUES (p_username, '123', p_nome, p_posicao, p_is_admin, true, v_posicao_b, v_is_mensalista)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION criar_jogador(text, text, text, boolean, text, boolean) TO anon, authenticated;

-- 5) Limpeza de dívidas em aberto indevidamente atribuídas a goleiros
DELETE FROM dividas d
WHERE d.tipo = 'avulso'
  AND d.paga = false
  AND (
    d.jogador_id IN (SELECT id FROM jogadores WHERE posicao = 'goleiro')
    OR EXISTS (
      SELECT 1 FROM partidas_participantes pp
      WHERE pp.partida_id = d.partida_id
        AND pp.jogador_id = d.jogador_id
        AND pp.posicao = 'goleiro'
    )
  );

DELETE FROM dividas d
WHERE d.tipo = 'mensalidade'
  AND d.paga = false
  AND d.jogador_id IN (SELECT id FROM jogadores WHERE posicao = 'goleiro');

-- Garante que nenhum goleiro continue cadastrado como mensalista
UPDATE jogadores
   SET is_mensalista = false
 WHERE posicao = 'goleiro' AND is_mensalista = true;
