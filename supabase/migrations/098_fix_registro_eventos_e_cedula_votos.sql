-- 098_fix_registro_eventos_e_cedula_votos.sql
--
-- Corrige duas quebras de produção descobertas na partida 35 (27/08/2026):
--
-- 1) `partida_eventos` (migration 047) NUNCA teve a coluna `time`, mas a
--    migration 092 reescreveu `registrar_evento`/`editar_evento` inserindo/atualizando
--    essa coluna → exceção 'column "time" of relation "partida_eventos" does not
--    exist' em TODO registro/edição de gol ao vivo. O time do atleta já vive em
--    `partidas_participantes` e o frontend não consome `time` do evento.
--    Fix: remove a coluna do INSERT/UPDATE (o SELECT em partidas_participantes
--    continua sendo usado para validar participante e time da assistência).
--
-- 2) `registrar_votos` validava cada voto DENTRO do loop de INSERT sem handler de
--    exceção: ao encontrar um alvo inválido (ex.: convidado `random%`, bloqueado
--    indevidamente como alvo), retornava false no meio do loop PERSISTINDO os votos
--    anteriores. Com convidados escalados, a cédula (que exige avaliar todos os
--    participantes) nunca era aceita — votação travada com votos órfãos.
--    Fix:
--      a) valida TUDO antes de gravar (atomicidade real: ou grava tudo, ou nada);
--      b) alvo de nota passa a ser qualquer participante da partida (goleiros e
--         convidados recebem nota, como a cédula do app já exige — AGENTS 8.4);
--         o bloqueio de convidados como VOTANTE permanece (AGENTS 8.6).

-- ----------------------------------------------------------------------------
-- 1) registrar_evento (sem coluna inexistente `time`)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION registrar_evento(
  p_partida_id             bigint,
  p_tipo                   text,
  p_jogador_id             bigint,
  p_assistencia_jogador_id bigint DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status      text;
  v_time        char(1);
  v_time_assist char(1);
  v_evento_id   bigint;
  v_assist      bigint;
BEGIN
  SELECT status INTO v_status
  FROM partidas
  WHERE id = p_partida_id;

  IF v_status IS NULL OR v_status <> 'live' THEN
    RETURN NULL;
  END IF;

  IF p_tipo NOT IN ('gol', 'gol_contra') THEN
    RETURN NULL;
  END IF;

  SELECT time INTO v_time
  FROM partidas_participantes
  WHERE partida_id = p_partida_id
    AND jogador_id = p_jogador_id;

  IF v_time IS NULL THEN
    RETURN NULL;
  END IF;

  v_assist := p_assistencia_jogador_id;
  IF p_tipo = 'gol_contra' THEN
    v_assist := NULL;
  END IF;

  IF v_assist IS NOT NULL THEN
    IF v_assist = p_jogador_id THEN
      RETURN NULL;
    END IF;

    SELECT time INTO v_time_assist
    FROM partidas_participantes
    WHERE partida_id = p_partida_id
      AND jogador_id = v_assist;

    IF v_time_assist IS NULL OR v_time_assist <> v_time THEN
      RETURN NULL;
    END IF;
  END IF;

  INSERT INTO partida_eventos (
    partida_id, tipo, jogador_id, assistencia_jogador_id
  )
  VALUES (p_partida_id, p_tipo, p_jogador_id, v_assist)
  RETURNING id INTO v_evento_id;

  IF p_tipo = 'gol' THEN
    UPDATE partidas_participantes
    SET gols = gols + 1
    WHERE partida_id = p_partida_id AND jogador_id = p_jogador_id;

    IF v_assist IS NOT NULL THEN
      UPDATE partidas_participantes
      SET assistencias = assistencias + 1
      WHERE partida_id = p_partida_id AND jogador_id = v_assist;
    END IF;
  ELSIF p_tipo = 'gol_contra' THEN
    UPDATE partidas_participantes
    SET gols_contra = gols_contra + 1
    WHERE partida_id = p_partida_id AND jogador_id = p_jogador_id;
  END IF;

  RETURN v_evento_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- 2) editar_evento (sem coluna inexistente `time`)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION editar_evento(
  p_evento_id              bigint,
  p_tipo                   text,
  p_jogador_id             bigint,
  p_assistencia_jogador_id bigint DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_evento partida_eventos%ROWTYPE;
  v_status text;
  v_time   char(1);
  v_assist bigint;
BEGIN
  SELECT * INTO v_evento FROM partida_eventos WHERE id = p_evento_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  SELECT status INTO v_status FROM partidas WHERE id = v_evento.partida_id;
  IF v_status IS NULL OR v_status <> 'live' THEN
    RETURN false;
  END IF;

  IF p_tipo NOT IN ('gol', 'gol_contra') THEN
    RETURN false;
  END IF;

  -- Valida que o novo jogador é participante da partida
  SELECT time INTO v_time
  FROM partidas_participantes
  WHERE partida_id = v_evento.partida_id AND jogador_id = p_jogador_id;

  IF v_time IS NULL THEN
    RETURN false;
  END IF;

  v_assist := p_assistencia_jogador_id;
  IF p_tipo = 'gol_contra' THEN
    v_assist := NULL;
  END IF;

  -- 1. Reverte contadores do evento antigo
  IF v_evento.tipo = 'gol' THEN
    UPDATE partidas_participantes
    SET gols = GREATEST(0, gols - 1)
    WHERE partida_id = v_evento.partida_id AND jogador_id = v_evento.jogador_id;

    IF v_evento.assistencia_jogador_id IS NOT NULL THEN
      UPDATE partidas_participantes
      SET assistencias = GREATEST(0, assistencias - 1)
      WHERE partida_id = v_evento.partida_id AND jogador_id = v_evento.assistencia_jogador_id;
    END IF;
  ELSIF v_evento.tipo = 'gol_contra' THEN
    UPDATE partidas_participantes
    SET gols_contra = GREATEST(0, gols_contra - 1)
    WHERE partida_id = v_evento.partida_id AND jogador_id = v_evento.jogador_id;
  END IF;

  -- 2. Aplica novos contadores
  IF p_tipo = 'gol' THEN
    UPDATE partidas_participantes
    SET gols = gols + 1
    WHERE partida_id = v_evento.partida_id AND jogador_id = p_jogador_id;

    IF v_assist IS NOT NULL THEN
      UPDATE partidas_participantes
      SET assistencias = assistencias + 1
      WHERE partida_id = v_evento.partida_id AND jogador_id = v_assist;
    END IF;
  ELSIF p_tipo = 'gol_contra' THEN
    UPDATE partidas_participantes
    SET gols_contra = gols_contra + 1
    WHERE partida_id = v_evento.partida_id AND jogador_id = p_jogador_id;
  END IF;

  UPDATE partida_eventos
  SET tipo                   = p_tipo,
      jogador_id             = p_jogador_id,
      assistencia_jogador_id = v_assist
  WHERE id = p_evento_id;

  RETURN true;
END;
$$;

-- ----------------------------------------------------------------------------
-- 3) registrar_votos (atômica; alvo = qualquer participante da partida)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION registrar_votos(
  p_partida_id  bigint,
  p_voter_id    bigint,
  p_votos       jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status           text;
  v_voting_closes_at timestamptz;
  elem               jsonb;
  v_target_id        bigint;
  v_rating           smallint;
BEGIN
  -- (1) Bloqueio de janela: partida publicada e dentro do prazo de 24h.
  SELECT status, voting_closes_at
  INTO v_status, v_voting_closes_at
  FROM partidas
  WHERE id = p_partida_id;

  IF v_status IS NULL
     OR v_status <> 'published'
     OR v_voting_closes_at IS NULL
     OR v_voting_closes_at <= now() THEN
    RETURN false;
  END IF;

  -- (2) Votante: participante de linha da partida; goleiros não votam (AGENTS 8.4)
  --     e convidados (`random%`) não votam (AGENTS 8.6).
  IF NOT EXISTS (
    SELECT 1
    FROM partidas_participantes pp
    JOIN jogadores j ON j.id = pp.jogador_id
    WHERE pp.partida_id = p_partida_id
      AND pp.jogador_id = p_voter_id
      AND pp.posicao <> 'goleiro'
      AND j.username NOT ILIKE 'random%'
  ) THEN
    RETURN false;
  END IF;

  -- (3) Validação prévia COMPLETA, antes de gravar qualquer linha:
  --     notas 1..10, sem self-vote e alvo participante da partida
  --     (goleiros e convidados podem receber nota, como na cédula do app).
  FOR elem IN SELECT * FROM jsonb_array_elements(p_votos)
  LOOP
    v_target_id := (elem->>'target_id')::bigint;
    v_rating    := (elem->>'rating')::smallint;

    IF v_rating < 1 OR v_rating > 10 THEN
      RETURN false;
    END IF;

    IF v_target_id = p_voter_id THEN
      RETURN false;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM partidas_participantes
      WHERE partida_id = p_partida_id
        AND jogador_id = v_target_id
    ) THEN
      RETURN false;
    END IF;
  END LOOP;

  -- (4) UPSERT em bloco protegido: qualquer falha inesperada reverte o bloco
  --     inteiro (subtransação) e a função retorna false — nunca grava parcial.
  BEGIN
    FOR elem IN SELECT * FROM jsonb_array_elements(p_votos)
    LOOP
      v_target_id := (elem->>'target_id')::bigint;
      v_rating    := (elem->>'rating')::smallint;

      INSERT INTO votes (partida_id, voter_id, target_id, rating)
      VALUES (p_partida_id, p_voter_id, v_target_id, v_rating)
      ON CONFLICT (partida_id, voter_id, target_id)
      DO UPDATE SET rating = EXCLUDED.rating;
    END LOOP;

    RETURN true;
  EXCEPTION WHEN OTHERS THEN
    RETURN false;
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION registrar_evento(bigint, text, bigint, bigint) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION editar_evento(bigint, text, bigint, bigint) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION registrar_votos(bigint, bigint, jsonb) TO anon, authenticated;
