-- 043_voting_reminders_buckets_fixos.sql
-- Volta ao modelo de 4 buckets fixos (6h/3h/1h/30m antes do fim da votação).
-- O cron volta a rodar a cada minuto para capturar as janelas com precisão.
--
-- Idempotente: remove o job de 15 min (migration 042) antes de recriar o de 1 min.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remapeia slots de 15 min (HH:MM) já entregues de volta para buckets fixos.
-- Como os slots HH:MM são mutuamente exclusivos dos buckets '6h/3h/1h/30m'
-- no CHECK atual, basta apagar o histórico pendente para liberar a PK.
-- Mantém o histórico enviado para auditoria.
DELETE FROM push_reminder_deliveries
WHERE sent_at IS NULL
  AND reminder_key ~ '^([01][0-9]|2[0-3]):(00|15|30|45)$';

-- Reagenda o cron para cada minuto (cobre janelas de 10 min por bucket).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobname = 'enviar-lembretes-votacao-15min'
  ) THEN
    PERFORM cron.unschedule('enviar-lembretes-votacao-15min');
  END IF;
END;
$$;

SELECT cron.schedule(
  'enviar-lembretes-votacao-1min',
  '* * * * *',
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
