-- 108_username_regra_unica.sql
-- Unifica a regra de username entre frontend, RPCs e banco (plano A5).
--
-- Regra canônica:
--   * trim; maiúsculas/minúsculas informadas são PRESERVADAS no armazenamento.
--   * 2 a 30 caracteres; ^[a-zA-ZÀ-ÖØ-öø-ÿ0-9_]+$.
--   * prefixo "random" (case-insensitive) é reservado a convidados temporários.
--   * unicidade case-insensitive garantida por índice único em
--     lower(trim(username)) — a expressão serve apenas como chave de comparação.
--
-- Nenhuma duplicidade case-insensitive existente: a pré-validação (A5.1) é
-- pré-requisito para aplicar esta migration.

-- 1. Índice único case-insensitive (a constraint UNIQUE histórica case-sensitive
--    de 001 permanece como redundância até validação do rollout).
CREATE UNIQUE INDEX IF NOT EXISTS jogadores_username_ci_unique
  ON public.jogadores (lower(trim(username)));

-- 2. criar_jogador: mesma validação do frontend antes do INSERT.
--    Assinatura atual (056) preservada; p_nome não é mais usado (coluna removida em 076).
CREATE OR REPLACE FUNCTION criar_jogador(
  p_username      text,
  p_nome          text,
  p_posicao       text,
  p_is_admin      boolean,
  p_posicao_b     text DEFAULT 'meia',
  p_is_mensalista boolean DEFAULT false
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id bigint;
  v_posicao_b text;
  v_username_limpo text;
BEGIN
  v_username_limpo := TRIM(p_username);

  IF v_username_limpo IS NULL OR LENGTH(v_username_limpo) < 2 THEN
    RAISE EXCEPTION 'O usuário deve ter ao menos 2 caracteres.';
  END IF;

  IF LENGTH(v_username_limpo) > 30 THEN
    RAISE EXCEPTION 'O usuário deve ter no máximo 30 caracteres.';
  END IF;

  IF v_username_limpo !~ '^[a-zA-ZÀ-ÖØ-öø-ÿ0-9_]+$' THEN
    RAISE EXCEPTION 'O usuário só pode conter letras, números e sublinhado (sem espaços ou símbolos).';
  END IF;

  IF v_username_limpo ~ '^random\d*$' OR v_username_limpo ILIKE 'random%' THEN
    RAISE EXCEPTION 'O prefixo "random" é reservado para convidados temporários.';
  END IF;

  -- Goleiros primarios nao tem posicao secundaria.
  v_posicao_b := CASE WHEN p_posicao = 'goleiro' THEN NULL ELSE p_posicao_b END;

  INSERT INTO jogadores (username, senha_hash, posicao, is_admin, is_ativo, posicao_b, is_mensalista)
  VALUES (v_username_limpo, '123', p_posicao, p_is_admin, true, v_posicao_b, COALESCE(p_is_mensalista, false))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- 3. alterar_username: mantém a lógica de 096; o índice único acima passa a
--    impedir corrida de unicidade mesmo entre verificações concorrentes.
--    Alterar apenas a caixa (mesma chave case-insensitive no próprio registro)
--    permanece permitido: o índice colide só com OUTRO id.
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

  -- 7. Unicidade case-insensitive: verificação rápida + índice único como
  --    garantia final sob concorrência (colisão → violação do índice → 23505).
  IF EXISTS (
    SELECT 1 FROM jogadores
    WHERE lower(trim(username)) = lower(v_username_limpo)
      AND id <> p_jogador_id
  ) THEN
    RAISE EXCEPTION 'Este usuário "@%" já está sendo utilizado por outro atleta.', v_username_limpo;
  END IF;

  -- 8. Executa a alteração
  UPDATE jogadores
  SET username = v_username_limpo
  WHERE id = p_jogador_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION criar_jogador(text, text, text, boolean, text, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION alterar_username(bigint, text) TO anon, authenticated;
