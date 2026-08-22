-- 069_restrict_jogadores_select.sql
--
-- Restringe a leitura da tabela `jogadores` para que `senha_hash` não seja
-- acessível publicamente pelos papéis `anon` e `authenticated`.
--
-- Garante acesso apenas às colunas públicas necessárias para o funcionamento
-- do client e das interfaces. A autenticação continua ocorrendo de forma
-- segura via RPC `fazer_login(username, senha)`.

REVOKE SELECT ON jogadores FROM anon, authenticated;

GRANT SELECT (
  id,
  username,
  nome,
  posicao,
  posicao_b,
  is_admin,
  is_ativo,
  is_mensalista,
  created_at
) ON jogadores TO anon, authenticated;
