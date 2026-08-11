-- 038_add_posicao_b.sql
-- Adiciona a coluna `posicao_b` (posicao secundaria) a tabela `jogadores`.
--
-- Regras de negocio:
--   - Default 'meia' para jogadores de linha.
--   - NULL para goleiros primarios (nao jogam em outra posicao).
--   - Excecoes confirmadas pelo usuario:
--       * pedrinho (goleiro) -> posicao_b = 'meia'
--       * dudu -> primary alterada de 'meia' para 'goleiro'; posicao_b = 'meia'
--   - Valores permitidos: 'goleiro','zagueiro','lateral','meia','atacante'
--     (sem 'random').
--
-- Nao altera `partidas_participantes` (historico de partidas permanece como
-- registrado). A coluna nova herda os GRANTs SELECT/UPDATE existentes em
-- `jogadores` (migration 016).

-- 1) Promover dudu a goleiro primario (confirmado pelo usuario).
UPDATE jogadores
SET posicao = 'goleiro'
WHERE username = 'dudu';

-- 2) Adiciona a coluna, nullable, com CHECK e default.
ALTER TABLE jogadores
ADD COLUMN posicao_b text
DEFAULT 'meia'
CHECK (posicao_b IN ('goleiro','zagueiro','lateral','meia','atacante'));

-- 3) Backfill em ordem:
--    a) Todos os goleiros primarios viram NULL primeiro.
UPDATE jogadores
SET posicao_b = NULL
WHERE posicao = 'goleiro';

--    b) Nao-goleiros que ainda estao NULL -> default 'meia'.
--       (Redundante em relacao ao DEFAULT, mas deixa o valor visivel sem
--        depender de rewrite futuro da coluna.)
UPDATE jogadores
SET posicao_b = 'meia'
WHERE posicao_b IS NULL
  AND posicao <> 'goleiro';

--    c) Aplica os overrides por username (lista do usuario + excecoes).
UPDATE jogadores
SET posicao_b = CASE username
  WHEN 'dico'       THEN 'meia'
  WHEN 'natal'      THEN 'atacante'
  WHEN 'hees'       THEN 'meia'
  WHEN 'knust'      THEN 'lateral'
  WHEN 'tadeu'      THEN 'zagueiro'
  WHEN 'thiagao'    THEN 'lateral'
  WHEN 'cadinho'    THEN 'meia'
  WHEN 'gualberto'  THEN 'atacante'
  WHEN 'andret'     THEN 'meia'
  WHEN 'jp'         THEN 'meia'
  WHEN 'victor'     THEN 'lateral'
  WHEN 'vitor'      THEN 'atacante'
  WHEN 'tchuca'     THEN 'lateral'
  WHEN 'ed'         THEN 'zagueiro'
  WHEN 'fil'        THEN 'zagueiro'
  WHEN 'danilo'     THEN 'meia'
  WHEN 'hugo'       THEN 'zagueiro'
  WHEN 'marcelinho' THEN 'zagueiro'
  WHEN 'bill'       THEN 'lateral'
  WHEN 'gustavo'    THEN 'atacante'
  WHEN 'gian'       THEN 'lateral'
  WHEN 'azeita'     THEN 'atacante'
  WHEN 'guto'       THEN 'atacante'
  WHEN 'dudu'       THEN 'meia'
  WHEN 'pedrinho'   THEN 'meia'
  WHEN 'joel'       THEN 'zagueiro'
  WHEN 'cafuba'     THEN 'lateral'
END
WHERE username IN (
  'dico','natal','hees','knust','tadeu','thiagao','cadinho','gualberto',
  'andret','jp','victor','vitor','tchuca','ed','fil','danilo','hugo',
  'marcelinho','bill','gustavo','gian','azeita','guto','dudu','pedrinho',
  'joel','cafuba'
);
