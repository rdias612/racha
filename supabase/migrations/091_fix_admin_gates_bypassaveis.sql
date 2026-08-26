-- 091_fix_admin_gates_bypassaveis.sql
--
-- P0-3: Gates de admin bypassáveis com `p_admin_id IS NULL`
--
-- Problema: as RPCs salvar_times_e_goleiros_partida e abrir_partida usavam o padrão
--   IF p_admin_id IS NOT NULL AND NOT EXISTS (...)
-- que, ao receber p_admin_id omitido/NULL, torna a condição FALSE e pula a validação
-- por inteiro — qualquer chamada anônima conseguia alterar escalação e abrir partida.
--
-- Correção: inverter para `p_admin_id IS NULL OR NOT EXISTS (...)`,
-- forçando a rejeição quando o argumento não é fornecido (mesmo padrão já usado em
-- criar_goleiro_rapido da migration 083).

-- 1) Corrige salvar_times_e_goleiros_partida
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
  -- Gate de administrador corrigido: rejeita quando p_admin_id é NULL ou não é admin
  IF p_admin_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM jogadores WHERE id = p_admin_id AND is_admin = true
  ) THEN
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

-- 2) Corrige abrir_partida(bigint, bigint)
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
  -- Gate de administrador corrigido: rejeita quando p_admin_id é NULL ou não é admin
  IF p_admin_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM jogadores WHERE id = p_admin_id AND is_admin = true
  ) THEN
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
