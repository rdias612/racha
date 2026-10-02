-- 112_grant_delete_clipes.sql
-- RF09 (Fase 4): a limpeza deleta linhas de `clipes` com a service key da Action
-- (DELETE via PostgREST, filtro por partida_id). A Fase 1 concedeu só SELECT a
-- anon/authenticated e nada explícito de DML a service_role (fase-1-tasks.md:88-95).
-- Os default privileges da plataforma Supabase normalmente concedem ALL a
-- service_role em tabelas novas, mas o padrão do repo é de grants EXPLÍCITOS
-- (016:7-26; 099:582-587; 077:51-52) — o grant fica escrito aqui para não
-- depender de comportamento de plataforma. GRANT é idempotente.
GRANT DELETE ON clipes TO service_role;
