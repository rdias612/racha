-- 016_grants_baseline.sql
-- Concede acesso base ao schema public e às tabelas/views para os roles
-- anon e authenticated. SEM RLS, SEM policies — apenas grants de SQL padrão.
-- Isso é o mínimo necessário para a API REST (PostgREST) conseguir ler/escrever.

-- Acesso ao schema (sem isso, PostgREST nem enxerga os objetos)
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Tabelas: leitura completa para anon e authenticated
GRANT SELECT ON jogadores, partidas, partidas_participantes, votes TO anon, authenticated;

-- Tabelas que o app escreve diretamente (sem RPC):
--   - jogadores: só leitura pelo app (escrita via RPC criar_jogador/trocar_senha)
--   - partidas: leitura pelo app; escrita via UPDATE direto (publicar/editar) só admin (no app)
--   - partidas_participantes: leitura pelo app; escrita só admin (no app)
--   - votes: escrita só via RPC registrar_votos; permitimos INSERT/UPDATE/DELETE
--            diretos também porque a regra 6 confia no client.
GRANT INSERT, UPDATE, DELETE ON partidas, partidas_participantes, votes TO anon, authenticated;
GRANT UPDATE ON jogadores TO anon, authenticated; -- trocar_senha usa SECURITY DEFINER, mas mantemos por consistência

-- Views: leitura para todos (são read-only por natureza)
GRANT SELECT ON partida_placar, partida_notas, ranking, stats_jogador TO anon, authenticated;

-- Sequences: necessárias para INSERT em tabelas com bigserial quando feito
-- diretamente pelo app (não via RPC SECURITY DEFINER).
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
