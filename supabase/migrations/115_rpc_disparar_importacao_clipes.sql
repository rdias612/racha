-- 115_rpc_disparar_importacao_clipes.sql
-- Fase 6 (RF03, P1): admin dispara a importação de clipes por dia específico
-- pelo app, sem Edge Function. Padrão de disparar_confirmacao_manual (099:217-267):
-- gate is_admin → leitura do segredo no Vault (099:242-245) → montagem de headers
-- jsonb → PERFORM disparar_e_registrar_cron_http (099:34-167), que resolve a
-- resposta assíncrona do pg_net e registra o TRANSPORTE em cron_execucoes (P10).
-- O ledger da feature (clipes_importacoes) é gravado pela própria Action
-- (origem 'manual' via GITHUB_EVENT_NAME, Fase 2) — esta RPC NÃO grava nele.

CREATE OR REPLACE FUNCTION disparar_importacao_clipes(
  p_admin_id bigint,
  p_data     date
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public   -- padrão 099; vault é acessado por nome qualificado
AS $$
DECLARE
  v_is_admin boolean;
  v_pat      text;
  v_headers  jsonb;
BEGIN
  -- 1) Gate is_admin (padrão 099:232-235)
  SELECT is_admin INTO v_is_admin FROM jogadores WHERE id = p_admin_id;
  IF v_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso restrito a administradores.';
  END IF;

  -- 2) Validação leve do dia alvo (RF03: recuperar atraso/histórico — data passada)
  IF p_data IS NULL THEN
    RAISE EXCEPTION 'Data obrigatória (AAAA-MM-DD).';
  END IF;
  IF p_data > (now() AT TIME ZONE 'America/Sao_Paulo')::date THEN
    RAISE EXCEPTION 'Data não pode ser futura.';
  END IF;

  -- 3) PAT do Vault — leitura direta, padrão 099:242-245 (decisão na seção 8.1)
  SELECT decrypted_secret INTO v_pat
    FROM vault.decrypted_secrets
    WHERE name = 'github_pat_clipes'
    LIMIT 1;

  IF v_pat IS NULL THEN
    INSERT INTO cron_execucoes (job_nome, sucesso, erro)
    VALUES ('disparar_importacao_clipes', false, 'Secret github_pat_clipes não encontrado no vault.');
    RAISE EXCEPTION 'Secret github_pat_clipes não configurado no vault.';
  END IF;

  -- 4) Chamada à GitHub API workflow_dispatch.
  --    Owner/repo e ref fixados (remote conferido: github.com/rdias612/racha,
  --    branch main — decisão na seção 8.2; precedentes de URL fixa: 099:260, 099:305).
  v_headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Accept', 'application/vnd.github+json',
    'Authorization', 'Bearer ' || v_pat,
    'X-GitHub-Api-Version', '2022-11-28'
  );

  PERFORM disparar_e_registrar_cron_http(
    'disparar_importacao_clipes',
    'https://api.github.com/repos/rdias612/racha/actions/workflows/clipes-filmaeu.yml/dispatches',
    v_headers,
    jsonb_build_object(
      'ref', 'main',
      'inputs', jsonb_build_object(
        'data',    to_char(p_data, 'YYYY-MM-DD'),
        'horario', '19:00'
      )
    )
  );

  RETURN true;
END;
$$;

-- Padrão das RPCs admin (099:585): EXECUTE amplo + gate is_admin interno.
GRANT EXECUTE ON FUNCTION disparar_importacao_clipes(bigint, date) TO anon, authenticated;
