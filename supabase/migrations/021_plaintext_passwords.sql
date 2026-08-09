-- 021_plaintext_passwords.sql
-- Senhas passam a ser armazenadas e comparadas em texto puro.
-- Hashes bcrypt existentes nao podem ser convertidos sem conhecer a senha original.

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
  WHERE jogadores.username = p_username
    AND jogadores.is_ativo = true
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
    v_jogador.is_ativo;
END;
$$;

CREATE OR REPLACE FUNCTION criar_jogador(
  p_username text,
  p_nome text,
  p_posicao text,
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
  VALUES (p_username, '123', p_nome, p_posicao, p_is_admin, true)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION trocar_senha(
  p_jogador_id bigint,
  p_senha_atual text,
  p_senha_nova text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_senha_atual text;
BEGIN
  SELECT senha_hash INTO v_senha_atual
  FROM jogadores
  WHERE id = p_jogador_id;

  IF NOT FOUND OR p_senha_atual <> v_senha_atual THEN
    RETURN false;
  END IF;

  UPDATE jogadores
  SET senha_hash = p_senha_nova
  WHERE id = p_jogador_id;

  RETURN true;
END;
$$;