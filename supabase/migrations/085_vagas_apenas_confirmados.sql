-- 085_vagas_apenas_confirmados.sql
--
-- Ajusta as regras de contagem de vagas ocupadas nas RPCs de confirmação:
-- Apenas jogadores com status 'confirmado' ocupam vaga preenchida.
-- Jogadores 'pendente' ou 'recusado' não ocupam vaga.
--
-- Atualiza:
-- 1. confirmar_presenca: valida se total de confirmados pelos demais < 14 ao confirmar.
-- 2. adicionar_participante: valida se total de confirmados < 14 ao adicionar.

-- 1) RPC: confirmar_presenca (limite 14 confirmados)
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
  v_ocupadas       bigint;
BEGIN
  IF p_status NOT IN ('pendente','confirmado','recusado') THEN
    RETURN false;
  END IF;

  SELECT p.status
    INTO v_status_partida
    FROM partidas p
    WHERE p.id = p_partida_id;
  IF v_status_partida IS NULL OR v_status_partida <> 'draft' THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM partidas_participantes pp
    WHERE pp.partida_id = p_partida_id AND pp.jogador_id = p_jogador_id
  ) THEN
    RETURN false;  -- não convidado para esta partida
  END IF;

  -- Se for confirmar, verifica se ainda há vagas (limite 14 confirmados)
  IF p_status = 'confirmado' THEN
    SELECT count(*) INTO v_ocupadas
      FROM partidas_participantes pp
      WHERE pp.partida_id = p_partida_id
        AND pp.jogador_id <> p_jogador_id
        AND pp.status_confirmacao = 'confirmado';

    IF v_ocupadas >= 14 THEN
      RETURN false;  -- vagas esgotadas (14)
    END IF;
  END IF;

  UPDATE partidas_participantes
    SET status_confirmacao = p_status,
        confirmado_em = CASE WHEN p_status = 'confirmado' THEN now() ELSE NULL END
    WHERE partida_id = p_partida_id AND jogador_id = p_jogador_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION confirmar_presenca(bigint, bigint, text) TO anon, authenticated;

-- 2) RPC: adicionar_participante (limite 14 confirmados)
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
  v_ocupadas       bigint;
  v_existe         boolean;
BEGIN
  SELECT p.status
    INTO v_status_partida
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
      AND pp.status_confirmacao = 'confirmado';

  IF v_ocupadas >= 14 THEN
    RETURN false;  -- sem vagas (14)
  END IF;

  INSERT INTO partidas_participantes (partida_id, jogador_id, posicao, status_confirmacao, confirmado_em)
    SELECT p_partida_id, j.id, j.posicao, 'confirmado', now()
    FROM jogadores j
    WHERE j.id = p_jogador_id;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION adicionar_participante(bigint, bigint) TO anon, authenticated;
