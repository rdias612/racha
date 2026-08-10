-- 033_add_is_mensalista.sql
-- Identifica jogadores mensalistas, que tem vaga garantida quando participam.
-- Jogadores existentes permanecem como avulsos por padrao.

ALTER TABLE public.jogadores
  ADD COLUMN is_mensalista boolean NOT NULL DEFAULT false;
