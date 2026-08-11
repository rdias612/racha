-- 056_rpc_criar_jogador_mensalista.sql
-- Atualiza a RPC `criar_jogador` para receber o parâmetro `p_is_mensalista`.

DROP FUNCTION IF EXISTS criar_jogador(text, text, text, boolean);
DROP FUNCTION IF EXISTS criar_jogador(text, text, text, boolean, text);
DROP FUNCTION IF EXISTS criar_jogador(text, text, text, boolean, text, boolean);

CREATE OR REPLACE FUNCTION criar_jogador(
  p_username      text,
  p_nome          text,
  p_posicao       text,
  p_is_admin      boolean,
  p_posicao_b     text DEFAULT 'meia',
  p_is_mensalista boolean DEFAULT false
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id bigint;
  v_posicao_b text;
BEGIN
  -- Goleiros primarios nao tem posicao secundaria.
  v_posicao_b := CASE WHEN p_posicao = 'goleiro' THEN NULL ELSE p_posicao_b END;

  INSERT INTO jogadores (username, senha_hash, nome, posicao, is_admin, is_ativo, posicao_b, is_mensalista)
  VALUES (p_username, '123', p_nome, p_posicao, p_is_admin, true, v_posicao_b, COALESCE(p_is_mensalista, false))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION criar_jogador(text, text, text, boolean, text, boolean) TO anon, authenticated;
