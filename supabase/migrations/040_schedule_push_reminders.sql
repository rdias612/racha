-- Agenda o envio dos lembretes de votacao via Edge Function.
--
-- O job roda a cada minuto e chama a funcao com o segredo armazenado no Vault.
-- O segredo `push_cron_secret` precisa existir no Vault antes da primeira
-- execucao; ele nao e versionado nesta migration.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Permite aplicar esta migration mesmo quando o job foi criado manualmente
-- durante a configuracao inicial do projeto.
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