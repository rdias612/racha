-- 102_fix_fazer_login_coluna_ambigua.sql
-- Corrige a RPC `fazer_login` qualificando as colunas da tabela `jogadores`.
--
-- Motivo: Em funções PL/pgSQL com `RETURNS TABLE (username text, is_ativo boolean, ...)`,
-- as colunas do tipo retornado são tratadas como variáveis no escopo da função.
-- Quando a consulta interna usa `WHERE username = ... AND is_ativo = ...` sem
-- qualificar a tabela (ex.: `j.username`, `j.is_ativo`), o PostgreSQL emite o
-- erro 42702 (column reference "username" is ambiguous / referência ambígua).
--
-- Esta migration qualifica explicitamente a tabela `jogadores` via alias `j`,
-- e adicionalmente normaliza a busca com TRIM e comparação case-insensitive (LOWER),
-- tornando o login mais tolerante a variações comuns em dispositivos móveis (ex.: iOS).

CREATE OR REPLACE FUNCTION fazer_login(p_username text, p_senha text)
RETURNS TABLE (
  id             bigint,
  username       text,
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
  FROM public.jogadores j
  WHERE LOWER(j.username) = LOWER(TRIM(p_username))
    AND j.is_ativo = true
  LIMIT 1;

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
    v_jogador.posicao,
    v_jogador.is_admin,
    v_jogador.is_ativo,
    v_jogador.is_mensalista,
    v_jogador.posicao_b;
END;
$$;

GRANT EXECUTE ON FUNCTION fazer_login(text, text) TO anon, authenticated;
