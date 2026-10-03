-- 118_grant_select_insert_clipes.sql
-- Correção do plano 37: a 109 concedeu SELECT em clipes a anon/authenticated e só a
-- sequence ao service_role; a 112 completou apenas DELETE. Sem SELECT/INSERT, a
-- GitHub Action (service key) falha com 42501 na primeira query (caminhosExistentes)
-- e o notificar-clipes falha no count do título do push. UPDATE não é concedido: a
-- Action nunca atualiza linhas de clipes (ler/gravar/deletar apenas). Padrão de
-- grants explícitos: 016, 099:582-587, 109:48-55, 112:9. GRANT é idempotente.
GRANT SELECT, INSERT ON clipes TO service_role;
