-- 111_rpc_obter_segredo_vault.sql
-- P3 (breakdown §5): a Action consome segredos do Vault via PostgREST, porque
-- vault.decrypted_secrets não é exposto ao PostgREST. Uma única RPC dedicada
-- (SECURITY DEFINER, padrão de leitura do Vault de 099:242-245) atende o Filma Eu
-- (Fase 3) e o PAT do GitHub (Fase 6) sem expor o schema vault.
-- Executável EXCLUSIVAMENTE pela service_role (padrão de revogação de 077:51-52;
-- a Action roda com a service key — 037_push_function_permissions.sql já concede
-- os acessos de tabela que ela precisa; o EXECUTE dela é concedido aqui).

CREATE OR REPLACE FUNCTION obter_segredo_vault(p_nome text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, vault   -- padrão 018 (search_path fixado em RPC DEFINER)
AS $$
DECLARE
  v_valor text;
BEGIN
  SELECT decrypted_secret INTO v_valor
    FROM vault.decrypted_secrets
    WHERE name = p_nome
    LIMIT 1;

  -- Nulo se o secret não existir: o chamador valida e registra no ledger
  -- (a Action NUNCA loga o valor retornado — RNF02).
  RETURN v_valor;
END;
$$;

-- Execução restrita à service_role (nenhum client chama):
REVOKE ALL ON FUNCTION obter_segredo_vault(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION obter_segredo_vault(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION obter_segredo_vault(text) TO service_role;
