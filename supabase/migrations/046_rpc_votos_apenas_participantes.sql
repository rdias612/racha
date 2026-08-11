-- 046_rpc_votos_apenas_participantes.sql
-- Restringe votação a quem realmente jogou a partida (e não é jogador random).
--
--   `registrar_votos` e `descartar_votos` ganham DOIS bloqueios server-side novos,
--   independentes da UI (que também bloqueia em PartidaDetalhe):
--     (A) p_voter_id precisa estar em `partidas_participantes` da partida.
--         Quem não jogou não pode votar (nem descartar votos, já que nunca votou).
--     (B) p_voter_id não pode ser jogador 'random' (username ILIKE 'random%').
--         Randoms são placeholders do sorteio de times e nunca votam.
--   Demais regras (status='published', voting_closes_at > now(), sem self-vote no
--   registrar) todas mantidas. SECURITY DEFINER + search_path = public.

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

  -- (2) Votante precisa ser participante da partida.
  PERFORM 1
    FROM partidas_participantes
    WHERE partida_id = p_partida_id
      AND jogador_id = p_voter_id;
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

  -- (4) Validacao previa: nenhum self-vote. Iteramos antes de gravar para
  --     garantir atomicidade (ou grava tudo, ou nada).
  FOR elem IN SELECT * FROM jsonb_array_elements(p_votos)
  LOOP
    v_target_id := (elem->>'target_id')::bigint;
    IF v_target_id = p_voter_id THEN
      RETURN false;
    END IF;
  END LOOP;

  -- (5) UPSERT de cada voto em transacao.
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
    ROLLBACK;
    RETURN false;
  END;
END;
$$;

CREATE OR REPLACE FUNCTION descartar_votos(
  p_partida_id  bigint,
  p_voter_id    bigint
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status           text;
  v_voting_closes_at timestamptz;
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

  -- (2) Só participa do descarte quem podia votar (participante e não-random).
  PERFORM 1
    FROM partidas_participantes pp
    JOIN jogadores j ON j.id = pp.jogador_id
    WHERE pp.partida_id = p_partida_id
      AND pp.jogador_id = p_voter_id
      AND j.username NOT ILIKE 'random%';
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- (3) DELETE de todos os votos do votante na partida, em transacao.
  BEGIN
    DELETE FROM votes
    WHERE partida_id = p_partida_id
      AND voter_id = p_voter_id;

    RETURN true;

  EXCEPTION WHEN OTHERS THEN
    ROLLBACK;
    RETURN false;
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION registrar_votos(bigint, bigint, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION descartar_votos(bigint, bigint) TO anon, authenticated;
