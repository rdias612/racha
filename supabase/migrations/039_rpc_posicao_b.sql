-- 039_rpc_posicao_b.sql
-- Propaga a coluna `posicao_b` (adicionada em 038) pelas RPCs de login e de
-- criacao de jogador.
--
--   - `fazer_login`: retorna tambem `posicao_b` (nullable) alem de `is_mensalista`
--     (ja incluido em 035).
--   - `criar_jogador`: ganha parametro `p_posicao_b text DEFAULT 'meia'`.
--
-- Como o conjunto de colunas do `RETURNS TABLE` muda, `fazer_login` precisa ser
-- DROP+CREATE (PostgreSQL nao permite alterar o retorno via CREATE OR REPLACE).
-- A assinatura de entrada e a mesma, entao o GRANT EXECUTE precisa ser refeito
-- (DROP FUNCTION remove os grants da function).
--
-- `criar_jogador` muda de assinatura (ganha parametro), o que tambem exige
-- DROP+CREATE. Default mantem '123' como senha (migration 021).
-- SECURITY DEFINER + search_path = public (inalterados).

-- ---------------------------------------------------------------------------
-- fazer_login
-- ---------------------------------------------------------------------------
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
  FROM jogadores
  WHERE username = p_username
    AND is_ativo = true
  LIMIT 1;

  -- Jogador inexistente/inativo OU senha invalida => retorna 0 linhas.
  IF v_jogador.id IS NULL THEN
    RETURN;
  END IF;

  IF p_senha <> v_jogador.senha_hash THEN
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

-- ---------------------------------------------------------------------------
-- criar_jogador
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS criar_jogador(text, text, text, boolean);

CREATE OR REPLACE FUNCTION criar_jogador(
  p_username  text,
  p_nome      text,
  p_posicao   text,
  p_is_admin  boolean,
  p_posicao_b text DEFAULT 'meia'
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

  INSERT INTO jogadores (username, senha_hash, nome, posicao, is_admin, is_ativo, posicao_b)
  VALUES (p_username, '123', p_nome, p_posicao, p_is_admin, true, v_posicao_b)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION criar_jogador(text, text, text, boolean, text) TO anon, authenticated;
