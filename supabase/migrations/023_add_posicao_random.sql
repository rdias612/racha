-- 023_add_posicao_random.sql
-- Permite a posicao especial dos jogadores random1 a random6.

ALTER TABLE jogadores
  DROP CONSTRAINT jogadores_posicao_check,
  ADD CONSTRAINT jogadores_posicao_check
    CHECK (posicao IN ('goleiro', 'zagueiro', 'lateral', 'meia', 'atacante', 'random'));

ALTER TABLE partidas_participantes
  DROP CONSTRAINT partidas_participantes_posicao_check,
  ADD CONSTRAINT partidas_participantes_posicao_check
    CHECK (posicao IN ('goleiro', 'zagueiro', 'lateral', 'meia', 'atacante', 'random'));

UPDATE jogadores
SET posicao = 'random'
WHERE username IN ('random1', 'random2', 'random3', 'random4', 'random5', 'random6');