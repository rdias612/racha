-- 060_cron_agendar_partida_semanal.sql
--
-- Toda segunda às 10:00 (Brasília): cria a partida semanal (RPC 059) e, se uma
-- partida nova foi criada, dispara o push de pedido de confirmação para os
-- mensalistas (Edge Function send-confirmation-requests).
--
-- BRT = UTC-3 fixo => 10:00 BRT == 13:00 UTC => "0 13 * * 1" (segunda).
-- O pg_cron do Supabase avalia o cron no fuso da sessão (UTC), por isso a hora
-- vai em UTC. Padrão de agendamento: unschedule-if-exists -> schedule (040/055).

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'agendar-partida-semanal') THEN
    PERFORM cron.unschedule('agendar-partida-semanal');
  END IF;
END;
$$;

SELECT cron.schedule(
  'agendar-partida-semanal',
  '0 13 * * 1',
  $semanal$
  DO $$
  DECLARE
    v_partida_id bigint;
    v_secret     text;
  BEGIN
    SELECT criar_partida_semanal_mensalistas() INTO v_partida_id;
    IF v_partida_id IS NOT NULL THEN
      SELECT decrypted_secret INTO v_secret
        FROM vault.decrypted_secrets
        WHERE name = 'push_cron_secret'
        LIMIT 1;
      PERFORM net.http_post(
        url := 'https://jtavmrlllyctkuxefhpc.supabase.co/functions/v1/send-confirmation-requests',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-push-cron-secret', v_secret
        ),
        body := jsonb_build_object('partida_id', v_partida_id)
      );
    END IF;
  END $$;
  $semanal$
);
