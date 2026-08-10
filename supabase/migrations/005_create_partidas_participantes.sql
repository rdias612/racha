-- 005_create_partidas_participantes.sql
-- Cria a tabela `partidas_participantes` (uma linha por jogador em cada partida;
-- tipicamente 16 linhas/partida: 8 no time 'a' e 8 no 'b').
-- Gols e assistencias sao CONTADORES por participante (ints), NAO eventos:
--   placar da partida = SUM(gols) por time; resultado = comparacao dos placares.
-- Times fixos: 'a' = Preto, 'b' = Branco.
-- ON DELETE CASCADE em partida_id: se a partida for apagada, os participantes somem.
-- PK composta (partida_id, jogador_id): um jogador so participa uma vez por partida.

CREATE TABLE partidas_participantes (
  partida_id    bigint  NOT NULL REFERENCES partidas(id) ON DELETE CASCADE,
  jogador_id    bigint  NOT NULL REFERENCES jogadores(id),
  time          char(1) NOT NULL CHECK (time IN ('a','b')),
  posicao       text    NOT NULL CHECK (posicao IN ('gk','def','mid','fwd')),
  gols          integer NOT NULL DEFAULT 0 CHECK (gols >= 0),
  assistencias  integer NOT NULL DEFAULT 0 CHECK (assistencias >= 0),
  gols_contra   integer NOT NULL DEFAULT 0 CHECK (gols_contra >= 0),
  PRIMARY KEY (partida_id, jogador_id)
);

CREATE INDEX idx_partidas_participantes_jogador_id
  ON partidas_participantes (jogador_id);
