-- 042_voting_reminders_15min.sql
-- Lembretes de votação a cada 15 min durante toda a janela de votação (24h).
--
-- ALTERAÇÕES vs 040/036:
--   1. `push_reminder_deliveries.reminder_key` agora aceita slots de 15 min no
--      formato 'HH:MM' (00:00 .. 23:45), em vez dos antigos 4 buckets fixos.
--   2. Cron reagendado de '* * * * *' para '0,15,30,45 * * * *'.
--   3. Histórico antigo removido para evitar conflito de claim com slots novos.
--
-- Idempotente: remove o job anterior antes de recriar.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 1) Relaxa o CHECK de reminder_key: agora aceita tanto os 4 buckets antigos
--    ('6h','3h','1h','30m') quanto slots de 15 min no formato 'HH:MM'.
ALTER TABLE push_reminder_deliveries
  DROP CONSTRAINT IF EXISTS push_reminder_deliveries_reminder_key_check;

ALTER TABLE push_reminder_deliveries
  ADD CONSTRAINT push_reminder_deliveries_reminder_key_check
  CHECK (
    reminder_key IN ('6h','3h','1h','30m')
    OR reminder_key ~ '^([01][0-9]|2[0-3]):(00|15|30|45)$'
  );

-- 2) Limpa entregas pendentes do modelo antigo para não atrapalhar o claim.
--    Mantém o histórico enviado para auditoria.
DELETE FROM push_reminder_deliveries WHERE sent_at IS NULL;

-- 3) Reagenda o cron para minutos 0, 15, 30 e 45 de toda hora.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobname = 'enviar-lembretes-votacao-1min'
  ) THEN
    PERFORM cron.unschedule('enviar-lembretes-votacao-1min');
  END IF;
END;
$$;

SELECT cron.schedule(
  'enviar-lembretes-votacao-15min',
  '0,15,30,45 * * * *',
  $push_job$
  SELECT net.http_post(
    url := 'https://jtavmrlllyctkuxefhpc.supabase.co/functions/v1/send-voting-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-cron-secret', (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'push_cron_secret'
      )
    ),
    body := '{}'::jsonb
  );
  $push_job$
);
