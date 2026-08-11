-- Web Push subscriptions and idempotent voting reminders.
-- The Edge Function owns delivery; this schema only stores browser endpoints
-- and the delivery ledger used to prevent duplicate reminders.

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id           bigserial PRIMARY KEY,
  jogador_id   bigint NOT NULL REFERENCES jogadores(id) ON DELETE CASCADE,
  endpoint     text NOT NULL UNIQUE,
  p256dh       text NOT NULL,
  auth         text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_jogador
  ON push_subscriptions (jogador_id);

CREATE TABLE IF NOT EXISTS push_reminder_deliveries (
  partida_id    bigint NOT NULL REFERENCES partidas(id) ON DELETE CASCADE,
  jogador_id    bigint NOT NULL REFERENCES jogadores(id) ON DELETE CASCADE,
  reminder_key  text NOT NULL CHECK (reminder_key IN ('6h', '3h', '1h', '30m')),
  claimed_at    timestamptz NOT NULL DEFAULT now(),
  sent_at       timestamptz,
  error_message text,
  PRIMARY KEY (partida_id, jogador_id, reminder_key)
);

CREATE INDEX IF NOT EXISTS idx_push_reminders_claimed
  ON push_reminder_deliveries (claimed_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON push_subscriptions
  TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE push_subscriptions_id_seq
  TO anon, authenticated;
REVOKE ALL ON push_reminder_deliveries FROM anon, authenticated;