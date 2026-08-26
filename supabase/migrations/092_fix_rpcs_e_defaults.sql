-- 092_fix_rpcs_e_defaults.sql
--
-- Correção de assinaturas RPC e defaults de parâmetros para compatibilidade total com PostgREST e aplicação:
-- 1. `registrar_divida`: adiciona defaults em todos os parâmetros opcionais (DEFAULT NULL / current_date / 'receita').
-- 2. `trocar_senha`: garante parâmetro canônico `p_senha_atual` (em conformidade com Perfil.tsx e 012).
-- 3. `admin_definir_confirmacao`: garante presença da RPC (em conformidade com 057 e partidas.ts).
-- 4. `descartar_votos`: garante assinatura `(p_partida_id, p_voter_id)` (em conformidade com 041 e partidas.ts).
-- 5. `registrar_evento`, `editar_evento`, `remover_evento`: garante assinaturas canônicas (em conformidade com 047/048 e partidas.ts).
-- 6. `obter_configuracoes_notificacoes`, `disparar_confirmacao_manual`, `disparar_push_teste`: garante presença das RPCs de notificação (077).

-- ----------------------------------------------------------------------------
-- 1. REGISTRAR DÍVIDA / LANÇAMENTO (Defaults em todos os opcionais)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION registrar_divida(
  p_jogador_id  bigint DEFAULT NULL,
  p_tipo        text DEFAULT NULL,
  p_valor       numeric DEFAULT NULL,
  p_data_divida date DEFAULT current_date,
  p_descricao   text DEFAULT NULL,
  p_referencia  text DEFAULT NULL,
  p_partida_id  bigint DEFAULT NULL,
  p_natureza    text DEFAULT 'receita'
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id       bigint;
  v_natureza text;
BEGIN
  IF p_valor IS NULL OR p_valor <= 0 THEN
    RAISE EXCEPTION 'Valor do lançamento deve ser maior que zero.';
  END IF;

  v_natureza := COALESCE(NULLIF(trim(p_natureza), ''), 'receita');
  IF v_natureza NOT IN ('receita', 'despesa') THEN
    RAISE EXCEPTION 'Natureza inválida. Use receita ou despesa.';
  END IF;

  IF p_tipo IS NULL OR p_tipo NOT IN ('mensalidade', 'avulso', 'outro', 'goleiro', 'campo', 'eventos') THEN
    RAISE EXCEPTION 'Tipo de lançamento inválido.';
  END IF;

  IF v_natureza = 'receita' AND p_jogador_id IS NULL THEN
    RAISE EXCEPTION 'Receita exige um jogador.';
  END IF;

  INSERT INTO dividas (
    jogador_id, tipo, valor, data_divida, descricao, referencia, partida_id, natureza
  )
  VALUES (
    p_jogador_id,
    p_tipo,
    p_valor,
    COALESCE(p_data_divida, current_date),
    NULLIF(trim(p_descricao), ''),
    NULLIF(trim(p_referencia), ''),
    p_partida_id,
    v_natureza
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION registrar_divida(bigint, text, numeric, date, text, text, bigint, text) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. TROCAR SENHA (Canônico: p_senha_atual)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trocar_senha(
  p_jogador_id   bigint,
  p_senha_atual  text,
  p_senha_nova   text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_senha_hash text;
BEGIN
  SELECT senha_hash INTO v_senha_hash FROM jogadores WHERE id = p_jogador_id AND is_ativo = true;
  IF v_senha_hash IS NULL THEN
    RETURN false;
  END IF;

  IF v_senha_hash <> p_senha_atual THEN
    RETURN false;
  END IF;

  UPDATE jogadores
  SET senha_hash = p_senha_nova
  WHERE id = p_jogador_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION trocar_senha(bigint, text, text) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. ADMIN DEFINIR CONFIRMAÇÃO
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION admin_definir_confirmacao(
  p_partida_id bigint,
  p_jogador_id bigint,
  p_status     text,
  p_admin_id   bigint
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status_partida text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM jogadores WHERE id = p_admin_id AND is_admin = true) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem alterar presenca alheia.';
  END IF;

  SELECT status INTO v_status_partida FROM partidas WHERE id = p_partida_id;
  IF v_status_partida IS NULL OR v_status_partida <> 'draft' THEN
    RETURN false;
  END IF;

  IF p_status NOT IN ('pendente', 'confirmado', 'recusado') THEN
    RETURN false;
  END IF;

  UPDATE partidas_participantes
  SET status_confirmacao = p_status,
      confirmado_em = CASE WHEN p_status = 'confirmado' THEN now() ELSE NULL END
  WHERE partida_id = p_partida_id
    AND jogador_id = p_jogador_id;

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_definir_confirmacao(bigint, bigint, text, bigint) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4. DESCARTAR VOTOS
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION descartar_votos(
  p_partida_id  bigint,
  p_voter_id    bigint
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status           text;
  v_voting_closes_at timestamptz;
BEGIN
  SELECT status, voting_closes_at
  INTO v_status, v_voting_closes_at
  FROM partidas
  WHERE id = p_partida_id;

  IF v_status IS NULL
     OR v_status <> 'published'
     OR v_voting_closes_at IS NULL
     OR v_voting_closes_at <= now() THEN
    RETURN false;
  END IF;

  DELETE FROM votes
  WHERE partida_id = p_partida_id
    AND voter_id = p_voter_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION descartar_votos(bigint, bigint) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 5. EVENTOS DA PARTIDA AO VIVO (REGISTRAR, EDITAR, REMOVER)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION registrar_evento(
  p_partida_id             bigint,
  p_tipo                   text,
  p_jogador_id             bigint,
  p_assistencia_jogador_id bigint DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status      text;
  v_time        char(1);
  v_time_assist char(1);
  v_evento_id   bigint;
  v_assist      bigint;
BEGIN
  SELECT status INTO v_status
  FROM partidas
  WHERE id = p_partida_id;

  IF v_status IS NULL OR v_status <> 'live' THEN
    RETURN NULL;
  END IF;

  IF p_tipo NOT IN ('gol', 'gol_contra') THEN
    RETURN NULL;
  END IF;

  SELECT time INTO v_time
  FROM partidas_participantes
  WHERE partida_id = p_partida_id
    AND jogador_id = p_jogador_id;

  IF v_time IS NULL THEN
    RETURN NULL;
  END IF;

  v_assist := p_assistencia_jogador_id;
  IF p_tipo = 'gol_contra' THEN
    v_assist := NULL;
  END IF;

  IF v_assist IS NOT NULL THEN
    IF v_assist = p_jogador_id THEN
      RETURN NULL;
    END IF;

    SELECT time INTO v_time_assist
    FROM partidas_participantes
    WHERE partida_id = p_partida_id
      AND jogador_id = v_assist;

    IF v_time_assist IS NULL OR v_time_assist <> v_time THEN
      RETURN NULL;
    END IF;
  END IF;

  INSERT INTO partida_eventos (
    partida_id, tipo, jogador_id, assistencia_jogador_id, time
  )
  VALUES (p_partida_id, p_tipo, p_jogador_id, v_assist, v_time)
  RETURNING id INTO v_evento_id;

  IF p_tipo = 'gol' THEN
    UPDATE partidas_participantes
    SET gols = gols + 1
    WHERE partida_id = p_partida_id AND jogador_id = p_jogador_id;

    IF v_assist IS NOT NULL THEN
      UPDATE partidas_participantes
      SET assistencias = assistencias + 1
      WHERE partida_id = p_partida_id AND jogador_id = v_assist;
    END IF;
  ELSIF p_tipo = 'gol_contra' THEN
    UPDATE partidas_participantes
    SET gols_contra = gols_contra + 1
    WHERE partida_id = p_partida_id AND jogador_id = p_jogador_id;
  END IF;

  RETURN v_evento_id;
END;
$$;

GRANT EXECUTE ON FUNCTION registrar_evento(bigint, text, bigint, bigint) TO anon, authenticated;

CREATE OR REPLACE FUNCTION editar_evento(
  p_evento_id              bigint,
  p_tipo                   text,
  p_jogador_id             bigint,
  p_assistencia_jogador_id bigint DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_evento partida_eventos%ROWTYPE;
  v_status text;
  v_time   char(1);
  v_assist bigint;
BEGIN
  SELECT * INTO v_evento FROM partida_eventos WHERE id = p_evento_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  SELECT status INTO v_status FROM partidas WHERE id = v_evento.partida_id;
  IF v_status IS NULL OR v_status <> 'live' THEN
    RETURN false;
  END IF;

  IF p_tipo NOT IN ('gol', 'gol_contra') THEN
    RETURN false;
  END IF;

  SELECT time INTO v_time
  FROM partidas_participantes
  WHERE partida_id = v_evento.partida_id AND jogador_id = p_jogador_id;

  IF v_time IS NULL THEN
    RETURN false;
  END IF;

  v_assist := p_assistencia_jogador_id;
  IF p_tipo = 'gol_contra' THEN
    v_assist := NULL;
  END IF;

  -- 1. Reverte contadores do evento antigo
  IF v_evento.tipo = 'gol' THEN
    UPDATE partidas_participantes
    SET gols = GREATEST(0, gols - 1)
    WHERE partida_id = v_evento.partida_id AND jogador_id = v_evento.jogador_id;

    IF v_evento.assistencia_jogador_id IS NOT NULL THEN
      UPDATE partidas_participantes
      SET assistencias = GREATEST(0, assistencias - 1)
      WHERE partida_id = v_evento.partida_id AND jogador_id = v_evento.assistencia_jogador_id;
    END IF;
  ELSIF v_evento.tipo = 'gol_contra' THEN
    UPDATE partidas_participantes
    SET gols_contra = GREATEST(0, gols_contra - 1)
    WHERE partida_id = v_evento.partida_id AND jogador_id = v_evento.jogador_id;
  END IF;

  -- 2. Aplica novos contadores
  IF p_tipo = 'gol' THEN
    UPDATE partidas_participantes
    SET gols = gols + 1
    WHERE partida_id = v_evento.partida_id AND jogador_id = p_jogador_id;

    IF v_assist IS NOT NULL THEN
      UPDATE partidas_participantes
      SET assistencias = assistencias + 1
      WHERE partida_id = v_evento.partida_id AND jogador_id = v_assist;
    END IF;
  ELSIF p_tipo = 'gol_contra' THEN
    UPDATE partidas_participantes
    SET gols_contra = gols_contra + 1
    WHERE partida_id = v_evento.partida_id AND jogador_id = p_jogador_id;
  END IF;

  UPDATE partida_eventos
  SET tipo                   = p_tipo,
      jogador_id             = p_jogador_id,
      assistencia_jogador_id = v_assist,
      time                   = v_time
  WHERE id = p_evento_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION editar_evento(bigint, text, bigint, bigint) TO anon, authenticated;

CREATE OR REPLACE FUNCTION remover_evento(p_evento_id bigint)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_evento partida_eventos%ROWTYPE;
  v_status text;
BEGIN
  SELECT * INTO v_evento FROM partida_eventos WHERE id = p_evento_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  SELECT status INTO v_status FROM partidas WHERE id = v_evento.partida_id;
  IF v_status IS NULL OR v_status <> 'live' THEN
    RETURN false;
  END IF;

  IF v_evento.tipo = 'gol' THEN
    UPDATE partidas_participantes
    SET gols = GREATEST(0, gols - 1)
    WHERE partida_id = v_evento.partida_id AND jogador_id = v_evento.jogador_id;

    IF v_evento.assistencia_jogador_id IS NOT NULL THEN
      UPDATE partidas_participantes
      SET assistencias = GREATEST(0, assistencias - 1)
      WHERE partida_id = v_evento.partida_id AND jogador_id = v_evento.assistencia_jogador_id;
    END IF;
  ELSIF v_evento.tipo = 'gol_contra' THEN
    UPDATE partidas_participantes
    SET gols_contra = GREATEST(0, gols_contra - 1)
    WHERE partida_id = v_evento.partida_id AND jogador_id = v_evento.jogador_id;
  END IF;

  DELETE FROM partida_eventos WHERE id = p_evento_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION remover_evento(bigint) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 6. CONFIGURAÇÕES DE NOTIFICAÇÃO E TESTES
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION obter_configuracoes_notificacoes(p_admin_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_res jsonb;
BEGIN
  SELECT is_admin INTO v_is_admin FROM jogadores WHERE id = p_admin_id;
  IF v_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso restrito a administradores.';
  END IF;

  SELECT to_jsonb(c) INTO v_res FROM notificacoes_config c WHERE c.id = 1;
  RETURN v_res;
END;
$$;

GRANT EXECUTE ON FUNCTION obter_configuracoes_notificacoes(bigint) TO anon, authenticated;

CREATE OR REPLACE FUNCTION disparar_confirmacao_manual(
  p_admin_id   bigint,
  p_partida_id bigint
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin   boolean;
  v_status     text;
  v_secret     text;
BEGIN
  SELECT is_admin INTO v_is_admin FROM jogadores WHERE id = p_admin_id;
  IF v_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso restrito a administradores.';
  END IF;

  SELECT status INTO v_status FROM partidas WHERE id = p_partida_id;
  IF v_status IS NULL OR v_status <> 'draft' THEN
    RAISE EXCEPTION 'Partida inválida ou não está em rascunho (draft).';
  END IF;

  SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets
    WHERE name = 'push_cron_secret'
    LIMIT 1;

  IF v_secret IS NOT NULL THEN
    PERFORM net.http_post(
      url := 'https://jtavmrlllyctkuxefhpc.supabase.co/functions/v1/send-confirmation-requests',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-push-cron-secret', v_secret
      ),
      body := jsonb_build_object('partida_id', p_partida_id, 'reenviar', true)
    );
  END IF;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION disparar_confirmacao_manual(bigint, bigint) TO anon, authenticated;

CREATE OR REPLACE FUNCTION disparar_push_teste(
  p_admin_id bigint
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_secret   text;
BEGIN
  SELECT is_admin INTO v_is_admin FROM jogadores WHERE id = p_admin_id;
  IF v_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso restrito a administradores.';
  END IF;

  SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets
    WHERE name = 'push_cron_secret'
    LIMIT 1;

  IF v_secret IS NOT NULL THEN
    PERFORM net.http_post(
      url := 'https://jtavmrlllyctkuxefhpc.supabase.co/functions/v1/send-test-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-push-cron-secret', v_secret
      ),
      body := jsonb_build_object('jogador_id', p_admin_id)
    );
  END IF;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION disparar_push_teste(bigint) TO anon, authenticated;
