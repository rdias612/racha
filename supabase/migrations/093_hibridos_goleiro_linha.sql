-- 093_hibridos_goleiro_linha.sql
--
-- Correção do bug de escalação para atletas HÍBRIDOS (goleiro de perfil que joga na linha).
--
-- Problema: `partidas_participantes.posicao` representa o PAPEL NA PARTIDA, mas era
-- populada com o perfil `jogadores.posicao`. Um híbrido (ex: dudu, posicao='goleiro',
-- posicao_b='meia') confirmado para jogar NA LINHA nascia com posicao='goleiro':
--   1. A tela de divisão de times o excluía dos 14 de linha (botão Equilibrar travado em 13/14);
--   2. `registrar_votos` o bloqueava de votar indevidamente;
--   3. `abrir_partida` contaria 6 de linha no time dele, impedindo abrir a partida;
--   4. O DELETE de `salvar_times_e_goleiros_partida` poderia remover sua participação.
--
-- Correções:
-- 1. adicionar_participante: híbrido confirmado como avulso entra com a posição de
--    linha (posicao_b) quando o perfil é goleiro com posição secundária de linha.
-- 2. confirmar_presenca: ao confirmar híbrido pré-inscrito (row ainda 'goleiro'),
--    promove a row para a posição de linha.
-- 3. criar_partida_semanal_mensalistas: pré-inscreve híbridos mensalistas com a
--    posição de linha (defensivo; hoje goleiros não são mensalistas).
-- 4. salvar_times_e_goleiros_partida: ao escalar um híbrido na linha, grava também
--    posicao = posição de linha (o upsert dos goleiros segue forçando 'goleiro').
-- 5. Backfill: corrige rows em draft onde o híbrido está confirmado como linha.

-- 0) Remove overload legado de salvar_times_e_goleiros_partida (4 args, migration 082):
--    não possui gate de administrador e bypassa a correção da 091. O frontend
--    sempre envia p_admin_id; chamadas de 4 args tornam-se inválidas.
DROP FUNCTION IF EXISTS salvar_times_e_goleiros_partida(bigint, jsonb, bigint, bigint);

-- Helper: posição de linha de um jogador híbrido (NULL quando não é híbrido).
CREATE OR REPLACE FUNCTION posicao_linha_hibrido(p_jogador_id bigint)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN j.posicao = 'goleiro'
     AND j.posicao_b IS NOT NULL
     AND j.posicao_b <> 'goleiro'
    THEN j.posicao_b
    ELSE NULL
  END
  FROM jogadores j
  WHERE j.id = p_jogador_id;
$$;

GRANT EXECUTE ON FUNCTION posicao_linha_hibrido(bigint) TO anon, authenticated;

-- 1) adicionar_participante: híbrido avulso entra com o papel de linha
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
    RETURN false;  -- já é participante
  END IF;

  SELECT count(*) INTO v_ocupadas
    FROM partidas_participantes pp
    WHERE pp.partida_id = p_partida_id
      AND pp.status_confirmacao = 'confirmado';

  IF v_ocupadas >= 14 THEN
    RETURN false;  -- sem vagas (14)
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

-- 2) confirmar_presenca: promove híbrido confirmado para posição de linha
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
    RETURN false;  -- não convidado para esta partida
  END IF;

  -- Se for confirmar, verifica se ainda há vagas (limite 14 confirmados)
  IF p_status = 'confirmado' THEN
    SELECT count(*) INTO v_ocupadas
      FROM partidas_participantes pp
      WHERE pp.partida_id = p_partida_id
        AND pp.jogador_id <> p_jogador_id
        AND pp.status_confirmacao = 'confirmado';

    IF v_ocupadas >= 14 THEN
      RETURN false;  -- vagas esgotadas (14)
    END IF;
  END IF;

  UPDATE partidas_participantes pp
    SET status_confirmacao = p_status,
        confirmado_em = CASE WHEN p_status = 'confirmado' THEN now() ELSE NULL END,
        -- Híbrido confirmado na linha: assume a posição de linha; goleiro puro
        -- ou híbrido que já tem time de goleiro atribuído permanece 'goleiro'.
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

-- 2b) admin_definir_confirmacao: mesma promoção de posição para híbridos quando
--     o admin confirma manualmente (PartidaDetalhe → Quadro de Presença).
CREATE OR REPLACE FUNCTION admin_definir_confirmacao(
  p_partida_id bigint,
  p_jogador_id bigint,
  p_status     text,
  p_admin_id   bigint
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status_partida text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM jogadores WHERE id = p_admin_id AND is_admin = true) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem alterar presenca alheia.';
  END IF;

  SELECT status INTO v_status_partida FROM partidas WHERE id = p_partida_id;
  IF v_status_partida IS NULL OR v_status_partida <> 'draft' THEN
    RETURN false;
  END IF;

  IF p_status NOT IN ('pendente', 'confirmado', 'recusado') THEN
    RETURN false;
  END IF;

  UPDATE partidas_participantes pp
  SET status_confirmacao = p_status,
      confirmado_em = CASE WHEN p_status = 'confirmado' THEN now() ELSE NULL END,
      posicao = CASE
        WHEN p_status = 'confirmado'
         AND pp.posicao = 'goleiro'
         AND pp.time IS NULL
         AND posicao_linha_hibrido(p_jogador_id) IS NOT NULL
        THEN posicao_linha_hibrido(p_jogador_id)
        ELSE pp.posicao
      END
  WHERE pp.partida_id = p_partida_id
    AND pp.jogador_id = p_jogador_id;

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_definir_confirmacao(bigint, bigint, text, bigint) TO anon, authenticated;

-- 3) criar_partida_semanal_mensalistas: pré-inscreve híbridos com posição de linha
CREATE OR REPLACE FUNCTION criar_partida_semanal_mensalistas()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inicio_semana date;
  v_data_jogo     timestamptz;
  v_closes_at     timestamptz;
  v_partida_id    bigint;
  v_admin_id      bigint;
  v_existe        boolean;
BEGIN
  v_inicio_semana := date_trunc('week', now() AT TIME ZONE 'America/Sao_Paulo');

  -- Quinta 19h e quarta 16h (Brasília) da mesma semana, como timestamptz.
  v_data_jogo := (v_inicio_semana + interval '3 days 19 hours') AT TIME ZONE 'America/Sao_Paulo';
  v_closes_at := (v_inicio_semana + interval '2 days 16 hours') AT TIME ZONE 'America/Sao_Paulo';

  -- Idempotência: partida em draft cujo data_jogo cai nesta semana.
  SELECT true INTO v_existe
    FROM partidas p
    WHERE p.status = 'draft'
      AND date_trunc('week', p.data_jogo AT TIME ZONE 'America/Sao_Paulo') = v_inicio_semana
    LIMIT 1;
  IF v_existe THEN
    RETURN NULL;
  END IF;

  -- criado_por é NOT NULL: usa o primeiro admin disponível.
  SELECT id INTO v_admin_id FROM jogadores WHERE is_admin ORDER BY id LIMIT 1;
  IF v_admin_id IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO partidas (data_jogo, status, criado_por, confirmacao_closes_at)
    VALUES (v_data_jogo, 'draft', v_admin_id, v_closes_at)
    RETURNING id INTO v_partida_id;

  -- Pré-inscreve os mensalistas ativos. posicao recebe a posição de linha quando
  -- o mensalista é híbrido (goleiro de perfil com posicao_b de linha), pois a
  -- confirmação semanal é estrita aos 14 de linha. status_confirmacao='pendente'.
  INSERT INTO partidas_participantes (partida_id, jogador_id, posicao, status_confirmacao)
    SELECT v_partida_id, j.id,
           COALESCE(posicao_linha_hibrido(j.id), j.posicao),
           'pendente'
    FROM jogadores j
    WHERE j.is_mensalista = true AND j.is_ativo = true;

  RETURN v_partida_id;
END;
$$;

GRANT EXECUTE ON FUNCTION criar_partida_semanal_mensalistas() TO anon, authenticated;

-- 4) salvar_times_e_goleiros_partida: escalar híbrido na linha grava o papel correto
CREATE OR REPLACE FUNCTION salvar_times_e_goleiros_partida(
  p_partida_id   bigint,
  p_times_linha  jsonb, -- array de { jogador_id: number, time: 'a'|'b' }
  p_goleiro_a_id bigint,
  p_goleiro_b_id bigint,
  p_admin_id     bigint DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  elem jsonb;
BEGIN
  -- Gate de administrador: rejeita quando p_admin_id é NULL ou não é admin
  IF p_admin_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM jogadores WHERE id = p_admin_id AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem alterar a escalação.';
  END IF;

  IF p_goleiro_a_id = p_goleiro_b_id THEN
    RAISE EXCEPTION 'Os goleiros dos times Preto e Branco devem ser diferentes.';
  END IF;

  -- 1. Atualiza os jogadores de linha. Híbrido (perfil goleiro com posição de
  --    linha) escalado na linha recebe também posicao = posição de linha, para
  --    que abrir_partida conte 7 de linha por time e registrar_votos o libere.
  FOR elem IN SELECT * FROM jsonb_array_elements(p_times_linha)
  LOOP
    UPDATE partidas_participantes
    SET time = (elem->>'time')::char(1),
        posicao = COALESCE(
          CASE WHEN posicao_linha_hibrido((elem->>'jogador_id')::bigint) IS NOT NULL
               THEN posicao_linha_hibrido((elem->>'jogador_id')::bigint)
          END,
          posicao
        )
    WHERE partida_id = p_partida_id
      AND jogador_id = (elem->>'jogador_id')::bigint;
  END LOOP;

  -- 2. Remove goleiros anteriores que NÃO estão mais escalados no gol
  --    E que também NÃO estão na lista de confirmados de linha (evita deletar participante de linha).
  DELETE FROM partidas_participantes
  WHERE partida_id = p_partida_id
    AND posicao = 'goleiro'
    AND jogador_id NOT IN (p_goleiro_a_id, p_goleiro_b_id)
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_times_linha) l
      WHERE (l->>'jogador_id')::bigint = partidas_participantes.jogador_id
    );

  -- 3. Salva / Atualiza Goleiro Time Preto (a)
  INSERT INTO partidas_participantes (
    partida_id, jogador_id, time, posicao, status_confirmacao
  )
  VALUES (
    p_partida_id, p_goleiro_a_id, 'a', 'goleiro', 'confirmado'
  )
  ON CONFLICT (partida_id, jogador_id)
  DO UPDATE SET
    time = 'a',
    posicao = 'goleiro',
    status_confirmacao = 'confirmado';

  -- 4. Salva / Atualiza Goleiro Time Branco (b)
  INSERT INTO partidas_participantes (
    partida_id, jogador_id, time, posicao, status_confirmacao
  )
  VALUES (
    p_partida_id, p_goleiro_b_id, 'b', 'goleiro', 'confirmado'
  )
  ON CONFLICT (partida_id, jogador_id)
  DO UPDATE SET
    time = 'b',
    posicao = 'goleiro',
    status_confirmacao = 'confirmado';

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION salvar_times_e_goleiros_partida(bigint, jsonb, bigint, bigint, bigint) TO anon, authenticated;

-- 5) Backfill: em partidas draft, híbrido CONFIRMADO como linha (sem time de
--    goleiro) ainda marcado como 'goleiro' recebe a posição de linha.
--    Goleiros puros (posicao_b NULL/goleiro) e histórico published/closed intactos.
UPDATE partidas_participantes pp
SET posicao = j.posicao_b
FROM jogadores j
WHERE j.id = pp.jogador_id
  AND j.posicao = 'goleiro'
  AND j.posicao_b IS NOT NULL
  AND j.posicao_b <> 'goleiro'
  AND pp.posicao = 'goleiro'
  AND pp.time IS NULL
  AND pp.status_confirmacao = 'confirmado'
  AND EXISTS (
    SELECT 1 FROM partidas p
    WHERE p.id = pp.partida_id AND p.status = 'draft'
  );
