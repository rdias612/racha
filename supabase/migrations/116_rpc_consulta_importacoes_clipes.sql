-- 116_rpc_consulta_importacoes_clipes.sql
-- Fase 6 (RF08, P10): consultas admin do ledger da feature para o painel da Fase 8.
-- Padrão de obter_execucoes_cron (099:172-211): gate is_admin, RETURNS TABLE
-- tipado, STABLE SECURITY DEFINER SET search_path = public, LIMIT com clamp.
-- A tabela é inacessível ao client (REVOKE da Fase 1, fase-1-tasks.md:93) —
-- estas RPCs são o único caminho de leitura pelo app.

-- ----------------------------------------------------------------------------
-- 1. Histórico completo (mais recente primeiro) — RF08
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION obter_importacoes_clipes(
  p_admin_id bigint,
  p_limite   integer DEFAULT 50
)
RETURNS TABLE (
  id                bigint,
  partida_id        bigint,
  data_referencia   date,
  origem            text,
  status            text,
  sucesso           boolean,
  quantidade_clipes integer,
  bytes_total       bigint,
  detalhe           text,
  erro              text,
  criado_em         timestamptz,
  atualizado_em     timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  -- Gate admin (colunas do RETURNS TABLE colidem: qualificar jogadores.id — lição da 104/106)
  SELECT is_admin INTO v_is_admin FROM jogadores WHERE jogadores.id = p_admin_id;
  IF v_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso restrito a administradores.';
  END IF;

  RETURN QUERY
  SELECT
    ci.id,
    ci.partida_id,
    ci.data_referencia,
    ci.origem,
    ci.status,
    ci.sucesso,
    ci.quantidade_clipes,
    ci.bytes_total,
    ci.detalhe,
    ci.erro,
    ci.criado_em,
    ci.atualizado_em
  FROM clipes_importacoes ci
  ORDER BY ci.criado_em DESC, ci.id DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limite, 50), 1), 200);
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. Falhas recentes — aviso do painel (RF07)
--    Inclui 'falha' (erro de execução) e 'sem_clipes' (sucesso false / exit 0,
--    condição de alerta definida na Fase 3/5 — fase-5-tasks.md:33). Janela de
--    1h a 720h (30 dias), default 48h.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION obter_falhas_recentes_clipes(
  p_admin_id bigint,
  p_horas    integer DEFAULT 48
)
RETURNS TABLE (
  id                bigint,
  partida_id        bigint,
  data_referencia   date,
  origem            text,
  status            text,
  sucesso           boolean,
  quantidade_clipes integer,
  bytes_total       bigint,
  detalhe           text,
  erro              text,
  criado_em         timestamptz,
  atualizado_em     timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  -- Gate admin (colunas do RETURNS TABLE colidem: qualificar jogadores.id — lição da 104/106)
  SELECT is_admin INTO v_is_admin FROM jogadores WHERE jogadores.id = p_admin_id;
  IF v_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso restrito a administradores.';
  END IF;

  RETURN QUERY
  SELECT
    ci.id,
    ci.partida_id,
    ci.data_referencia,
    ci.origem,
    ci.status,
    ci.sucesso,
    ci.quantidade_clipes,
    ci.bytes_total,
    ci.detalhe,
    ci.erro,
    ci.criado_em,
    ci.atualizado_em
  FROM clipes_importacoes ci
  WHERE ci.status IN ('falha', 'sem_clipes')
    AND ci.criado_em >= now() - make_interval(hours => LEAST(GREATEST(COALESCE(p_horas, 48), 1), 720))
  ORDER BY ci.criado_em DESC, ci.id DESC;
END;
$$;

-- Padrão das RPCs admin (099:584): EXECUTE amplo + gate is_admin interno.
GRANT EXECUTE ON FUNCTION obter_importacoes_clipes(bigint, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION obter_falhas_recentes_clipes(bigint, integer) TO anon, authenticated;
