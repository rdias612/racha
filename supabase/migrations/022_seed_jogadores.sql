-- 022_seed_jogadores.sql
-- Recria a lista inicial de jogadores. Todas as senhas sao exatamente "123".

TRUNCATE TABLE jogadores RESTART IDENTITY CASCADE;

INSERT INTO jogadores (username, senha_hash, nome, posicao, is_admin, is_ativo)
VALUES
  ('dico',       '123', 'dico',       'meia', true,  true),
  ('natal',      '123', 'natal',      'meia', true,  true),
  ('hees',       '123', 'hees',       'meia', true,  true),
  ('knust',      '123', 'knust',      'meia', true,  true),
  ('tadeu',      '123', 'tadeu',      'meia', true,  true),
  ('thiagao',    '123', 'thiagao',    'meia', false, true),
  ('cadinho',    '123', 'cadinho',    'meia', false, true),
  ('gualberto',  '123', 'gualberto',  'meia', false, true),
  ('andret',     '123', 'andret',     'meia', false, true),
  ('jp',         '123', 'jp',         'meia', false, true),
  ('vitor',      '123', 'vitor',      'meia', false, true),
  ('victor',     '123', 'victor',     'meia', false, true),
  ('tchuca',     '123', 'tchuca',     'meia', false, true),
  ('ed',         '123', 'ed',         'meia', false, true),
  ('fil',        '123', 'fil',        'meia', false, true),
  ('danilo',     '123', 'danilo',     'meia', false, true),
  ('hugo',       '123', 'hugo',       'meia', false, true),
  ('marcelinho', '123', 'marcelinho', 'meia', false, true),
  ('bill',       '123', 'bill',       'meia', false, true),
  ('gustavo',    '123', 'gustavo',    'meia', false, true),
  ('gian',       '123', 'gian',       'meia', false, true),
  ('azeita',     '123', 'azeita',     'meia', false, true),
  ('guto',       '123', 'guto',       'meia', false, true),
  ('dudu',       '123', 'dudu',       'meia', false, true),
  ('pedrinho',   '123', 'pedrinho',   'meia', false, true),
  ('joel',       '123', 'joel',       'meia', false, true),
  ('rod',        '123', 'rod',        'meia', false, true),
  ('cafuba',     '123', 'cafuba',     'meia', false, true),
  ('random1',    '123', 'random1',    'meia', false, true),
  ('random2',    '123', 'random2',    'meia', false, true),
  ('random3',    '123', 'random3',    'meia', false, true),
  ('random4',    '123', 'random4',    'meia', false, true),
  ('random5',    '123', 'random5',    'meia', false, true),
  ('random6',    '123', 'random6',    'meia', false, true);