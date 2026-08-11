-- 048_rpc_editar_evento.sql
-- Permite alterar tipo / jogador / assistencia de um evento enquanto a
-- partida esta `live`. Recalcula os contadores depois do UPDATE.

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
  v_partida_id bigint;
  v_status     text;
  v_time       char(1);
  v_time_assist char(1);
  v_assist     bigint;
BEGIN
  SELECT e.partida_id, p.status
  INTO v_partida_id, v_status
  FROM partida_eventos e
  JOIN partidas p ON p.id = e.partida_id
  WHERE e.id = p_evento_id;

  IF v_partida_id IS NULL OR v_status <> 'live' THEN
    RETURN false;
  END IF;

  IF p_tipo NOT IN ('gol', 'gol_contra') THEN
    RETURN false;
  END IF;

  SELECT time INTO v_time
  FROM partidas_participantes
  WHERE partida_id = v_partida_id
    AND jogador_id = p_jogador_id;

  IF v_time IS NULL THEN
    RETURN false;
  END IF;

  v_assist := p_assistencia_jogador_id;
  IF p_tipo = 'gol_contra' THEN
    v_assist := NULL;
  END IF;

  IF v_assist IS NOT NULL THEN
    IF v_assist = p_jogador_id THEN
      RETURN false;
    END IF;

    SELECT time INTO v_time_assist
    FROM partidas_participantes
    WHERE partida_id = v_partida_id
      AND jogador_id = v_assist;

    IF v_time_assist IS NULL OR v_time_assist <> v_time THEN
      RETURN false;
    END IF;
  END IF;

  UPDATE partida_eventos
  SET
    tipo = p_tipo,
    jogador_id = p_jogador_id,
    assistencia_jogador_id = v_assist
  WHERE id = p_evento_id;

  PERFORM sincronizar_contadores_partida(v_partida_id);
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION editar_evento(bigint, text, bigint, bigint) TO anon, authenticated;
