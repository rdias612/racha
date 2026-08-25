-- 075_rpc_alterar_username.sql
-- Permite que um jogador autenticado altere seu username de acesso/login.
-- Valida formato, tamanho, unicidade, prefixos reservados (random) e proteção de superadmins.

CREATE OR REPLACE FUNCTION alterar_username(
  p_jogador_id      bigint,
  p_novo_username   text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_jogador          jogadores%ROWTYPE;
  v_username_limpo   text;
BEGIN
  -- 1. Verifica existência e status do jogador
  SELECT * INTO v_jogador
  FROM jogadores
  WHERE id = p_jogador_id
  LIMIT 1;

  IF v_jogador.id IS NULL THEN
    RAISE EXCEPTION 'Atleta não encontrado.';
  END IF;

  IF NOT v_jogador.is_ativo THEN
    RAISE EXCEPTION 'Atleta inativo não pode alterar usuário de acesso.';
  END IF;

  -- 2. Normalização (trim + lowercase)
  v_username_limpo := LOWER(TRIM(p_novo_username));

  -- 3. Validação de obrigatoriedade e tamanho
  IF v_username_limpo IS NULL OR LENGTH(v_username_limpo) < 2 THEN
    RAISE EXCEPTION 'O usuário deve ter ao menos 2 caracteres.';
  END IF;

  IF LENGTH(v_username_limpo) > 30 THEN
    RAISE EXCEPTION 'O usuário deve ter no máximo 30 caracteres.';
  END IF;

  -- 4. Validação de formato (apenas letras, números, ponto, sublinhado e hífen)
  IF v_username_limpo !~ '^[a-z0-9._-]+$' THEN
    RAISE EXCEPTION 'O usuário só pode conter letras minúsculas, números, ponto, sublinhado e hífen (sem espaços).';
  END IF;

  -- 5. Validação de prefixo reservado (random)
  IF v_username_limpo ~ '^random\d*$' OR v_username_limpo ILIKE 'random%' THEN
    RAISE EXCEPTION 'O prefixo "random" é reservado para convidados temporários.';
  END IF;

  -- 6. Proteção de Superadmins (dico, tadeu, natal)
  IF v_username_limpo IN ('dico', 'tadeu', 'natal') AND v_jogador.username NOT IN ('dico', 'tadeu', 'natal') THEN
    RAISE EXCEPTION 'Este nome de usuário é reservado para a governança do racha.';
  END IF;

  IF v_jogador.username IN ('dico', 'tadeu', 'natal') THEN
    RAISE EXCEPTION 'Usuários Superadmin possuem identificador permanente por motivos de governança.';
  END IF;

  -- 7. Verifica se é igual ao atual
  IF v_username_limpo = v_jogador.username THEN
    RAISE EXCEPTION 'O novo usuário informado é igual ao atual.';
  END IF;

  -- 8. Validação de unicidade
  IF EXISTS (SELECT 1 FROM jogadores WHERE username = v_username_limpo AND id <> p_jogador_id) THEN
    RAISE EXCEPTION 'Este usuário "@%" já está sendo utilizado por outro atleta.', v_username_limpo;
  END IF;

  -- 9. Executa a alteração
  UPDATE jogadores
  SET username = v_username_limpo
  WHERE id = p_jogador_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION alterar_username(bigint, text) TO anon, authenticated;
