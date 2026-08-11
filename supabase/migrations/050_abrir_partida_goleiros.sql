-- 050_abrir_partida_goleiros.sql
--
-- Reforço server-side para o bug "um time com 2 goleiros e o outro sem nenhum":
-- além de exigir 8 jogadores por time, `abrir_partida` agora exige EXATAMENTE
-- 1 goleiro por time. Assim uma partida com goleiros desbalanceados (criada por
-- um cliente que bypass da UI, ou dados antigos) não consegue ir ao vivo.
--
-- A checagem de criação fica no client (PartidaNovaTimes); a checagem server
-- definitiva fica aqui (mesmo padrão da validação de 8 por time).

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
  WHERE partida_id = p_partida_id;

  IF v_time_a <> 8 OR v_time_b <> 8 THEN
    RETURN false;
  END IF;

  -- Cada time precisa de exatamente 1 goleiro (impede 2 vs 0).
  IF v_gk_a <> 1 OR v_gk_b <> 1 THEN
    RETURN false;
  END IF;

  DELETE FROM partida_eventos WHERE partida_id = p_partida_id;

  UPDATE partidas_participantes
  SET gols = 0, assistencias = 0, gols_contra = 0
  WHERE partida_id = p_partida_id;

  UPDATE partidas
  SET status = 'live'
  WHERE id = p_partida_id;

  RETURN true;
END;
$$;
