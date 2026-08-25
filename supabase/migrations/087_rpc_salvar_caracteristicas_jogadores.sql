-- 087: RPC transacional para salvar um LOTE de alterações de mensalista/admin
-- (tela Gestão de Atletas). Substitui o loop client-side de N round-trips, em
-- que uma falha no meio deixava metade dos jogadores alterada.
--
-- Regras de negócio aplicadas no servidor (AGENTS.md 8.5):
--   * Superadmins hardcoded ('dico', 'tadeu', 'natal') nunca são alterados.
--   * Goleiro não pode ser mensalista (isento por definição).
--   * Apenas mensalista pode ser administrador; remover mensalista derruba admin.
--   * Teto de 14 mensalistas validado sobre o estado FINAL do lote (o cálculo
--     considera desligamentos e ligamentos juntos — impossível de fazer no
--     client sem race condition).
--
-- A função é transacional: qualquer violação reverte o lote inteiro.

CREATE OR REPLACE FUNCTION salvar_caracteristicas_jogadores(
  p_admin_id bigint,
  p_jogadores jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item jsonb;
  v_id bigint;
  v_username text;
  v_posicao text;
  v_novo_mensalista boolean;
  v_novo_admin boolean;
  v_mensalistas_final integer;
BEGIN
  -- Gate: apenas administradores podem alterar características de jogadores.
  IF p_admin_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM jogadores WHERE id = p_admin_id AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Apenas administradores podem alterar jogadores.';
  END IF;

  IF p_jogadores IS NULL OR jsonb_typeof(p_jogadores) <> 'array' THEN
    RAISE EXCEPTION 'p_jogadores deve ser um array jsonb.';
  END IF;

  -- Teto de mensalistas (MAX_MENSALISTAS = 14) sobre o estado final do lote:
  -- mantém quem é mensalista e não foi desativado + quem foi ativado no lote.
  SELECT COUNT(*) INTO v_mensalistas_final
  FROM jogadores j
  WHERE
    (
      j.is_mensalista AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_jogadores) e
        WHERE (e->>'id')::bigint = j.id
          AND (e->>'is_mensalista')::boolean = false
      )
    )
    OR
    (
      NOT j.is_mensalista AND EXISTS (
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
    IF LOWER(v_username) IN ('dico', 'tadeu', 'natal') THEN
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

GRANT EXECUTE ON FUNCTION salvar_caracteristicas_jogadores(bigint, jsonb) TO anon, authenticated;
