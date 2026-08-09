-- Padroniza os valores persistidos das posições.

UPDATE jogadores
SET posicao = CASE posicao
  WHEN 'gk' THEN 'goleiro'
  WHEN 'def' THEN 'zagueiro'
  WHEN 'lat' THEN 'lateral'
  WHEN 'mid' THEN 'meia'
  WHEN 'fwd' THEN 'atacante'
  ELSE posicao
END;

UPDATE partidas_participantes
SET posicao = CASE posicao
  WHEN 'gk' THEN 'goleiro'
  WHEN 'def' THEN 'zagueiro'
  WHEN 'lat' THEN 'lateral'
  WHEN 'mid' THEN 'meia'
  WHEN 'fwd' THEN 'atacante'
  ELSE posicao
END;

ALTER TABLE jogadores
  DROP CONSTRAINT jogadores_posicao_check,
  ADD CONSTRAINT jogadores_posicao_check
    CHECK (posicao in ('goleiro','zagueiro','lateral','meia','atacante'));

ALTER TABLE partidas_participantes
  DROP CONSTRAINT partidas_participantes_posicao_check,
  ADD CONSTRAINT partidas_participantes_posicao_check
    CHECK (posicao in ('goleiro','zagueiro','lateral','meia','atacante'));
