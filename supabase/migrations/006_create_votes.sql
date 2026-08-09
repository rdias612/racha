-- 006_create_votes.sql
-- Cria a tabela `votes`. Cada voto: um votante (voter_id) da uma nota 0..10
-- a um alvo (target_id) numa partida.
--   UNIQUE (partida_id, voter_id, target_id): votante da no maximo 1 nota por alvo
--     por partida (permite UPSERT p/ editar voto dentro da janela de 24h).
--   CHECK (voter_id <> target_id): ninguem vota em si (bloqueio DB-side; a UI
--     tambem esconde o proprio jogador na tela de votacao).
-- Anonimato e propriedade da UX (a UI so expoe proprios votos + medias), nao
-- do servidor. Esta view `partida_notas` (008) e a unica fonte de notas/craque.
--
-- Observacao: `voter_id` NAO aparece em nenhuma view derivada (placar, notas,
-- ranking, stats) - apenas aqui, para o dono do voto consultar os seus.

CREATE TABLE votes (
  id          bigserial   PRIMARY KEY,
  partida_id  bigint      NOT NULL REFERENCES partidas(id) ON DELETE CASCADE,
  voter_id    bigint      NOT NULL REFERENCES jogadores(id),
  target_id   bigint      NOT NULL REFERENCES jogadores(id),
  rating      smallint    NOT NULL CHECK (rating BETWEEN 0 AND 10),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (partida_id, voter_id, target_id),
  CHECK (voter_id <> target_id)
);

CREATE INDEX idx_votes_partida_target
  ON votes (partida_id, target_id);
