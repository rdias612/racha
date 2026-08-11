-- 035_rpc_login_is_mensalista.sql
-- Recria a RPC `fazer_login` para tambem retornar `is_mensalista`.
--   - Mesma logica da migration 003_rpc_fazer_login.sql (procura por username com
--     is_ativo = true, valida senha comparando o texto com senha_hash, retorna 0
--     linhas se invalido/inexistente).
--   - Acrescenta `is_mensalista boolean` ao RETURNS TABLE e ao RETURN QUERY final,
--     para que o app saiba se o jogador logado tem vaga garantida como mensalista.
--
-- A coluna `is_mensalista` foi adicionada pela migration 033_add_is_mensalista.sql
-- e os mensalistas marcados pela 034_marcar_mensalistas.sql. Esta migration so
-- atualiza a assinatura/retorno da RPC para propagar o campo ate o app.
--
-- SECURITY DEFINER + search_path = public (inalterado). Grants para anon e
-- authenticated (inalterados).

-- PostgreSQL nao permite alterar o tipo retornado por CREATE OR REPLACE
-- FUNCTION. A assinatura de entrada permanece a mesma, entao a funcao antiga
-- precisa ser removida antes de ser recriada com a coluna adicional.
DROP FUNCTION IF EXISTS fazer_login(text, text);

CREATE OR REPLACE FUNCTION fazer_login(p_username text, p_senha text)
RETURNS TABLE (
  id             bigint,
  username       text,
  nome           text,
  posicao        text,
  is_admin       boolean,
  is_ativo       boolean,
  is_mensalista  boolean
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
    v_jogador.is_mensalista;
END;
$$;

GRANT EXECUTE ON FUNCTION fazer_login(text, text) TO anon, authenticated;
