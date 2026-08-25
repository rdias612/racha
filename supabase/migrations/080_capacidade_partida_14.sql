-- 080_capacidade_partida_14.sql
--
-- Ajusta a capacidade máxima de confirmações de presença de 16 para 14
-- (jogadores de linha). Os goleiros não fazem parte da divisão de times
-- e confirmação no momento da escalação.
--
-- Atualiza:
-- 1. confirmar_presenca: limite de vagas ocupadas = 14
-- 2. adicionar_participante: limite de vagas ocupadas = 14
-- 3. abrir_partida: exige 7 jogadores por time (time a e time b), máximo 1 goleiro por time.

-- 1) RPC: confirmar_presenca (limite 14)
CREATE OR REPLACE FUNCTION confirmar_presenca(
  p_partida_id bigint,
  p_jogador_id bigint,
  p_status     text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status_partida text;
  v_closes_at      timestamptz;
  v_atual          text;
  v_ocupadas       bigint;
  v_alvo_ocupa     boolean;
BEGIN
  IF p_status NOT IN ('pendente','confirmado','recusado') THEN
    RETURN false;
  END IF;

  SELECT p.status, p.confirmacao_closes_at
    INTO v_status_partida, v_closes_at
    FROM partidas p
    WHERE p.id = p_partida_id;
  IF v_status_partida IS NULL OR v_status_partida <> 'draft' THEN
    RETURN false;
  END IF;

  SELECT pp.status_confirmacao INTO v_atual
    FROM partidas_participantes pp
    WHERE pp.partida_id = p_partida_id AND pp.jogador_id = p_jogador_id;
  IF NOT FOUND THEN
    RETURN false;  -- não convidado para esta partida
  END IF;

  -- Vagas ocupadas pelos demais jogadores (regra de capacidade = 14)
  SELECT count(*) INTO v_ocupadas
    FROM partidas_participantes pp
    WHERE pp.partida_id = p_partida_id
      AND pp.jogador_id <> p_jogador_id
      AND (
        pp.status_confirmacao = 'confirmado'
        OR (pp.status_confirmacao = 'pendente' AND now() < COALESCE(v_closes_at, now()))
      );

  -- Estado-alvo ocupa vaga?
  v_alvo_ocupa := (p_status = 'confirmado')
               OR (p_status = 'pendente' AND now() < COALESCE(v_closes_at, now()));

  IF v_alvo_ocupa AND v_ocupadas >= 14 THEN
    RETURN false;  -- vagas esgotadas (14)
  END IF;

  UPDATE partidas_participantes
    SET status_confirmacao = p_status,
        confirmado_em = CASE WHEN p_status = 'confirmado' THEN now() ELSE NULL END
    WHERE partida_id = p_partida_id AND jogador_id = p_jogador_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION confirmar_presenca(bigint, bigint, text) TO anon, authenticated;

-- 2) RPC: adicionar_participante (limite 14)
CREATE OR REPLACE FUNCTION adicionar_participante(
  p_partida_id bigint,
  p_jogador_id bigint
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status_partida text;
  v_closes_at      timestamptz;
  v_ocupadas       bigint;
  v_existe         boolean;
BEGIN
  SELECT p.status, p.confirmacao_closes_at
    INTO v_status_partida, v_closes_at
    FROM partidas p
    WHERE p.id = p_partida_id;
  IF v_status_partida IS NULL OR v_status_partida <> 'draft' THEN
    RETURN false;
  END IF;

  SELECT true INTO v_existe
    FROM partidas_participantes pp
    WHERE pp.partida_id = p_partida_id AND pp.jogador_id = p_jogador_id;
  IF v_existe THEN
    RETURN false;  -- já é participante
  END IF;

  SELECT count(*) INTO v_ocupadas
    FROM partidas_participantes pp
    WHERE pp.partida_id = p_partida_id
      AND (
        pp.status_confirmacao = 'confirmado'
        OR (pp.status_confirmacao = 'pendente' AND now() < COALESCE(v_closes_at, now()))
      );
  IF v_ocupadas >= 14 THEN
    RETURN false;  -- sem vagas (14)
  END IF;

  INSERT INTO partidas_participantes (partida_id, jogador_id, posicao, status_confirmacao)
    SELECT p_partida_id, j.id, j.posicao, 'confirmado'
    FROM jogadores j
    WHERE j.id = p_jogador_id;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION adicionar_participante(bigint, bigint) TO anon, authenticated;

-- 3) RPC: abrir_partida (7 jogadores por time)
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
    COUNT(*) FILTER (WHERE time = 'a'),
    COUNT(*) FILTER (WHERE time = 'b'),
    COUNT(*) FILTER (WHERE time = 'a' AND posicao = 'goleiro'),
    COUNT(*) FILTER (WHERE time = 'b' AND posicao = 'goleiro')
  INTO v_time_a, v_time_b, v_gk_a, v_gk_b
  FROM partidas_participantes
  WHERE partida_id = p_partida_id
    AND status_confirmacao = 'confirmado';

  IF v_time_a <> 7 OR v_time_b <> 7 THEN
    RETURN false;
  END IF;

  -- Cada time pode ter no máximo 1 goleiro
  IF v_gk_a > 1 OR v_gk_b > 1 THEN
    RETURN false;
  END IF;

  DELETE FROM partida_eventos WHERE partida_id = p_partida_id;

  -- Zera placar só de quem vai jogar (confirmado).
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
