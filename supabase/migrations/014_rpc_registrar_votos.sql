-- 014_rpc_registrar_votos.sql
-- RPC TRANSACIONAL + UPSERT `registrar_votos(p_partida_id, p_voter_id, p_votos jsonb)
--                            RETURNS boolean`:
--   p_votos = array de [{target_id, rating}, ...] (notas 0..10 dadas pelo votante).
--
--   BLOQUEIO SERVER-SIDE DUPLO (independente do pg_cron, que so sincroniza status):
--     1. Valida que a partida tem status='published' E voting_closes_at > now().
--        Se nao, retorna false SEM gravar nada (janela de 24h fechada).
--     2. Valida que p_voter_id <> target_id para todos os votos (defesa em
--        profundidade, embora a tabela votes ja tenha CHECK(voter_id<>target_id)).
--        Se algum for self-vote, retorna false (sem gravar nada).
--
--   Em transacao, para cada voto faz UPSERT:
--     INSERT INTO votes (partida_id, voter_id, target_id, rating)
--     VALUES (p_partida_id, p_voter_id, v_target_id, v_rating)
--     ON CONFLICT (partida_id, voter_id, target_id)
--     DO UPDATE SET rating = EXCLUDED.rating;
--   Isso permite EDITAR votos dentro da janela (reenviar muda o rating).
--
--   Retorna true se sucesso; false em qualquer falha (com rollback completo).
--
--   p_voter_id e confiado (Regra 6) - esperado ser o id do jogador logado.
--
-- SECURITY DEFINER + search_path = public.

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

  -- (2) Validacao previa: nenhum self-vote. Iteramos antes de gravar para
  --     garantir atomicidade (ou grava tudo, ou nada).
  FOR elem IN SELECT * FROM jsonb_array_elements(p_votos)
  LOOP
    v_target_id := (elem->>'target_id')::bigint;
    IF v_target_id = p_voter_id THEN
      RETURN false;
    END IF;
  END LOOP;

  -- (3) UPSERT de cada voto em transacao.
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

GRANT EXECUTE ON FUNCTION registrar_votos(bigint, bigint, jsonb) TO anon, authenticated;
