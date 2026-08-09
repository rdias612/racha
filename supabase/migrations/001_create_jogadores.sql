-- 001_create_jogadores.sql
-- Cria a tabela `jogadores`, base do esquema do Racha.
-- PK/FKs sao bigint (sequence) - ZERO UUID (Regra do PLANO.md, secao 2).
-- Senhas sao guardadas como hash bcrypt em `senha_hash` (gerado via pgcrypto
-- nas RPCs de criar_jogador / trocar_senha). Senha default de todo jogador
-- recem-criado e "123" ate ser trocada na tela de Perfil.
-- Sem RLS, sem triggers, sem policies (seguranca so no app).

CREATE TABLE jogadores (
  id          bigserial   PRIMARY KEY,
  username    text        NOT NULL UNIQUE,
  senha_hash  text        NOT NULL,
  nome        text        NOT NULL,
  posicao     text        NOT NULL CHECK (posicao IN ('gk','def','mid','fwd')),
  is_admin    boolean     NOT NULL DEFAULT false,
  is_ativo    boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);
