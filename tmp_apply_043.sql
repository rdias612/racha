-- Aplicaçăo manual da 043 (contorna issue do schema_migrations duplicado).
DELETE FROM push_reminder_deliveries
WHERE sent_at IS NULL
  AND reminder_key ~ '^([01][0-9]|2[0-3]):(00|15|30|45)$';

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

-- Marca a migration 043 como aplicada no schema_migrations para alinhar o CLI.
INSERT INTO supabase_migrations.schema_migrations(version, name, statements)
VALUES (
  '043',
  'voting_reminders_buckets_fixos',
  ARRAY[]::text[]
)
ON CONFLICT (version) DO NOTHING;
