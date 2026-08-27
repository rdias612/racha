-- 094_username_letras_acentos_underscore.sql
-- Flexible username rules: accepts letters (including accented ç, ã, é...),
-- uppercase and lowercase, numbers and underscore (_) only. Case is preserved.
-- Barred: spaces, hyphens, dots and any other special chars.
-- Recria alterar_username com a nova regra de formato (RPC SECURITY DEFINER).

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
  --    PostgreSQL com encoding UTF-8 aceita faixa acentuada na expressão regular.
  IF v_username_limpo !~ '^[a-zA-ZÀ-ÖØ-öø-ÿ0-9_]+$' THEN
    RAISE EXCEPTION 'O usuário só pode conter letras, números e sublinhado (sem espaços ou símbolos).';
  END IF;

  -- 5. Validação de prefixo reservado (random)
  IF v_username_limpo ~ '^random\d*$' OR v_username_limpo ILIKE 'random%' THEN
    RAISE EXCEPTION 'O prefixo "random" é reservado para convidados temporários.';
  END IF;

  -- 6. Proteção de Superadmins (dico, tadeu, natal)
  IF LOWER(v_username_limpo) IN ('dico', 'tadeu', 'natal') AND v_jogador.username NOT ILIKE ANY (ARRAY['dico', 'tadeu', 'natal']) THEN
    RAISE EXCEPTION 'Este nome de usuário é reservado para a governança do racha.';
  END IF;

  IF v_jogador.username IN ('dico', 'tadeu', 'natal') THEN
    RAISE EXCEPTION 'Usuários Superadmin possuem identificador permanente por motivos de governança.';
  END IF;

  -- 7. Verifica se é igual ao atual (case-insensitive)
  IF LOWER(v_username_limpo) = LOWER(v_jogador.username) THEN
    RAISE EXCEPTION 'O novo usuário informado é igual ao atual.';
  END IF;

  -- 8. Validação de unicidade (case-insensitive)
  IF EXISTS (SELECT 1 FROM jogadores WHERE LOWER(username) = LOWER(v_username_limpo) AND id <> p_jogador_id) THEN
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
