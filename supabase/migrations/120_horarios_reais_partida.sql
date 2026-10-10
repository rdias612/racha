-- 120_horarios_reais_partida.sql
-- Plano 38: janela de horários reais do racha para a importação de clipes.
--inicio_real/fim_real são o horário REAL de início/término do jogo (BRT, mesmo dia
-- do data_jogo por construção na RPC); NULL = não informado (fallback: slot inteiro).

ALTER TABLE partidas
  ADD COLUMN inicio_real timestamptz,
  ADD COLUMN fim_real timestamptz;

-- Grava/limpa os horários reais. Recebe TIME (HH:MM) e combina com a data BRT do
-- data_jogo — mesmo dia garantido por construção. Padrão das RPCs admin (099):
-- SECURITY DEFINER + gate is_admin + EXECUTE amplo.
CREATE OR REPLACE FUNCTION salvar_horarios_reais_partida(
  p_admin_id   bigint,
  p_partida_id bigint,
  p_inicio     time,
  p_fim        time
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_data_brt date;
BEGIN
  -- 1) Gate is_admin (padrão 099:232-235)
  SELECT is_admin INTO v_is_admin FROM jogadores WHERE id = p_admin_id;
  IF v_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso restrito a administradores.';
  END IF;

  -- 2) Ambos preenchidos (salvar) ou ambos NULL (limpar)
  IF (p_inicio IS NULL) <> (p_fim IS NULL) THEN
    RAISE EXCEPTION 'Informe início e término juntos, ou limpe os dois.';
  END IF;

  -- 3) Partida existe? (mesmo SELECT resolve a data BRT do jogo)
  SELECT (data_jogo AT TIME ZONE 'America/Sao_Paulo')::date
    INTO v_data_brt
    FROM partidas
   WHERE id = p_partida_id;
  IF v_data_brt IS NULL THEN
    RAISE EXCEPTION 'Partida não encontrada.';
  END IF;

  -- 4) Grava ou limpa. date + time = timestamp sem fuso; o AT TIME ZONE interpreta
  --    como BRT e produz o timestamptz correto (Brasil sem DST, offset fixo -03).
  IF p_inicio IS NOT NULL THEN
    IF p_fim <= p_inicio THEN
      RAISE EXCEPTION 'O término precisa ser depois do início.';
    END IF;
    UPDATE partidas
       SET inicio_real = (v_data_brt + p_inicio) AT TIME ZONE 'America/Sao_Paulo',
           fim_real    = (v_data_brt + p_fim)    AT TIME ZONE 'America/Sao_Paulo'
     WHERE id = p_partida_id;
  ELSE
    UPDATE partidas
       SET inicio_real = NULL,
           fim_real    = NULL
     WHERE id = p_partida_id;
  END IF;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION salvar_horarios_reais_partida(bigint, bigint, time, time)
  TO anon, authenticated;

-- disparar_importacao_clipes: remove o input fixo horario='19:00' do dispatch.
-- A janela/slot passa a ser derivada da partida pela própria Action (Passo 5).
-- Cópia da 117 (timeout de coleta 2000 ms) com o payload sem 'horario'.
CREATE OR REPLACE FUNCTION disparar_importacao_clipes(
  p_admin_id bigint,
  p_data     date
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
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

  -- 3) PAT do Vault — leitura direta, padrão 099:242-245
  SELECT decrypted_secret INTO v_pat
    FROM vault.decrypted_secrets
   WHERE name = 'github_pat_clipes'
   LIMIT 1;

  IF v_pat IS NULL THEN
    INSERT INTO cron_execucoes (job_nome, sucesso, erro)
    VALUES ('disparar_importacao_clipes', false, 'Secret github_pat_clipes não encontrado no vault.');
    RAISE EXCEPTION 'Secret github_pat_clipes não configurado no vault.';
  END IF;

  -- 4) Chamada à GitHub API workflow_dispatch. Sem input 'horario': a Action deriva
  --    o slot da partida (horários reais > hora do data_jogo). Fix 117 mantido.
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
      'inputs', jsonb_build_object('data', to_char(p_data, 'YYYY-MM-DD'))
    ),
    2000  -- cabe no statement_timeout de 3s do anon (padrão 104:16-20; fix 117)
  );

  RETURN true;
END;
$$;

-- Padrão das RPCs admin (099:585): EXECUTE amplo + gate is_admin interno.
GRANT EXECUTE ON FUNCTION disparar_importacao_clipes(bigint, date) TO anon, authenticated;
