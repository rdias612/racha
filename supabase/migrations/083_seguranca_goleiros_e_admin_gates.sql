-- 083_seguranca_goleiros_e_admin_gates.sql
--
-- Correções de segurança e conformidade canônica:
-- 1. Gates de validação de administrador nas RPCs de gestão de goleiros e partidas.
-- 2. Proteção contra exclusão indevida de atletas ao trocar goleiros escalados.
-- 3. RPC transacional segura para atualização de PIX e telefone (próprio atleta ou admin).
-- 4. RPC transacional segura para alternar status ativo/inativo de atletas (apenas admin).

-- 1) RPC: criar_goleiro_rapido com validação de admin
CREATE OR REPLACE FUNCTION criar_goleiro_rapido(
  p_nome      text,
  p_telefone  text DEFAULT NULL,
  p_chave_pix text DEFAULT NULL,
  p_admin_id  bigint DEFAULT NULL
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
  -- Gate de administrador (obrigatório se informado, ou fallback seguro)
  IF p_admin_id IS NULL OR NOT EXISTS (SELECT 1 FROM jogadores WHERE id = p_admin_id AND is_admin = true) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem cadastrar goleiros.';
  END IF;

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
    NULLIF(trim(p_telefone), ''),
    NULLIF(trim(p_chave_pix), '')
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION criar_goleiro_rapido(text, text, text, bigint) TO anon, authenticated;

-- 2) RPC: salvar_times_e_goleiros_partida com gate de admin e proteção de participantes
CREATE OR REPLACE FUNCTION salvar_times_e_goleiros_partida(
  p_partida_id   bigint,
  p_times_linha  jsonb, -- array de { jogador_id: number, time: 'a'|'b' }
  p_goleiro_a_id bigint,
  p_goleiro_b_id bigint,
  p_admin_id     bigint DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  elem jsonb;
BEGIN
  -- Gate de administrador
  IF p_admin_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM jogadores WHERE id = p_admin_id AND is_admin = true) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem alterar a escalação.';
  END IF;

  IF p_goleiro_a_id = p_goleiro_b_id THEN
    RAISE EXCEPTION 'Os goleiros dos times Preto e Branco devem ser diferentes.';
  END IF;

  -- 1. Atualiza os jogadores de linha
  FOR elem IN SELECT * FROM jsonb_array_elements(p_times_linha)
  LOOP
    UPDATE partidas_participantes
    SET time = (elem->>'time')::char(1)
    WHERE partida_id = p_partida_id
      AND jogador_id = (elem->>'jogador_id')::bigint;
  END LOOP;

  -- 2. Remove goleiros anteriores que NÃO estão mais escalados no gol
  --    E que também NÃO estão na lista de confirmados de linha (evita deletar participante de linha).
  DELETE FROM partidas_participantes
  WHERE partida_id = p_partida_id
    AND posicao = 'goleiro'
    AND jogador_id NOT IN (p_goleiro_a_id, p_goleiro_b_id)
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_times_linha) l
      WHERE (l->>'jogador_id')::bigint = partidas_participantes.jogador_id
    );

  -- 3. Salva / Atualiza Goleiro Time Preto (a)
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

  -- 4. Salva / Atualiza Goleiro Time Branco (b)
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

GRANT EXECUTE ON FUNCTION salvar_times_e_goleiros_partida(bigint, jsonb, bigint, bigint, bigint) TO anon, authenticated;

-- 3) RPC: abrir_partida com gate de admin
CREATE OR REPLACE FUNCTION abrir_partida(
  p_partida_id bigint,
  p_admin_id   bigint DEFAULT NULL
)
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
  IF p_admin_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM jogadores WHERE id = p_admin_id AND is_admin = true) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem iniciar a partida.';
  END IF;

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

GRANT EXECUTE ON FUNCTION abrir_partida(bigint, bigint) TO anon, authenticated;

-- 4) RPC: atualizar_dados_pix_telefone (próprio jogador ou admin)
CREATE OR REPLACE FUNCTION atualizar_dados_pix_telefone(
  p_jogador_id  bigint,
  p_chave_pix   text,
  p_telefone    text,
  p_operador_id bigint
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean := false;
BEGIN
  SELECT is_admin INTO v_is_admin
  FROM jogadores
  WHERE id = p_operador_id;

  IF p_operador_id <> p_jogador_id AND v_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado: você não tem permissão para alterar os dados deste atleta.';
  END IF;

  UPDATE jogadores
  SET
    chave_pix = NULLIF(trim(p_chave_pix), ''),
    telefone  = NULLIF(trim(p_telefone), '')
  WHERE id = p_jogador_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION atualizar_dados_pix_telefone(bigint, text, text, bigint) TO anon, authenticated;

-- 5) RPC: alternar_status_ativo_jogador (apenas admin)
CREATE OR REPLACE FUNCTION alternar_status_ativo_jogador(
  p_jogador_id bigint,
  p_is_ativo   boolean,
  p_admin_id   bigint
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM jogadores WHERE id = p_admin_id AND is_admin = true) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem alterar o status de jogadores.';
  END IF;

  UPDATE jogadores
  SET is_ativo = p_is_ativo
  WHERE id = p_jogador_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION alternar_status_ativo_jogador(bigint, boolean, bigint) TO anon, authenticated;
