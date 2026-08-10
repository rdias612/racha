-- 034_marcar_mensalistas.sql
-- Marca os jogadores com mensalidade ativa.

UPDATE public.jogadores
SET is_mensalista = true
WHERE username IN (
  'dico', 'natal', 'hees', 'tadeu', 'thiagao', 'ed',
  'jp', 'gualberto', 'danilo', 'fil', 'victor', 'hugo'
);
