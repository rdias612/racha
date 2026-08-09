-- 011_rpc_criar_jogador.sql
-- RPC `criar_jogador(p_username, p_nome, p_posicao, p_is_admin) RETURNS bigint`:
--   Insere em `jogadores` com:
--     senha_hash = crypt('123', gen_salt('bf'))   <- senha default fixa
--     is_ativo   = true
--   Retorna o `id` do novo jogador.
--
-- NAO valida admin aqui: o controle de quem pode chamar (so admin logado) fica
-- no app (UI esconde a tela de NovoJogador para nao-admin). A funcao confia no
-- caller (postura de seguranca relaxada, coerente com a Regra 6).
--
-- A senha default "123" deve ser trocada pelo jogador na tela de Perfil.
-- Se o username ja existir, a constraint UNIQUE levanta excecao (tratada no app).
--
-- SECURITY DEFINER + search_path = public.

CREATE OR REPLACE FUNCTION criar_jogador(
  p_username text,
  p_nome     text,
  p_posicao  text,
  p_is_admin boolean
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id bigint;
BEGIN
  INSERT INTO jogadores (username, senha_hash, nome, posicao, is_admin, is_ativo)
  VALUES (p_username, public.crypt('123', public.gen_salt('bf')), p_nome, p_posicao, p_is_admin, true)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION criar_jogador(text, text, text, boolean) TO anon, authenticated;
