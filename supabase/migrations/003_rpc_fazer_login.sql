-- 003_rpc_fazer_login.sql
-- RPC `fazer_login(p_username text, p_senha text)`:
--   Procura o jogador por `username` (case-sensitive) com is_ativo = true.
--   Valida a senha via bcrypt: crypt(p_senha, senha_hash) = senha_hash.
--   Se valido, retorna a linha do jogador SEM senha_hash e SEM created_at.
--   Se invalido ou inexistente, retorna 0 linhas (tabela vazia).
--
-- Decisao de risco aceita (Regra 6 do PLANO.md): o sistema nao tem sessao
-- server-side. O `id` retornado e confiado pelo servidor em todas as requests
-- seguintes (voter_id, criado_por, jogador_id em trocar_senha, etc.).
--
-- SECURITY DEFINER + search_path = public para evitar sequestro de search_path.
-- Grants para anon e authenticated.

CREATE OR REPLACE FUNCTION fazer_login(p_username text, p_senha text)
RETURNS TABLE (
  id        bigint,
  username  text,
  nome      text,
  posicao   text,
  is_admin  boolean,
  is_ativo  boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_jogador jogadores%ROWTYPE;
BEGIN
  SELECT * INTO v_jogador
  FROM jogadores
  WHERE username = p_username
    AND is_ativo = true
  LIMIT 1;

  -- Jogador inexistente/inativo OU senha invalida => retorna 0 linhas.
  IF v_jogador.id IS NULL THEN
    RETURN;
  END IF;

  IF crypt(p_senha, v_jogador.senha_hash) <> v_jogador.senha_hash THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    v_jogador.id,
    v_jogador.username,
    v_jogador.nome,
    v_jogador.posicao,
    v_jogador.is_admin,
    v_jogador.is_ativo;
END;
$$;

GRANT EXECUTE ON FUNCTION fazer_login(text, text) TO anon, authenticated;
