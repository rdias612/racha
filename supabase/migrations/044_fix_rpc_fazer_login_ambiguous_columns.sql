-- Corrige a RPC de login apos 039_rpc_posicao_b.sql.
-- Em uma funcao RETURNS TABLE, `username` e `is_ativo` tambem sao variaveis
-- de saida; sem qualificar as colunas, o PostgreSQL rejeita a chamada por
-- referencia ambigua.

DROP FUNCTION IF EXISTS fazer_login(text, text);

CREATE OR REPLACE FUNCTION fazer_login(p_username text, p_senha text)
RETURNS TABLE (
  id             bigint,
  username       text,
  nome           text,
  posicao        text,
  is_admin       boolean,
  is_ativo       boolean,
  is_mensalista  boolean,
  posicao_b      text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_jogador jogadores%ROWTYPE;
BEGIN
  SELECT * INTO v_jogador
  FROM public.jogadores
  WHERE public.jogadores.username = p_username
    AND public.jogadores.is_ativo = true
  LIMIT 1;

  IF v_jogador.id IS NULL OR p_senha <> v_jogador.senha_hash THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    v_jogador.id,
    v_jogador.username,
    v_jogador.nome,
    v_jogador.posicao,
    v_jogador.is_admin,
    v_jogador.is_ativo,
    v_jogador.is_mensalista,
    v_jogador.posicao_b;
END;
$$;

GRANT EXECUTE ON FUNCTION fazer_login(text, text) TO anon, authenticated;