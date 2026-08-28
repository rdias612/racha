-- 100_funcao_capacidade_partida.sql
--
-- Item P2-29 do docs/plano-refatoracoes.md: o comentário do bloco 057 dizia
-- "capacidade 16" enquanto o código aplica 14 (desde a migration 080). A regra
-- real: capacidade 14 jogadores de linha titulares na confirmação de presença
-- (+ 2 goleiros escalados na divisão de times = 16 participantes totais,
-- daí a confusão histórica com o número 16).
--
-- Esta migration extrai a fonte única capacidade_partida() e a aplica nas
-- contagens de vagas das RPCs de presença. Refatoração de comportamento ZERO:
-- corpos canônicos do aplicar_tudo.sql copiados byte a byte, trocando apenas
-- o literal de capacidade pela função.

-- 1) Fonte única da capacidade da partida: 14 de linha (+ 2 goleiros = 16 participantes).
--    Função pura, sem parâmetros. NÃO recebe GRANT EXECUTE para anon/authenticated:
--    é um auxiliar interno chamado apenas por RPCs SECURITY DEFINER (que executam
--    como owner e independem das permissões do caller) — não é uma RPC pública.
CREATE OR REPLACE FUNCTION capacidade_partida()
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$ SELECT 14; $$;

-- 2) RPC: confirmar_presenca — teto de confirmações via capacidade_partida()
CREATE OR REPLACE FUNCTION confirmar_presenca(
  p_partida_id bigint,
  p_jogador_id bigint,
  p_status     text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status_partida text;
  v_ocupadas       bigint;
BEGIN
  IF p_status NOT IN ('pendente','confirmado','recusado') THEN
    RETURN false;
  END IF;

  SELECT p.status
    INTO v_status_partida
    FROM partidas p
    WHERE p.id = p_partida_id;
  IF v_status_partida IS NULL OR v_status_partida <> 'draft' THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM partidas_participantes pp
    WHERE pp.partida_id = p_partida_id AND pp.jogador_id = p_jogador_id
  ) THEN
    RETURN false;
  END IF;

  IF p_status = 'confirmado' THEN
    SELECT count(*) INTO v_ocupadas
      FROM partidas_participantes pp
      WHERE pp.partida_id = p_partida_id
        AND pp.jogador_id <> p_jogador_id
        AND pp.status_confirmacao = 'confirmado';

    IF v_ocupadas >= capacidade_partida() THEN
      RETURN false;
    END IF;
  END IF;

UPDATE partidas_participantes pp
  SET status_confirmacao = p_status,
      confirmado_em = CASE WHEN p_status = 'confirmado' THEN now() ELSE NULL END,
      -- Híbrido confirmado na linha assume a posição de linha;
      -- goleiro puro permanece 'goleiro'.
      posicao = CASE
        WHEN p_status = 'confirmado'
         AND pp.posicao = 'goleiro'
         AND pp.time IS NULL
         AND posicao_linha_hibrido(p_jogador_id) IS NOT NULL
        THEN posicao_linha_hibrido(p_jogador_id)
        ELSE pp.posicao
      END
  WHERE pp.partida_id = p_partida_id AND pp.jogador_id = p_jogador_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION confirmar_presenca(bigint, bigint, text) TO anon, authenticated;

-- 3) RPC: adicionar_participante — teto de vagas via capacidade_partida()
CREATE OR REPLACE FUNCTION adicionar_participante(
  p_partida_id bigint,
  p_jogador_id bigint
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status_partida text;
  v_ocupadas       bigint;
  v_existe         boolean;
BEGIN
  SELECT p.status
    INTO v_status_partida
    FROM partidas p
    WHERE p.id = p_partida_id;
  IF v_status_partida IS NULL OR v_status_partida <> 'draft' THEN
    RETURN false;
  END IF;

  SELECT true INTO v_existe
    FROM partidas_participantes pp
    WHERE pp.partida_id = p_partida_id AND pp.jogador_id = p_jogador_id;
  IF v_existe THEN
    RETURN false;
  END IF;

  SELECT count(*) INTO v_ocupadas
    FROM partidas_participantes pp
    WHERE pp.partida_id = p_partida_id
      AND pp.status_confirmacao = 'confirmado';

  IF v_ocupadas >= capacidade_partida() THEN
    RETURN false;
  END IF;

  INSERT INTO partidas_participantes (partida_id, jogador_id, posicao, status_confirmacao, confirmado_em)
    SELECT p_partida_id, j.id,
           COALESCE(posicao_linha_hibrido(j.id), j.posicao),
           'confirmado', now()
    FROM jogadores j
    WHERE j.id = p_jogador_id;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION adicionar_participante(bigint, bigint) TO anon, authenticated;
