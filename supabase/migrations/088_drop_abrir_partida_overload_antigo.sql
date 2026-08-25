-- 088_drop_abrir_partida_overload_antigo.sql
-- Remove o overload antigo de abrir_partida(bigint) sem gate de admin.
-- A assinatura canônica e segura é abrir_partida(p_partida_id bigint, p_admin_id bigint) (migration 083).

DROP FUNCTION IF EXISTS public.abrir_partida(bigint);
