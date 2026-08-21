-- 065_rpc_resetar_senha.sql
-- RPC `resetar_senha(p_jogador_id bigint) RETURNS boolean`:
--   1. Redefine senha_hash do jogador para a senha padrao '123' (a mesma
--      usada por criar_jogador). Retorna true se o jogador existia,
--      false caso contrario.
--
-- Uso: tela de Gestao de Jogadores (admin) — botão "Resetar senha".
-- O jogador troca a senha depois no Perfil, via trocar_senha.
--
-- Mesma postura de seguranca relaxada de trocar_senha/criar_jogador
-- (Regra 6 do PLANO.md): sem sessao server-side. O bloqueio de reset
-- para superadmins e aplicado no front (lib/jogadores.ts).
--
-- SECURITY DEFINER + search_path = public.

CREATE OR REPLACE FUNCTION resetar_senha(p_jogador_id bigint)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE jogadores
  SET senha_hash = '123'
  WHERE id = p_jogador_id;

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION resetar_senha(bigint) TO anon, authenticated;
