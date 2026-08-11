-- 057_confirmacoes_presenca.sql
--
-- Confirmação de presença dos mensalistas para a partida automática semanal.
--
-- Modelo:
--   * partidas_participantes ganha status_confirmacao ∈ ('pendente','confirmado','recusado')
--     e confirmado_em. O elenco e a confirmação são a mesma entidade (como hoje).
--   * partidas ganha confirmacao_closes_at (quarta 16h BR da semana): a partir
--     daí as reservas dos 'pendente' são liberadas — avulsos do admin e
--     mensalistas atrasados disputam as vagas restantes (first-come-first-served).
--   * time vira nullable: a criação automática pré-inscreve os mensalistas SEM
--     time (o admin monta os times depois). posicao continua NOT NULL porque
--     TODO mensalista tem posição — ela é copiada de jogadores.posicao.
--
-- Regra única de capacidade (16):
--   ocupa(p) = (status='confirmado') OR (status='pendente' AND now() < closes_at)
--   Uma transição para o estado `alvo` é permitida sse
--     vagas_ocupadas_pelos_DEMAIS + (1 se ocupa(alvo) senão 0) <= 16.
--   => sair (recusar / desconfirmar pós-prazo) sempre libera; confirmar/reaver
--      vaga respeita o limite de 16.
--
-- Obs.: relaxa também o CHECK de push_reminder_deliveries.reminder_key para
-- permitir o tipo 'confirmacao' (reuso do ledger de idempotência do push).

-- 1) `time` nullable (posicao segue NOT NULL — copiada de jogadores.posicao).
ALTER TABLE partidas_participantes
  ALTER COLUMN time DROP NOT NULL;

-- 2) Confirmação de presença por participante + prazo na partida.
ALTER TABLE partidas_participantes
  ADD COLUMN status_confirmacao text NOT NULL DEFAULT 'pendente'
    CHECK (status_confirmacao IN ('pendente','confirmado','recusado')),
  ADD COLUMN confirmado_em timestamptz;

ALTER TABLE partidas
  ADD COLUMN confirmacao_closes_at timestamptz;

-- 3) Relaxa o CHECK de reminder_key para permitir 'confirmacao'
--    (além dos buckets 6h/3h/1h/30m e slots HH:MM da migration 045).
ALTER TABLE push_reminder_deliveries
  DROP CONSTRAINT IF EXISTS push_reminder_deliveries_reminder_key_check;
ALTER TABLE push_reminder_deliveries
  ADD CONSTRAINT push_reminder_deliveries_reminder_key_check
  CHECK (
    reminder_key IN ('6h','3h','1h','30m','confirmacao')
    OR reminder_key ~ '^([01][0-9]|2[0-3]):(00|15|30|45)$'
  );

-- 4) RPC: o próprio jogador confirma/desconfirma/recusa a própria presença.
--    p_status ∈ ('pendente','confirmado','recusado'). Aplica a regra de capacidade.
--    Só opera em partidas em 'draft'. (Modelo de confiança atual: jogador_id vem
--    do client; o gate de "é o próprio jogador" é no client.)
CREATE OR REPLACE FUNCTION confirmar_presenca(
  p_partida_id bigint,
  p_jogador_id bigint,
  p_status     text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status_partida text;
  v_closes_at      timestamptz;
  v_atual          text;
  v_ocupadas       bigint;
  v_alvo_ocupa     boolean;
BEGIN
  IF p_status NOT IN ('pendente','confirmado','recusado') THEN
    RETURN false;
  END IF;

  SELECT p.status, p.confirmacao_closes_at
    INTO v_status_partida, v_closes_at
    FROM partidas p
    WHERE p.id = p_partida_id;
  IF v_status_partida IS NULL OR v_status_partida <> 'draft' THEN
    RETURN false;
  END IF;

  SELECT pp.status_confirmacao INTO v_atual
    FROM partidas_participantes pp
    WHERE pp.partida_id = p_partida_id AND pp.jogador_id = p_jogador_id;
  IF NOT FOUND THEN
    RETURN false;  -- não convidado para esta partida
  END IF;

  -- vagas ocupadas pelos DEMAIS jogadores (regra de capacidade).
  SELECT count(*) INTO v_ocupadas
    FROM partidas_participantes pp
    WHERE pp.partida_id = p_partida_id
      AND pp.jogador_id <> p_jogador_id
      AND (
        pp.status_confirmacao = 'confirmado'
        OR (pp.status_confirmacao = 'pendente' AND now() < COALESCE(v_closes_at, now()))
      );

  -- estado-alvo ocupa vaga?
  v_alvo_ocupa := (p_status = 'confirmado')
               OR (p_status = 'pendente' AND now() < COALESCE(v_closes_at, now()));

  IF v_alvo_ocupa AND v_ocupadas >= 16 THEN
    RETURN false;  -- vagas esgotadas
  END IF;

  UPDATE partidas_participantes
    SET status_confirmacao = p_status,
        confirmado_em = CASE WHEN p_status = 'confirmado' THEN now() ELSE NULL END
    WHERE partida_id = p_partida_id AND jogador_id = p_jogador_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION confirmar_presenca(bigint, bigint, text) TO anon, authenticated;

-- 5) RPC: admin altera o status de QUALQUER jogador (confirmar/desconfirmar/
--    recusar), inclusive o criador da partida. Mesma regra de capacidade.
--    Valida is_admin server-side (fortalece o gate que hoje é só client-side).
CREATE OR REPLACE FUNCTION admin_definir_confirmacao(
  p_partida_id bigint,
  p_jogador_id bigint,
  p_status     text,
  p_admin_id   bigint
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM jogadores WHERE id = p_admin_id AND is_admin) THEN
    RETURN false;
  END IF;
  RETURN confirmar_presenca(p_partida_id, p_jogador_id, p_status);
END;
$$;

GRANT EXECUTE ON FUNCTION admin_definir_confirmacao(bigint, bigint, text, bigint) TO anon, authenticated;

-- 6) RPC: admin adiciona um avulso (típicamente após o prazo, para preencher
--    vagas liberadas). Insere como 'confirmado', SEM time (admin atribui depois),
--    com posicao copiada de jogadores. Só se houver vaga livre (< 16 ocupadas).
CREATE OR REPLACE FUNCTION adicionar_participante(
  p_partida_id bigint,
  p_jogador_id bigint
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status_partida text;
  v_closes_at      timestamptz;
  v_ocupadas       bigint;
  v_existe         boolean;
BEGIN
  SELECT p.status, p.confirmacao_closes_at
    INTO v_status_partida, v_closes_at
    FROM partidas p
    WHERE p.id = p_partida_id;
  IF v_status_partida IS NULL OR v_status_partida <> 'draft' THEN
    RETURN false;
  END IF;

  SELECT true INTO v_existe
    FROM partidas_participantes pp
    WHERE pp.partida_id = p_partida_id AND pp.jogador_id = p_jogador_id;
  IF v_existe THEN
    RETURN false;  -- já é participante
  END IF;

  SELECT count(*) INTO v_ocupadas
    FROM partidas_participantes pp
    WHERE pp.partida_id = p_partida_id
      AND (
        pp.status_confirmacao = 'confirmado'
        OR (pp.status_confirmacao = 'pendente' AND now() < COALESCE(v_closes_at, now()))
      );
  IF v_ocupadas >= 16 THEN
    RETURN false;  -- sem vagas
  END IF;

  INSERT INTO partidas_participantes (partida_id, jogador_id, posicao, status_confirmacao)
    SELECT p_partida_id, j.id, j.posicao, 'confirmado'
    FROM jogadores j
    WHERE j.id = p_jogador_id;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION adicionar_participante(bigint, bigint) TO anon, authenticated;
