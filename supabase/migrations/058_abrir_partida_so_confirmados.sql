-- 058_abrir_partida_so_confirmados.sql
--
-- Com a confirmação de presença (migration 057), o elenco que efetivamente
-- joga é o conjunto dos 'confirmado' (8 por time, 1 goleiro por time).
-- `abrir_partida` agora filtra por status_confirmacao='confirmado' nas
-- contagens e no reset de placar, ignorando pendente/recusado (que ficam
-- apenas como registro na lista pública).

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

  IF v_time_a <> 8 OR v_time_b <> 8 THEN
    RETURN false;
  END IF;

  -- Cada time precisa de exatamente 1 goleiro (impede 2 vs 0).
  IF v_gk_a <> 1 OR v_gk_b <> 1 THEN
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
