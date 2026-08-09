-- 019_add_posicao_lateral.sql
-- Adiciona a posição 'lat' (Lateral) ao CHECK das colunas `posicao` em
-- jogadores e partidas_participantes. Antes: gk/def/mid/fwd. Agora: gk/def/lat/mid/fwd.
-- Dados existentes são preservados (ALTER CONSTRAINT não toca nas linhas).

ALTER TABLE jogadores
  DROP CONSTRAINT jogadores_posicao_check,
  ADD CONSTRAINT jogadores_posicao_check
    CHECK (posicao in ('gk','def','lat','mid','fwd'));

ALTER TABLE partidas_participantes
  DROP CONSTRAINT partidas_participantes_posicao_check,
  ADD CONSTRAINT partidas_participantes_posicao_check
    CHECK (posicao in ('gk','def','lat','mid','fwd'));
