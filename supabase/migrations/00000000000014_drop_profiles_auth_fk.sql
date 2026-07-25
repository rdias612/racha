-- =====================================================================
-- Migration: 00000000000014_drop_profiles_auth_fk.sql
-- Task: T7.2 - Relax FK profiles.id -> auth.users(id) p/ permitir
--              goleiro_pago sem auth entry.
-- Stack: PostgreSQL 15 / Supabase
--
-- Motivacao:
--   - auth.users exige login OAuth. Goleiro_pago NAO faz login no app;
--     e cadastrado pelo admin UI (T7.2) com UUID arbitrario.
--   - RLS profiles_insert_policy (00000000000007_rls.sql:57-82) JA permite
--     admin INSERT qualquer UUID. O unico blocker era a FK para auth.users.
--   - Comentario explicito em 00000000000007_rls.sql:80-82 confirma que
--     "admin cria goleiro_pago" e design intencional.
--
-- Trade-off aceito (MVP):
--   - Perde ON DELETE CASCADE: auth.users deletado nao propaga para profiles.
--   - Mitigacao: OAuth users raramente sao removidos; admin pode DELETE
--     profile diretamente (RLS delete_policy permite). Para producao,
--     considerar soft-delete com trigger.
--
-- Compatibilidade:
--   - Trigger handle_new_user (00000000000004_trigger.sql:35-41) ainda
--     funciona para signup OAuth: cadastra profiles com id=NEW.id onde
--     NEW.id corresponde a auth.users.id valido. Sem FK, o INSERT so sera
--     bem-sucedido (RLS: id = auth.uid() autoriza).
--   - service_role bypass documentado (nao usado no APK).
-- =====================================================================

alter table public.profiles
  drop constraint if exists profiles_id_fkey;

comment on table public.profiles is
  'Perfis de usuarios. id NAO referencia mais auth.users (T7.2): goleiro_pago pode ser cadastrado pelo admin sem auth entry. OAuth signups ainda funcionam via trigger handle_new_user.';
