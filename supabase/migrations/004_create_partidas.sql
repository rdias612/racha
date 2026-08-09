-- 004_create_partidas.sql
-- Cria a tabela `partidas`. Cada partida tem status draft -> published -> closed.
--   draft:     admin montando (ainda nao entrou no ranking nem na votacao).
--   published: votacao aberta + entra no ranking + editavel pelo admin.
--   closed:    travada; notas e craque revelados.
-- `voting_closes_at` e setado em publish (now() + 24h) e usado pelo pg_cron
-- (migration 015) e pelo bloqueio server-side em registrar_votos (014).
-- `criado_por` referencia o admin que criou a partida.

CREATE TABLE partidas (
  id                bigserial   PRIMARY KEY,
  data_jogo         timestamptz NOT NULL,
  status            text        NOT NULL DEFAULT 'draft'
                              CHECK (status IN ('draft','published','closed')),
  voting_closes_at  timestamptz,
  criado_por        bigint      NOT NULL REFERENCES jogadores(id),
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_partidas_status   ON partidas (status);
CREATE INDEX idx_partidas_data_jogo ON partidas (data_jogo DESC);
