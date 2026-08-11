-- Permissoes da Edge Function de lembretes e suporte a chamadas HTTP via cron.
-- O segredo do cron permanece no Vault e nao e versionado.

CREATE EXTENSION IF NOT EXISTS pg_net;

GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT ON public.partidas,
  public.partidas_participantes,
  public.jogadores,
  public.votes,
  public.push_subscriptions,
  public.push_reminder_deliveries
  TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.push_subscriptions,
  public.push_reminder_deliveries
  TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.push_subscriptions_id_seq
  TO service_role;