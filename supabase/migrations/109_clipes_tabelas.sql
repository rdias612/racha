-- 109_clipes_tabelas.sql
-- Fundação da feature Clipes do Filma Eu (docs/requisito-clipes-filmaeu.md §6):
-- 1. Tabela `clipes` (grade de vídeos por partida; denormalizações p/ limpeza RF09 — P12).
-- 2. Tabela `clipes_importacoes` (ledger de execuções — padrão cron_execucoes, 099:18-29).
-- 3. Grants no padrão canônico (016 / 036:34 / 077:51-52 / 099:582-587). SEM RLS.

-- 1. Tabela clipes -------------------------------------------------------
CREATE TABLE IF NOT EXISTS clipes (
  id          bigserial   PRIMARY KEY,
  partida_id  bigint      NOT NULL REFERENCES partidas(id) ON DELETE CASCADE,
  caminho     text        NOT NULL CHECK (char_length(caminho) <= 512),
  data_jogo   timestamptz NOT NULL,           -- denormalizada de partidas.data_jogo (ordenação da limpeza RF09)
  size_bytes  bigint      CHECK (size_bytes IS NULL OR size_bytes >= 0),  -- P12: capturado no upload
  ordem       integer,                        -- ordem/horário do clipe dentro do slot
  criado_em   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clipes_partida_caminho_unicos UNIQUE (partida_id, caminho)
);

CREATE INDEX IF NOT EXISTS idx_clipes_partida
  ON clipes (partida_id, ordem);
CREATE INDEX IF NOT EXISTS idx_clipes_data_jogo
  ON clipes (data_jogo);

-- 2. Ledger de importações ----------------------------------------------
CREATE TABLE IF NOT EXISTS clipes_importacoes (
  id                bigserial   PRIMARY KEY,
  partida_id        bigint      REFERENCES partidas(id) ON DELETE SET NULL,  -- nulo se a partida não for achada
  data_referencia   date        NOT NULL,     -- dia alvo da importação (slot 19:00 Society Gragoatá)
  origem            text        NOT NULL CHECK (origem IN ('automatico','manual')),
  status            text        NOT NULL CHECK (status IN ('iniciado','concluido','sem_clipes','falha','limpeza')),
  sucesso           boolean     NOT NULL DEFAULT false,
  quantidade_clipes integer,
  bytes_total       bigint      CHECK (bytes_total IS NULL OR bytes_total >= 0),
  detalhe           text,
  erro              text,
  criado_em         timestamptz NOT NULL DEFAULT now(),
  atualizado_em     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clipes_importacoes_data
  ON clipes_importacoes (data_referencia DESC, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_clipes_importacoes_status
  ON clipes_importacoes (status, criado_em DESC);

-- 3. Grants (SEM RLS; escrita só service_role) ---------------------------
-- clipes: leitura para o app (jogadores logados/anon); escrita NUNCA pelo client
-- (a Action usa service key; o que existir aqui é inserido só por ela).
GRANT SELECT ON clipes TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE clipes_id_seq TO service_role;

-- clipes_importacoes: painel admin lê via RPC (Fase 6, padrão obter_execucoes_cron 099:172-211);
-- client não lê nem escreve (padrão 077:51-52); Action (service key) insere/atualiza.
REVOKE ALL ON clipes_importacoes FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON clipes_importacoes TO service_role;
GRANT USAGE, SELECT ON SEQUENCE clipes_importacoes_id_seq TO service_role;
