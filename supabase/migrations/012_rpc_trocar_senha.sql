-- 012_rpc_trocar_senha.sql
-- RPC `trocar_senha(p_jogador_id bigint, p_senha_atual text, p_senha_nova text)
--      RETURNS boolean`:
--   1. Busca o jogador por id. Se nao existir, retorna false.
--   2. Valida a senha atual: crypt(p_senha_atual, senha_hash) = senha_hash.
--      Se invalida, retorna false (nao atualiza nada).
--   3. Atualiza senha_hash = crypt(p_senha_nova, gen_salt('bf')). Retorna true.
--
-- !!! DECISAO DE RISCO ACEITA (NAO MITIGAR) !!!
-- p_jogador_id vem do client (o sistema nao tem sessao server-side). Combinado
-- com a senha default "123" de todo jogador recem-criado, um jogador tecnico
-- que saiba o ID de outro pode chamar trocar_senha(id_alheio, '123', 'qualquer')
-- ANTES que o dono troque a senha default, assumindo a conta. Isso e coerente
-- com a postura de seguranca relaxada da Regra 6 do PLANO.md ("um amigo tecnico,
-- indo fora da UI, conseguiria ver votos alheios ou votar como outro"). A
-- mitigacao adequada (sessao server-side / RLS) esta fora do escopo do MVP.
--
-- SECURITY DEFINER + search_path = public.

CREATE OR REPLACE FUNCTION trocar_senha(
  p_jogador_id   bigint,
  p_senha_atual  text,
  p_senha_nova   text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_senha_hash text;
BEGIN
  SELECT senha_hash INTO v_senha_hash
  FROM jogadores
  WHERE id = p_jogador_id;

  -- Jogador inexistente.
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Senha atual incorreta.
  IF crypt(p_senha_atual, v_senha_hash) <> v_senha_hash THEN
    RETURN false;
  END IF;

  UPDATE jogadores
  SET senha_hash = crypt(p_senha_nova, gen_salt('bf'))
  WHERE id = p_jogador_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION trocar_senha(bigint, text, text) TO anon, authenticated;
