-- 017_fix_rpc_crypt.sql
-- Corrige 3 RPCs que usavam crypt()/gen_salt() sem qualificar o schema.
-- Como as funções são SECURITY DEFINER com search_path = public, as funções
-- do pgcrypto não eram resolvidas em runtime ("function gen_salt(unknown)
-- does not exist"). Fix: qualificar como public.crypt / public.gen_salt
-- (no Supabase, pgcrypto instala no schema public).
--
-- Também corrige fazer_login para qualificar jogadores.username/is_ativo
-- (coluna ambígua vs. a coluna username do RETURNS TABLE).
--
-- CREATE OR REPLACE preserva os GRANTs existentes.

-- 003: fazer_login (corrigida)
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
SET search_path = public, extensions
AS $$
DECLARE
  v_jogador jogadores%ROWTYPE;
BEGIN
  SELECT * INTO v_jogador
  FROM jogadores
  WHERE jogadores.username = p_username
    AND jogadores.is_ativo = true
  LIMIT 1;

  -- Jogador inexistente/inativo OU senha invalida => retorna 0 linhas.
  IF v_jogador.id IS NULL THEN
    RETURN;
  END IF;

  -- bcrypt: crypt(input, hash) recria usando o salt do hash.
  -- Se for DIFERENTE do hash guardado, a senha está errada => barra.
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

-- 011: criar_jogador (corrigida)
CREATE OR REPLACE FUNCTION criar_jogador(
  p_username text,
  p_nome     text,
  p_posicao  text,
  p_is_admin boolean
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_id bigint;
BEGIN
  INSERT INTO jogadores (username, senha_hash, nome, posicao, is_admin, is_ativo)
  VALUES (p_username, crypt('123', gen_salt('bf')), p_nome, p_posicao, p_is_admin, true)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- 012: trocar_senha (corrigida)
CREATE OR REPLACE FUNCTION trocar_senha(
  p_jogador_id    bigint,
  p_senha_atual   text,
  p_senha_nova    text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_senha_hash text;
BEGIN
  SELECT senha_hash INTO v_senha_hash
  FROM jogadores
  WHERE id = p_jogador_id;

  -- Jogador inexistente.
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Senha atual incorreta.
  IF crypt(p_senha_atual, v_senha_hash) <> v_senha_hash THEN
    RETURN false;
  END IF;

  UPDATE jogadores
  SET senha_hash = crypt(p_senha_nova, gen_salt('bf'))
  WHERE id = p_jogador_id;

  RETURN true;
END;
$$;
