-- 095_superadmin_por_id.sql
-- Superadministradores passam a ser identificados pelo ID (bigserial) no banco
-- e não mais pelo username, permitindo que alterem o próprio nome de acesso
-- sem perder os privilégios de governança.
--
-- IDs atuais na base (confirmados): dico = 1, natal = 2, tadeu = 5.
-- O frontend (src/lib/jogadores.ts → SUPERADMIN_IDS) replica esta mesma lista.
--
-- Recria duas RPCs:
--   1. alterar_username — remove o bloqueio de edição para superadmins,
--      mantendo a proteção de usernames reservados (ninguém pode ASSUMIR um
--      nome reservado que não seja o seu próprio).
--   2. salvar_caracteristicas_jogadores — o gate de intocabilidade passa a
--      comparar por ID em vez de LOWER(username).

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

  -- 5. Validação de prefixo reservado (random)
  IF v_username_limpo ~ '^random\d*$' OR v_username_limpo ILIKE 'random%' THEN
    RAISE EXCEPTION 'O prefixo "random" é reservado para convidados temporários.';
  END IF;

  -- 6. Proteção de usernames reservados (governança): ninguém pode ASSUMIR
  --    um nome reservado que não seja o próprio (inclusive superadmins
  --    trocando entre si, evita colisão de identidade).
  IF LOWER(v_username_limpo) IN ('dico', 'tadeu', 'natal')
     AND LOWER(v_jogador.username) <> LOWER(v_username_limpo) THEN
    RAISE EXCEPTION 'Este nome de usuário é reservado para a governança do racha.';
  END IF;

  -- 7. Verifica se é igual ao atual (case-insensitive)
  IF LOWER(v_username_limpo) = LOWER(v_jogador.username) THEN
    RAISE EXCEPTION 'O novo usuário informado é igual ao atual.';
  END IF;

  -- 8. Validação de unicidade (case-insensitive)
  IF EXISTS (SELECT 1 FROM jogadores WHERE LOWER(username) = LOWER(v_username_limpo) AND id <> p_jogador_id) THEN
    RAISE EXCEPTION 'Este usuário "@%" já está sendo utilizado por outro atleta.', v_username_limpo;
  END IF;

  -- 9. Executa a alteração (superadmins incluídos — identificação é por ID)
  UPDATE jogadores
  SET username = v_username_limpo
  WHERE id = p_jogador_id;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION salvar_caracteristicas_jogadores(
  p_admin_id   bigint,
  p_jogadores  jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_operador        jogadores%ROWTYPE;
  v_item            jsonb;
  v_id              bigint;
  v_novo_mensalista boolean;
  v_novo_admin      boolean;
  v_username        text;
  v_posicao         text;
  v_mensalistas_final integer;
BEGIN
  -- 1. Valida o operador (precisa ser admin OU superadmin por ID)
  SELECT * INTO v_operador FROM jogadores WHERE id = p_admin_id LIMIT 1;

  IF v_operador.id IS NULL THEN
    RAISE EXCEPTION 'Operador não encontrado.';
  END IF;

  IF NOT (v_operador.is_admin OR p_admin_id IN (1, 2, 5)) THEN
    RAISE EXCEPTION 'Apenas administradores podem salvar estas alterações.';
  END IF;

  IF p_jogadores IS NULL OR jsonb_typeof(p_jogadores) <> 'array' THEN
    RAISE EXCEPTION 'Payload inválido.';
  END IF;

  -- 2. Teto de mensalistas: conta o estado FINAL projetado do lote.
  --    Goleiros são isentos e nunca contam no teto.
  SELECT COUNT(*) INTO v_mensalistas_final
  FROM jogadores j
  WHERE j.posicao <> 'goleiro'
    AND (
      COALESCE(j.is_mensalista, false) = true
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_jogadores) e
        WHERE (e->>'id')::bigint = j.id
          AND (e->>'is_mensalista')::boolean = false
      )
      OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_jogadores) e
        WHERE (e->>'id')::bigint = j.id
          AND (e->>'is_mensalista')::boolean = true
      )
    );

  IF v_mensalistas_final > 14 THEN
    RAISE EXCEPTION 'Limite máximo de 14 mensalistas atingido. Remova o status de mensalista de outro jogador antes de adicionar.';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_jogadores) LOOP
    v_id := (v_item->>'id')::bigint;
    v_novo_mensalista := COALESCE((v_item->>'is_mensalista')::boolean, false);
    v_novo_admin := COALESCE((v_item->>'is_admin')::boolean, false);

    SELECT username, posicao INTO v_username, v_posicao
    FROM jogadores
    WHERE id = v_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Jogador % não encontrado.', v_id;
    END IF;

    -- Superadmins são permanentemente admin e mensalistas: intocáveis.
    -- Gate por ID (dico=1, natal=2, tadeu=5) — username pode mudar.
    IF v_id IN (1, 2, 5) THEN
      CONTINUE;
    END IF;

    IF v_novo_mensalista = true AND v_posicao = 'goleiro' THEN
      RAISE EXCEPTION 'Goleiros não pagam para jogar e não podem ser mensalistas (@%).', v_username;
    END IF;

    -- Apenas mensalistas podem ser administradores.
    IF v_novo_admin = true AND v_novo_mensalista = false THEN
      RAISE EXCEPTION 'Apenas jogadores mensalistas podem ser administradores (@%).', v_username;
    END IF;

    -- Cascata: perder o status de mensalista derruba o privilégio de admin.
    IF v_novo_mensalista = false THEN
      v_novo_admin := false;
    END IF;

    UPDATE jogadores
    SET is_mensalista = v_novo_mensalista,
        is_admin = v_novo_admin
    WHERE id = v_id;
  END LOOP;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION alterar_username(bigint, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION salvar_caracteristicas_jogadores(bigint, jsonb) TO anon, authenticated;
