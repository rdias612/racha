-- 084_grant_select_pix_telefone_jogadores.sql
--
-- Concede permissão de SELECT nas novas colunas chave_pix e telefone
-- da tabela jogadores para as roles anon e authenticated,
-- mantendo a coluna senha_hash protegida (migration 069 / 076).

GRANT SELECT (
  chave_pix,
  telefone
) ON jogadores TO anon, authenticated;
