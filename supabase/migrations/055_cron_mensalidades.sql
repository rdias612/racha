-- 055_cron_mensalidades.sql
-- Todo dia 01 às 10:00 (Brasília) gera a mensalidade de R$90 para cada mensalista
-- ativo, com referencia = mês corrente (BRT).
--
-- BRT = UTC-3 fixo (DST abolido em 2019) => 10:00 BRT == 13:00 UTC => "0 13 1 * *".
-- O pg_cron do Supabase avalia o cron no fuso da sessão (UTC por padrão), por isso
-- usamos a hora em UTC. referencia/data_divida são calculados em BRT via
-- now() AT TIME ZONE 'America/Sao_Paulo' (mesmo padrão das migrations 028/031/049).
--
-- Idempotente: ON CONFLICT DO NOTHING + uq_dividas_mensalidade_mes (não duplica).
-- Padrão de agendamento: unschedule-if-exists -> schedule (igual à migration 040).

CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'gerar-mensalidades-mensal') THEN
    PERFORM cron.unschedule('gerar-mensalidades-mensal');
  END IF;
END;
$$;

SELECT cron.schedule(
  'gerar-mensalidades-mensal',
  '0 13 1 * *',
  $$
  INSERT INTO dividas (jogador_id, tipo, valor, referencia, data_divida, descricao)
  SELECT
    j.id,
    'mensalidade',
    90.00,
    to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM'),
    (now() AT TIME ZONE 'America/Sao_Paulo')::date,
    'Mensalidade ' || to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'MM/YYYY')
  FROM jogadores j
  WHERE j.is_mensalista = true AND j.is_ativo = true
  ON CONFLICT DO NOTHING;
  $$
);
