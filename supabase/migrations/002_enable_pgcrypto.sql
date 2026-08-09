-- 002_enable_pgcrypto.sql
-- Habilita a extensao pgcrypto, necessaria para as funcoes crypt() e
-- gen_salt('bf') usadas no hash bcrypt de senhas (RPCs de login, criar_jogador
-- e trocar_senha). Idempotente.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
