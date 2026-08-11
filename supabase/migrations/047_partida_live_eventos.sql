-- 046_partida_live_eventos.sql
-- Partida ao vivo: status `live` + log de eventos (gol / gol contra + assist).
--
-- Novo ciclo:
--   draft  -> times montados, ainda nao comecou
--   live   -> partida aberta; admin registra eventos; NAO entra no ranking
--   published -> finalizada; contadores agregados; votacao 24h
--   closed -> votacao encerrada
--
-- Eventos sao a fonte da verdade durante `live`. A cada insert/delete,
-- `sincronizar_contadores_partida` recalcula gols/assists/gols_contra em
-- partidas_participantes (assim `partida_placar` reflete o placar ao vivo
-- na lista de Jogos). Ranking/stats continuam filtrando so published+closed.
--
-- Ao finalizar: sincroniza de novo, status=published, voting_closes_at=now()+24h.

-- 1) Novo valor de status.
ALTER TABLE partidas DROP CONSTRAINT IF EXISTS partidas_status_check;
ALTER TABLE partidas ADD CONSTRAINT partidas_status_check
  CHECK (status IN ('draft', 'live', 'published', 'closed'));

-- 2) Log de eventos.
CREATE TABLE partida_eventos (
  id                       bigserial PRIMARY KEY,
  partida_id               bigint NOT NULL REFERENCES partidas(id) ON DELETE CASCADE,
  tipo                     text NOT NULL CHECK (tipo IN ('gol', 'gol_contra')),
  jogador_id               bigint NOT NULL REFERENCES jogadores(id),
  assistencia_jogador_id   bigint REFERENCES jogadores(id),
  created_at               timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (tipo = 'gol_contra' AND assistencia_jogador_id IS NULL)
    OR tipo = 'gol'
  ),
  CHECK (
    assistencia_jogador_id IS NULL
    OR assistencia_jogador_id <> jogador_id
  )
);

CREATE INDEX idx_partida_eventos_partida
  ON partida_eventos (partida_id, created_at);

GRANT SELECT ON partida_eventos TO anon, authenticated;

-- 3) Recalcula os contadores da partida a partir do log de eventos.
--    Interna: chamada so pelas RPCs SECURITY DEFINER (sem GRANT a anon).
CREATE OR REPLACE FUNCTION sincronizar_contadores_partida(p_partida_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE partidas_participantes pp
  SET
    gols = (
      SELECT COUNT(*)::integer
      FROM partida_eventos e
      WHERE e.partida_id = pp.partida_id
        AND e.jogador_id = pp.jogador_id
        AND e.tipo = 'gol'
    ),
    gols_contra = (
      SELECT COUNT(*)::integer
      FROM partida_eventos e
      WHERE e.partida_id = pp.partida_id
        AND e.jogador_id = pp.jogador_id
        AND e.tipo = 'gol_contra'
    ),
    assistencias = (
      SELECT COUNT(*)::integer
      FROM partida_eventos e
      WHERE e.partida_id = pp.partida_id
        AND e.assistencia_jogador_id = pp.jogador_id
    )
  WHERE pp.partida_id = p_partida_id;
END;
$$;

-- 4) draft -> live. Exige 8 jogadores em cada time. Zera contadores/eventos.
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
BEGIN
  SELECT status INTO v_status
  FROM partidas
  WHERE id = p_partida_id;

  IF v_status IS NULL OR v_status <> 'draft' THEN
    RETURN false;
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE time = 'a'),
    COUNT(*) FILTER (WHERE time = 'b')
  INTO v_time_a, v_time_b
  FROM partidas_participantes
  WHERE partida_id = p_partida_id;

  IF v_time_a <> 8 OR v_time_b <> 8 THEN
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

GRANT EXECUTE ON FUNCTION abrir_partida(bigint) TO anon, authenticated;

-- 5) Registra um evento (so em live). Assistencia so em gol e do mesmo time.
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
  v_status     text;
  v_time       char(1);
  v_time_assist char(1);
  v_evento_id  bigint;
  v_assist     bigint;
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

  PERFORM sincronizar_contadores_partida(p_partida_id);

  RETURN v_evento_id;
END;
$$;

GRANT EXECUTE ON FUNCTION registrar_evento(bigint, text, bigint, bigint) TO anon, authenticated;

-- 6) Remove um evento (desfazer), so em live.
CREATE OR REPLACE FUNCTION remover_evento(p_evento_id bigint)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partida_id bigint;
  v_status     text;
BEGIN
  SELECT e.partida_id, p.status
  INTO v_partida_id, v_status
  FROM partida_eventos e
  JOIN partidas p ON p.id = e.partida_id
  WHERE e.id = p_evento_id;

  IF v_partida_id IS NULL OR v_status <> 'live' THEN
    RETURN false;
  END IF;

  DELETE FROM partida_eventos WHERE id = p_evento_id;
  PERFORM sincronizar_contadores_partida(v_partida_id);
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION remover_evento(bigint) TO anon, authenticated;

-- 7) live -> published: agrega (idempotente) e abre votacao 24h.
CREATE OR REPLACE FUNCTION finalizar_partida(p_partida_id bigint)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  SELECT status INTO v_status
  FROM partidas
  WHERE id = p_partida_id;

  IF v_status IS NULL OR v_status <> 'live' THEN
    RETURN false;
  END IF;

  PERFORM sincronizar_contadores_partida(p_partida_id);

  UPDATE partidas
  SET
    status = 'published',
    voting_closes_at = now() + interval '24 hours'
  WHERE id = p_partida_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION finalizar_partida(bigint) TO anon, authenticated;
