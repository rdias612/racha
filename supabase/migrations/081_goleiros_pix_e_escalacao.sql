-- 081_goleiros_pix_e_escalacao.sql
--
-- Unificação da gestão de goleiros na tabela jogadores com campos de PIX e Telefone,
-- seleção dos 2 goleiros na divisão de times, bloqueio de voto para quem atuou no gol
-- e validação de 7 de linha + 1 goleiro por time ao abrir partida.

-- 1) Adiciona colunas chave_pix e telefone em jogadores
ALTER TABLE jogadores
  ADD COLUMN IF NOT EXISTS chave_pix text,
  ADD COLUMN IF NOT EXISTS telefone text;

-- 2) RPC para criação rápida de goleiro pela administração
CREATE OR REPLACE FUNCTION criar_goleiro_rapido(
  p_nome      text,
  p_telefone  text DEFAULT NULL,
  p_chave_pix text DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_username text;
  v_base     text;
  v_id       bigint;
  v_count    integer := 1;
BEGIN
  v_base := lower(regexp_replace(trim(p_nome), '[^a-zA-Z0-9]', '', 'g'));
  IF length(v_base) = 0 THEN
    v_base := 'goleiro';
  END IF;

  v_username := v_base;
  WHILE EXISTS (SELECT 1 FROM jogadores WHERE username = v_username) LOOP
    v_count := v_count + 1;
    v_username := v_base || v_count::text;
  END LOOP;

  INSERT INTO jogadores (
    username,
    senha_hash,
    posicao,
    is_admin,
    is_ativo,
    is_mensalista,
    telefone,
    chave_pix
  )
  VALUES (
    v_username,
    '123',
    'goleiro',
    false,
    true,
    false,
    trim(p_telefone),
    trim(p_chave_pix)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION criar_goleiro_rapido(text, text, text) TO anon, authenticated;

-- 3) RPC: Salvar divisão dos times de linha e goleiros da partida
CREATE OR REPLACE FUNCTION salvar_times_e_goleiros_partida(
  p_partida_id   bigint,
  p_times_linha  jsonb, -- array de { jogador_id: number, time: 'a'|'b' }
  p_goleiro_a_id bigint,
  p_goleiro_b_id bigint
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  elem jsonb;
BEGIN
  -- Atualiza os jogadores de linha
  FOR elem IN SELECT * FROM jsonb_array_elements(p_times_linha)
  LOOP
    UPDATE partidas_participantes
    SET time = (elem->>'time')::char(1)
    WHERE partida_id = p_partida_id
      AND jogador_id = (elem->>'jogador_id')::bigint;
  END LOOP;

  -- Remove goleiros anteriores que foram desmarcados
  DELETE FROM partidas_participantes
  WHERE partida_id = p_partida_id
    AND posicao = 'goleiro'
    AND jogador_id NOT IN (p_goleiro_a_id, p_goleiro_b_id);

  -- Salva / Atualiza Goleiro Time Preto (a)
  INSERT INTO partidas_participantes (
    partida_id, jogador_id, time, posicao, status_confirmacao
  )
  VALUES (
    p_partida_id, p_goleiro_a_id, 'a', 'goleiro', 'confirmado'
  )
  ON CONFLICT (partida_id, jogador_id)
  DO UPDATE SET
    time = 'a',
    posicao = 'goleiro',
    status_confirmacao = 'confirmado';

  -- Salva / Atualiza Goleiro Time Branco (b)
  INSERT INTO partidas_participantes (
    partida_id, jogador_id, time, posicao, status_confirmacao
  )
  VALUES (
    p_partida_id, p_goleiro_b_id, 'b', 'goleiro', 'confirmado'
  )
  ON CONFLICT (partida_id, jogador_id)
  DO UPDATE SET
    time = 'b',
    posicao = 'goleiro',
    status_confirmacao = 'confirmado';

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION salvar_times_e_goleiros_partida(bigint, jsonb, bigint, bigint) TO anon, authenticated;

-- 4) RPC: abrir_partida exige 7 de linha + 1 goleiro em cada time (8 total por time)
CREATE OR REPLACE FUNCTION abrir_partida(p_partida_id bigint)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
  v_time_a bigint;
  v_time_b bigint;
  v_gk_a   bigint;
  v_gk_b   bigint;
BEGIN
  SELECT status INTO v_status
  FROM partidas
  WHERE id = p_partida_id;

  IF v_status IS NULL OR v_status <> 'draft' THEN
    RETURN false;
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE time = 'a' AND posicao <> 'goleiro'),
    COUNT(*) FILTER (WHERE time = 'b' AND posicao <> 'goleiro'),
    COUNT(*) FILTER (WHERE time = 'a' AND posicao = 'goleiro'),
    COUNT(*) FILTER (WHERE time = 'b' AND posicao = 'goleiro')
  INTO v_time_a, v_time_b, v_gk_a, v_gk_b
  FROM partidas_participantes
  WHERE partida_id = p_partida_id
    AND status_confirmacao = 'confirmado';

  -- Exige exatamente 7 jogadores de linha por time
  IF v_time_a <> 7 OR v_time_b <> 7 THEN
    RETURN false;
  END IF;

  -- Exige exatamente 1 goleiro por time
  IF v_gk_a <> 1 OR v_gk_b <> 1 THEN
    RETURN false;
  END IF;

  DELETE FROM partida_eventos WHERE partida_id = p_partida_id;

  -- Zera placar dos confirmados
  UPDATE partidas_participantes
  SET gols = 0, assistencias = 0, gols_contra = 0
  WHERE partida_id = p_partida_id
    AND status_confirmacao = 'confirmado';

  UPDATE partidas
  SET status = 'live'
  WHERE id = p_partida_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION abrir_partida(bigint) TO anon, authenticated;

-- 5) RPC: registrar_votos impede que quem atuou no GOL vote
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
  -- (1) Bloqueio de janela: partida deve estar published e dentro do prazo.
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

  -- (2) Votante precisa ser participante de linha da partida (quem jogou no gol não vota).
  PERFORM 1
    FROM partidas_participantes
    WHERE partida_id = p_partida_id
      AND jogador_id = p_voter_id
      AND posicao <> 'goleiro';
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- (3) Votante não pode ser jogador 'random' (placeholder do sorteio).
  PERFORM 1
    FROM jogadores
    WHERE id = p_voter_id
      AND username NOT ILIKE 'random%';
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- (4) Valida e processa cada voto recebido.
  FOR elem IN SELECT * FROM jsonb_array_elements(p_votos)
  LOOP
    v_target_id := (elem->>'target_id')::bigint;
    v_rating    := (elem->>'rating')::smallint;

    IF v_rating < 1 OR v_rating > 10 THEN
      RETURN false;
    END IF;

    -- Não pode votar em si mesmo
    IF v_target_id = p_voter_id THEN
      RETURN false;
    END IF;

    -- Target deve ser participante da mesma partida
    PERFORM 1
      FROM partidas_participantes
      WHERE partida_id = p_partida_id
        AND jogador_id = v_target_id;
    IF NOT FOUND THEN
      RETURN false;
    END IF;

    -- Target não pode ser 'random'
    PERFORM 1
      FROM jogadores
      WHERE id = v_target_id
        AND username NOT ILIKE 'random%';
    IF NOT FOUND THEN
      RETURN false;
    END IF;

    -- UPSERT na tabela votes
    INSERT INTO votes (partida_id, voter_id, target_id, rating)
    VALUES (p_partida_id, p_voter_id, v_target_id, v_rating)
    ON CONFLICT (partida_id, voter_id, target_id)
    DO UPDATE SET rating = EXCLUDED.rating;
  END LOOP;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION registrar_votos(bigint, bigint, jsonb) TO anon, authenticated;
