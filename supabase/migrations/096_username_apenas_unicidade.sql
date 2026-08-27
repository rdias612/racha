-- 096_username_apenas_unicidade.sql
-- Simplifica a proteção de usernames: a única regra de identidade é a
-- UNICIDADE case-insensitive (nenhum atleta pode assumir o username de outro).
--
-- Motivo: os superadmins agora são identificados pelo ID (migration 095 e
-- SUPERADMIN_IDS no frontend), então a lista hardcoded 'dico'/'tadeu'/'natal'
-- como "reservados" não é mais necessária e bloqueava indevidamente os
-- próprios superadmins de ajustarem a caixa do nome (ex.: 'dico' → 'Dico').
--
-- Mudanças em alterar_username:
--   * Remove o bloqueio de nomes reservados de governança.
--   * Igualdade com o username atual passa a ser comparada de forma exata
--     (permitindo alterar apenas maiúsculas/minúsculas, ex.: 'dico' → 'Dico').
--   * Mantém: formato, tamanho, prefixo 'random' e unicidade case-insensitive.

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

  -- 2. Normalização (apenas trim — maiúsculas/minúsculas são preservadas)
  v_username_limpo := TRIM(p_novo_username);

  -- 3. Validação de obrigatoriedade e tamanho
  IF v_username_limpo IS NULL OR LENGTH(v_username_limpo) < 2 THEN
    RAISE EXCEPTION 'O usuário deve ter ao menos 2 caracteres.';
  END IF;

  IF LENGTH(v_username_limpo) > 30 THEN
    RAISE EXCEPTION 'O usuário deve ter no máximo 30 caracteres.';
  END IF;

  -- 4. Validação de formato: letras (com acentos), números e sublinhado (_).
  IF v_username_limpo !~ '^[a-zA-ZÀ-ÖØ-öø-ÿ0-9_]+$' THEN
    RAISE EXCEPTION 'O usuário só pode conter letras, números e sublinhado (sem espaços ou símbolos).';
  END IF;

  -- 5. Validação de prefixo reservado (convidados temporários)
  IF v_username_limpo ~ '^random\d*$' OR v_username_limpo ILIKE 'random%' THEN
    RAISE EXCEPTION 'O prefixo "random" é reservado para convidados temporários.';
  END IF;

  -- 6. Verifica se é idêntico ao atual (alterar apenas a caixa é permitido)
  IF v_username_limpo = v_jogador.username THEN
    RAISE EXCEPTION 'O novo usuário informado é igual ao atual.';
  END IF;

  -- 7. Unicidade case-insensitive: nenhum atleta pode assumir o username
  --    de outro (é a proteção de identidade — substitui a lista reservada).
  IF EXISTS (SELECT 1 FROM jogadores WHERE LOWER(username) = LOWER(v_username_limpo) AND id <> p_jogador_id) THEN
    RAISE EXCEPTION 'Este usuário "@%" já está sendo utilizado por outro atleta.', v_username_limpo;
  END IF;

  -- 8. Executa a alteração
  UPDATE jogadores
  SET username = v_username_limpo
  WHERE id = p_jogador_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION alterar_username(bigint, text) TO anon, authenticated;
