-- 041_rpc_descartar_votos.sql
-- RPC `descartar_votos(p_partida_id, p_voter_id) RETURNS boolean`:
--   Apaga TODOS os votos de um votante numa partida (uma linha por alvo avaliado),
--   devolvendo o votante ao estado "ainda nao votei" para refazer do zero.
--
--   BLOQUEIO SERVER-SIDE (igual ao `registrar_votos` em 014):
--     Valida que a partida tem status='published' E voting_closes_at > now().
--     Se nao, retorna false SEM gravar nada (janela de 24h fechada).
--
--   Em transacao, faz:
--     DELETE FROM votes WHERE partida_id = p_partida_id AND voter_id = p_voter_id;
--
--   Retorna true se sucesso (mesmo que 0 linhas tenham sido apagadas); false
--   em qualquer falha (janela fechada ou erro inesperado, com rollback completo).
--
--   p_voter_id e confiado (Regra 6) - esperado ser o id do jogador logado.
--
-- SECURITY DEFINER + search_path = public.

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

  -- (2) DELETE de todos os votos do votante na partida, em transacao.
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

GRANT EXECUTE ON FUNCTION descartar_votos(bigint, bigint) TO anon, authenticated;
