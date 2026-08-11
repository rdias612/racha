-- 059_rpc_criar_partida_semanal.sql
--
-- Cria automaticamente a partida semanal (quinta 19h BRT) já com todos os
-- mensalistas ativos pré-inscritos como 'pendente', e deadline de confirmação
-- na quarta 16h BRT. Idempotente: se já existe partida em draft nesta semana,
-- retorna NULL sem recriar. Acionada pela cron da migration 060.
--
-- BRT = UTC-3 fixo. date_trunc('week', ...) usa segunda como início (ISO).
-- Conversões via AT TIME ZONE 'America/Sao_Paulo' (padrão das migrations 028/049/055).

CREATE OR REPLACE FUNCTION criar_partida_semanal_mensalistas()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inicio_semana timestamp;   -- segunda 00:00 BRT (naive)
  v_data_jogo     timestamptz; -- quinta 19h BRT
  v_closes_at     timestamptz; -- quarta 16h BRT
  v_partida_id    bigint;
  v_admin_id      bigint;
  v_existe        boolean;
BEGIN
  v_inicio_semana := date_trunc('week', now() AT TIME ZONE 'America/Sao_Paulo');

  -- Quinta 19h e quarta 16h (Brasília) da mesma semana, como timestamptz.
  v_data_jogo := (v_inicio_semana + interval '3 days 19 hours') AT TIME ZONE 'America/Sao_Paulo';
  v_closes_at := (v_inicio_semana + interval '2 days 16 hours') AT TIME ZONE 'America/Sao_Paulo';

  -- Idempotência: partida em draft cujo data_jogo cai nesta semana.
  SELECT true INTO v_existe
    FROM partidas p
    WHERE p.status = 'draft'
      AND date_trunc('week', p.data_jogo AT TIME ZONE 'America/Sao_Paulo') = v_inicio_semana
    LIMIT 1;
  IF v_existe THEN
    RETURN NULL;
  END IF;

  -- criado_por é NOT NULL: usa o primeiro admin disponível.
  SELECT id INTO v_admin_id FROM jogadores WHERE is_admin ORDER BY id LIMIT 1;
  IF v_admin_id IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO partidas (data_jogo, status, criado_por, confirmacao_closes_at)
    VALUES (v_data_jogo, 'draft', v_admin_id, v_closes_at)
    RETURNING id INTO v_partida_id;

  -- Pré-inscreve os mensalistas ativos, com sua posição (todo mensalista tem
  -- posição), SEM time (admin atribui depois). status_confirmacao='pendente'.
  INSERT INTO partidas_participantes (partida_id, jogador_id, posicao, status_confirmacao)
    SELECT v_partida_id, j.id, j.posicao, 'pendente'
    FROM jogadores j
    WHERE j.is_mensalista = true AND j.is_ativo = true;

  RETURN v_partida_id;
END;
$$;

GRANT EXECUTE ON FUNCTION criar_partida_semanal_mensalistas() TO anon, authenticated;
