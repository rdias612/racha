-- 013_rpc_criar_partida.sql
-- RPC TRANSACIONAL `criar_partida(p_data_jogo, p_criado_por, p_participantes jsonb)
--                   RETURNS bigint`:
--   p_participantes = array de objetos:
--     [{jogador_id, time, posicao, gols, assistencias}, ...]
--   (tipicamente 16 elementos: 8 no time 'a', 8 no 'b').
--
--   Fluxo:
--     1. INSERT em partidas (status='draft', criado_por=p_criado_por) -> v_partida_id.
--     2. Para cada elemento do array (jsonb_array_elements), INSERT em
--        partidas_participantes com partida_id=v_partida_id e os campos do elemento.
--     3. Retorna v_partida_id.
--
--   Tudo envolto em BEGIN ... EXCEPTION WHEN OTHERS THEN ROLLBACK; RETURN NULL; END.
--   Qualquer falha (CHECK violado, FK invalida, JSON malformado, etc.) faz
--   rollback completo (nem a partida nem participantes ficam gravados) e
--   retorna NULL. O app trata NULL como erro.
--
--   A publicacao (status='published' + voting_closes_at=now()+24h) e feita
--   em outra chamada (UPDATE direto do app), fora desta funcao.
--
--   p_criado_por e confiado (Regra 6) - esperado ser o id do admin logado.
--
-- SECURITY DEFINER + search_path = public.

CREATE OR REPLACE FUNCTION criar_partida(
  p_data_jogo       timestamptz,
  p_criado_por      bigint,
  p_participantes   jsonb
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partida_id bigint;
  elem         jsonb;
BEGIN
  BEGIN
    INSERT INTO partidas (data_jogo, status, criado_por)
    VALUES (p_data_jogo, 'draft', p_criado_por)
    RETURNING id INTO v_partida_id;

    FOR elem IN SELECT * FROM jsonb_array_elements(p_participantes)
    LOOP
      INSERT INTO partidas_participantes
        (partida_id, jogador_id, time, posicao, gols, assistencias, gols_contra)
      VALUES (
        v_partida_id,
        (elem->>'jogador_id')::bigint,
        (elem->>'time')::char(1),
        (elem->>'posicao')::text,
        COALESCE((elem->>'gols')::integer, 0),
        COALESCE((elem->>'assistencias')::integer, 0),
        COALESCE((elem->>'gols_contra')::integer, 0)
      );
    END LOOP;

    RETURN v_partida_id;

  EXCEPTION WHEN OTHERS THEN
    ROLLBACK;
    RETURN NULL;
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION criar_partida(timestamptz, bigint, jsonb) TO anon, authenticated;
