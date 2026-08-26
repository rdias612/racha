-- ============================================================================
-- ⚽ RACHA GRAGOATÁ CBO — SCRIPT MESTRE CONSOLIDADO (ESTADO FINAL)
-- ============================================================================
-- Documento Canônico de Banco de Dados (PostgreSQL / Supabase)
-- Diretrizes: Zero UUID (Bigint/Bigserial), SECURITY DEFINER, SET search_path = public.
-- Ordem estrita de dependências: Extensões -> Tabelas -> Helpers -> Views -> RPCs -> Crons -> Grants -> Seeds.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. EXTENSÕES
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- 2. TABELAS E ESTRUTURAS PRINCIPAIS
-- ----------------------------------------------------------------------------

-- 2.1 Jogadores (Atletas e Goleiros)
CREATE TABLE IF NOT EXISTS jogadores (
  id            bigserial   PRIMARY KEY,
  username      text        NOT NULL UNIQUE,
  senha_hash    text        NOT NULL DEFAULT '123',
  posicao       text        NOT NULL CHECK (posicao IN ('goleiro','zagueiro','lateral','meia','atacante','random')),
  posicao_b     text        CHECK (posicao_b IN ('goleiro','zagueiro','lateral','meia','atacante','random')),
  is_admin      boolean     NOT NULL DEFAULT false,
  is_ativo      boolean     NOT NULL DEFAULT true,
  is_mensalista boolean     NOT NULL DEFAULT false,
  chave_pix     text,
  telefone      text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- 2.2 Partidas
CREATE TABLE IF NOT EXISTS partidas (
  id                    bigserial   PRIMARY KEY,
  data_jogo             timestamptz NOT NULL,
  status                text        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','live','published','closed')),
  criado_por            bigint      REFERENCES jogadores(id),
  published_at          timestamptz,
  voting_closes_at      timestamptz,
  confirmacao_closes_at timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partidas_status_data ON partidas(status, data_jogo DESC);
CREATE INDEX IF NOT EXISTS idx_partidas_data_jogo ON partidas(data_jogo DESC);

-- 2.3 Participantes da Partida
CREATE TABLE IF NOT EXISTS partidas_participantes (
  partida_id         bigint      NOT NULL REFERENCES partidas(id) ON DELETE CASCADE,
  jogador_id         bigint      NOT NULL REFERENCES jogadores(id),
  time               char(1)     CHECK (time IN ('a','b')),
  posicao            text        NOT NULL CHECK (posicao IN ('goleiro','zagueiro','lateral','meia','atacante','random')),
  gols               integer     NOT NULL DEFAULT 0,
  assistencias       integer     NOT NULL DEFAULT 0,
  gols_contra        integer     NOT NULL DEFAULT 0,
  status_confirmacao text        NOT NULL DEFAULT 'pendente' CHECK (status_confirmacao IN ('pendente','confirmado','recusado')),
  confirmado_em      timestamptz,
  PRIMARY KEY (partida_id, jogador_id)
);

CREATE INDEX IF NOT EXISTS idx_partidas_participantes_jogador ON partidas_participantes(jogador_id);
CREATE INDEX IF NOT EXISTS idx_partidas_participantes_placar ON partidas_participantes(partida_id, time) INCLUDE (gols, gols_contra);

-- 2.4 Votos de Avaliação Pós-Jogo
CREATE TABLE IF NOT EXISTS votes (
  partida_id bigint      NOT NULL REFERENCES partidas(id) ON DELETE CASCADE,
  voter_id   bigint      NOT NULL REFERENCES jogadores(id),
  target_id  bigint      NOT NULL REFERENCES jogadores(id),
  rating     smallint    NOT NULL CHECK (rating >= 1 AND rating <= 10),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (partida_id, voter_id, target_id),
  CHECK (voter_id <> target_id)
);

CREATE INDEX IF NOT EXISTS idx_votes_partida ON votes(partida_id);
CREATE INDEX IF NOT EXISTS idx_votes_target ON votes(target_id);
CREATE INDEX IF NOT EXISTS idx_votes_voter ON votes(voter_id);

-- 2.5 Eventos em Tempo Real (Modo Ao Vivo)
CREATE TABLE IF NOT EXISTS partida_eventos (
  id                     bigserial   PRIMARY KEY,
  partida_id             bigint      NOT NULL REFERENCES partidas(id) ON DELETE CASCADE,
  tipo                   text        NOT NULL CHECK (tipo IN ('gol', 'gol_contra')),
  jogador_id             bigint      NOT NULL REFERENCES jogadores(id),
  assistencia_jogador_id bigint      REFERENCES jogadores(id),
  time                   char(1)     NOT NULL CHECK (time IN ('a', 'b')),
  minuto                 integer,
  created_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partida_eventos_partida ON partida_eventos(partida_id);
CREATE INDEX IF NOT EXISTS idx_partida_eventos_jogador ON partida_eventos(jogador_id);

-- 2.6 Subscrições e Entregas Web Push
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         bigserial   PRIMARY KEY,
  jogador_id bigint      NOT NULL REFERENCES jogadores(id) ON DELETE CASCADE,
  endpoint   text        NOT NULL UNIQUE,
  p256dh     text        NOT NULL,
  auth       text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_jogador ON push_subscriptions(jogador_id);

CREATE TABLE IF NOT EXISTS push_reminder_deliveries (
  partida_id    bigint      NOT NULL REFERENCES partidas(id) ON DELETE CASCADE,
  jogador_id    bigint      NOT NULL REFERENCES jogadores(id) ON DELETE CASCADE,
  reminder_key  text        NOT NULL CHECK (reminder_key IN ('6h', '3h', '1h', '30m', 'confirmacao', 'reforco')),
  claimed_at    timestamptz NOT NULL DEFAULT now(),
  sent_at       timestamptz,
  error_message text,
  PRIMARY KEY (partida_id, jogador_id, reminder_key)
);

CREATE INDEX IF NOT EXISTS idx_push_reminders_claimed ON push_reminder_deliveries(claimed_at);

-- 2.7 Configurações de Eventos Financeiros Automáticos
CREATE TABLE IF NOT EXISTS eventos_financeiros_automaticos (
  id                  bigserial     PRIMARY KEY,
  nome                text          NOT NULL,
  gatilho             text          NOT NULL CHECK (gatilho IN ('mensal', 'fim_partida')),
  natureza            text          NOT NULL CHECK (natureza IN ('receita', 'despesa')),
  tipo                text          NOT NULL CHECK (tipo IN ('mensalidade', 'avulso', 'outro', 'goleiro', 'campo', 'eventos')),
  valor               numeric(10,2) NOT NULL CHECK (valor > 0),
  destino             text          NOT NULL CHECK (destino IN ('caixa', 'mensalistas', 'goleiros_partida', 'jogador_fixo')),
  jogador_id          bigint        REFERENCES jogadores(id) ON DELETE SET NULL,
  descricao_template  text          NOT NULL,
  referencia_template text,
  ativo               boolean       NOT NULL DEFAULT true,
  created_at          timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT eventos_auto_jogador_fixo CHECK (destino <> 'jogador_fixo' OR jogador_id IS NOT NULL),
  CONSTRAINT eventos_auto_goleiros_so_partida CHECK (destino <> 'goleiros_partida' OR gatilho = 'fim_partida'),
  CONSTRAINT eventos_auto_mensalistas_so_mensal CHECK (destino <> 'mensalistas' OR gatilho = 'mensal')
);

-- 2.8 Lançamentos Financeiros (Dívidas e Despesas)
CREATE TABLE IF NOT EXISTS dividas (
  id                   bigserial     PRIMARY KEY,
  jogador_id           bigint        REFERENCES jogadores(id),
  tipo                 text          NOT NULL CHECK (tipo IN ('mensalidade', 'avulso', 'outro', 'goleiro', 'campo', 'eventos')),
  valor                numeric(10,2) NOT NULL CHECK (valor > 0),
  data_divida          date          NOT NULL DEFAULT current_date,
  paga                 boolean       NOT NULL DEFAULT false,
  data_pagamento       date,
  descricao            text,
  referencia           text,
  partida_id           bigint        REFERENCES partidas(id) ON DELETE SET NULL,
  natureza             text          NOT NULL DEFAULT 'receita' CHECK (natureza IN ('receita', 'despesa')),
  evento_automatico_id bigint        REFERENCES eventos_financeiros_automaticos(id) ON DELETE SET NULL,
  created_at           timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT dividas_receita_exige_jogador CHECK (natureza <> 'receita' OR jogador_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_dividas_jogador_abertas ON dividas(jogador_id) WHERE paga = false;
CREATE INDEX IF NOT EXISTS idx_dividas_natureza_abertas ON dividas(natureza) WHERE paga = false;
CREATE INDEX IF NOT EXISTS idx_dividas_evento_automatico ON dividas(evento_automatico_id) WHERE evento_automatico_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_dividas_evento_auto_mensal ON dividas (evento_automatico_id, referencia, (COALESCE(jogador_id, 0))) WHERE evento_automatico_id IS NOT NULL AND partida_id IS NULL AND referencia IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_dividas_evento_auto_partida ON dividas (evento_automatico_id, partida_id, (COALESCE(jogador_id, 0))) WHERE evento_automatico_id IS NOT NULL AND partida_id IS NOT NULL;

-- 2.9 Configuração Global de Notificações e Prazos
CREATE TABLE IF NOT EXISTS notificacoes_config (
  id                          integer     PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  confirmacao_dia_semana      smallint    NOT NULL DEFAULT 1 CHECK (confirmacao_dia_semana BETWEEN 0 AND 6),
  confirmacao_horario         time        NOT NULL DEFAULT '10:00:00',
  confirmacao_titulo          text        NOT NULL DEFAULT '⚽ Confirmação do Racha',
  confirmacao_mensagem        text        NOT NULL DEFAULT 'A lista para o racha de quinta está aberta! Confirme sua presença até quarta às 16h.',
  confirmacao_ativo           boolean     NOT NULL DEFAULT true,
  reforco_horas_antes_prazo   smallint    NOT NULL DEFAULT 3 CHECK (reforco_horas_antes_prazo > 0),
  reforco_titulo              text        NOT NULL DEFAULT '⏰ Última chamada para o Racha',
  reforco_mensagem            text        NOT NULL DEFAULT 'Faltam poucas horas para fechar a prioridade dos mensalistas! Confirme se vai jogar.',
  reforco_ativo               boolean     NOT NULL DEFAULT true,
  votacao_bucket_6h           boolean     NOT NULL DEFAULT true,
  votacao_bucket_3h           boolean     NOT NULL DEFAULT true,
  votacao_bucket_1h           boolean     NOT NULL DEFAULT true,
  votacao_bucket_30m          boolean     NOT NULL DEFAULT true,
  votacao_template_6h_titulo  text        NOT NULL DEFAULT '⭐ Votação Aberta do Racha',
  votacao_template_6h_msg     text        NOT NULL DEFAULT 'Não esqueça de avaliar a atuação dos companheiros no racha de ontem!',
  votacao_template_3h_titulo  text        NOT NULL DEFAULT '⭐ Faltam 3 horas para fechar a votação',
  votacao_template_3h_msg     text        NOT NULL DEFAULT 'A votação do racha encerra em breve. Dê suas notas para eleger o Craque!',
  votacao_template_1h_titulo  text        NOT NULL DEFAULT '⏰ Última hora de votação',
  votacao_template_1h_msg     text        NOT NULL DEFAULT 'Última hora para votar nas notas do racha!',
  votacao_template_30m_titulo text        NOT NULL DEFAULT '🚨 30 minutos para o Craque da Partida',
  votacao_template_30m_msg    text        NOT NULL DEFAULT 'A votação encerra em 30 minutos. Corre para enviar suas notas!',
  votacao_ativo               boolean     NOT NULL DEFAULT true,
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  updated_by                  bigint      REFERENCES jogadores(id)
);

-- ----------------------------------------------------------------------------
-- 3. FUNÇÕES PURAS E UTILITÁRIAS
-- ----------------------------------------------------------------------------

-- 3.1 Média Aparada (Item P2-24)
CREATE OR REPLACE FUNCTION media_aparada(
  p_sum   numeric,
  p_min   numeric,
  p_max   numeric,
  p_count bigint
)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN p_count >= 3 THEN (p_sum - p_min - p_max)::numeric / (p_count - 2)
    WHEN p_count > 0 THEN p_sum::numeric / p_count
    ELSE NULL
  END;
$$;

GRANT EXECUTE ON FUNCTION media_aparada(numeric, numeric, numeric, bigint) TO anon, authenticated;

-- 3.2 Substituição de Placeholders em Templates Financeiros
CREATE OR REPLACE FUNCTION substituir_template_financeiro(
  p_template text,
  p_data     date,
  p_nome     text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_out text;
  v_data text;
  v_mes text;
  v_ano text;
  v_mes_ano text;
  v_ref text;
BEGIN
  IF p_template IS NULL THEN
    RETURN NULL;
  END IF;

  v_data := to_char(p_data, 'DD/MM/YYYY');
  v_mes := to_char(p_data, 'MM');
  v_ano := to_char(p_data, 'YYYY');
  v_mes_ano := to_char(p_data, 'TMMonth/YYYY');
  v_ref := to_char(p_data, 'YYYY-MM');

  v_out := replace(p_template, '{data}', v_data);
  v_out := replace(v_out, '{mes}', v_mes);
  v_out := replace(v_out, '{ano}', v_ano);
  v_out := replace(v_out, '{mes_ano}', v_mes_ano);
  v_out := replace(v_out, '{referencia}', v_ref);
  v_out := replace(v_out, '{nome}', COALESCE(p_nome, ''));
  v_out := replace(v_out, '{username}', COALESCE(p_nome, ''));

  RETURN v_out;
END;
$$;

GRANT EXECUTE ON FUNCTION substituir_template_financeiro(text, date, text) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4. VIEWS CANÔNICAS
-- ----------------------------------------------------------------------------

-- 4.1 Placar da Partida (Gols Próprios e Gols Contra do Adversário em Passo Único)
CREATE OR REPLACE VIEW partida_placar AS
WITH agg AS (
  SELECT
    partida_id,
    (COALESCE(SUM(gols) FILTER (WHERE time = 'a'), 0) + COALESCE(SUM(gols_contra) FILTER (WHERE time = 'b'), 0))::bigint AS gols_time_a,
    (COALESCE(SUM(gols) FILTER (WHERE time = 'b'), 0) + COALESCE(SUM(gols_contra) FILTER (WHERE time = 'a'), 0))::bigint AS gols_time_b
  FROM partidas_participantes
  GROUP BY partida_id
)
SELECT
  p.id AS partida_id,
  COALESCE(a.gols_time_a, 0)::bigint AS gols_time_a,
  COALESCE(a.gols_time_b, 0)::bigint AS gols_time_b,
  CASE
    WHEN COALESCE(a.gols_time_a, 0) > COALESCE(a.gols_time_b, 0) THEN 'a'
    WHEN COALESCE(a.gols_time_b, 0) > COALESCE(a.gols_time_a, 0) THEN 'b'
    ELSE 'empate'
  END AS vencedor
FROM partidas p
LEFT JOIN agg a ON a.partida_id = p.id;

GRANT SELECT ON partida_placar TO anon, authenticated;

-- 4.2 Levantamento Centralizado de Participações e Resultados (Item P2-25)
CREATE OR REPLACE VIEW v_levantamento AS
SELECT
  pp.partida_id,
  pp.jogador_id,
  pp.time,
  COALESCE(pp.gols, 0)::bigint AS gols,
  COALESCE(pp.assistencias, 0)::bigint AS assistencias,
  COALESCE(pp.gols_contra, 0)::bigint AS gols_contra,
  pl.vencedor,
  CASE
    WHEN pl.vencedor = pp.time THEN 'vitoria'
    WHEN pl.vencedor = 'empate' THEN 'empate'
    ELSE 'derrota'
  END AS resultado,
  CASE
    WHEN pl.vencedor = pp.time THEN 3
    WHEN pl.vencedor = 'empate' THEN 1
    ELSE 0
  END AS pontos,
  (pl.vencedor = pp.time) AS vitoria,
  (pl.vencedor = 'empate') AS empate,
  (pl.vencedor <> pp.time AND pl.vencedor <> 'empate') AS derrota,
  p.data_jogo
FROM partidas_participantes pp
JOIN partidas p ON p.id = pp.partida_id
JOIN partida_placar pl ON pl.partida_id = pp.partida_id
WHERE p.status IN ('published', 'closed');

GRANT SELECT ON v_levantamento TO anon, authenticated;

-- 4.3 Notas da Partida e Craque (Média Aparada)
CREATE OR REPLACE VIEW partida_notas AS
WITH raw_agg AS (
  SELECT
    v.partida_id,
    v.target_id,
    j.username,
    media_aparada(SUM(v.rating), MIN(v.rating), MAX(v.rating), COUNT(*)) AS avg_rating,
    COUNT(*)::bigint                                                    AS vote_count
  FROM votes v
  JOIN jogadores j ON j.id = v.target_id
  GROUP BY v.partida_id, v.target_id, j.username
),
agg AS (
  SELECT
    partida_id,
    target_id,
    username,
    avg_rating,
    vote_count,
    RANK() OVER (
      PARTITION BY partida_id
      ORDER BY avg_rating DESC, vote_count DESC, username ASC
    )                                                                   AS rk
  FROM raw_agg
)
SELECT
  partida_id,
  target_id,
  username,
  avg_rating,
  vote_count,
  (rk = 1) AS is_craque
FROM agg;

GRANT SELECT ON partida_notas TO anon, authenticated;

-- 4.4 Partidas com Placar Completo
CREATE OR REPLACE VIEW partidas_com_placar AS
SELECT
  p.id,
  p.data_jogo,
  p.status,
  p.criado_por,
  p.published_at,
  p.voting_closes_at,
  p.confirmacao_closes_at,
  p.created_at,
  pl.gols_time_a,
  pl.gols_time_b,
  pl.vencedor
FROM partidas p
LEFT JOIN partida_placar pl ON pl.partida_id = p.id;

GRANT SELECT ON partidas_com_placar TO anon, authenticated;

-- 4.5 Ranking Oficial da Temporada
CREATE OR REPLACE VIEW ranking AS
SELECT
  l.jogador_id,
  j.username,
  SUM(l.pontos)::bigint                                     AS pontos,
  COUNT(*) FILTER (WHERE l.vitoria)::bigint                 AS vitorias,
  COUNT(*) FILTER (WHERE l.empate)::bigint                  AS empates,
  COUNT(*) FILTER (WHERE l.derrota)::bigint                 AS derrotas,
  COUNT(*)::bigint                                          AS partidas,
  SUM(l.gols)::bigint                                       AS gols,
  SUM(l.assistencias)::bigint                               AS assistencias,
  SUM(l.gols_contra)::bigint                                AS gols_contra,
  j.posicao
FROM v_levantamento l
JOIN jogadores j ON j.id = l.jogador_id
GROUP BY l.jogador_id, j.username, j.posicao;

GRANT SELECT ON ranking TO anon, authenticated;

-- 4.6 Estatísticas Individuais por Jogador
CREATE OR REPLACE VIEW stats_jogador AS
SELECT
  l.jogador_id,
  COUNT(*)::bigint                                          AS partidas,
  SUM(l.gols)::bigint                                       AS gols,
  SUM(l.assistencias)::bigint                               AS assistencias,
  COUNT(*) FILTER (WHERE l.vitoria)::bigint                 AS vitorias,
  SUM(l.gols_contra)::bigint                                AS gols_contra
FROM v_levantamento l
GROUP BY l.jogador_id;

GRANT SELECT ON stats_jogador TO anon, authenticated;

-- 4.7 Resumo de Dívidas em Aberto por Jogador
CREATE OR REPLACE VIEW dividas_resumo AS
SELECT
  j.id            AS jogador_id,
  j.username      AS username,
  j.is_mensalista AS is_mensalista,
  COALESCE(SUM(d.valor) FILTER (WHERE d.paga = false AND d.natureza = 'receita'), 0)::numeric AS total_devido,
  COUNT(d.id) FILTER (WHERE d.paga = false AND d.natureza = 'receita')::bigint               AS qtd_dividas
FROM jogadores j
LEFT JOIN dividas d ON d.jogador_id = j.id
GROUP BY j.id, j.username, j.is_mensalista;

GRANT SELECT ON dividas_resumo TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 5. RPCS: AUTENTICAÇÃO, ATLETAS E GOLEIROS
-- ----------------------------------------------------------------------------

-- 5.1 Fazer Login
CREATE OR REPLACE FUNCTION fazer_login(p_username text, p_senha text)
RETURNS TABLE (
  id             bigint,
  username       text,
  posicao        text,
  is_admin       boolean,
  is_ativo       boolean,
  is_mensalista  boolean,
  posicao_b      text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_jogador jogadores%ROWTYPE;
BEGIN
  SELECT * INTO v_jogador
  FROM jogadores
  WHERE username = p_username
    AND is_ativo = true
  LIMIT 1;

  IF v_jogador.id IS NULL THEN
    RETURN;
  END IF;

  IF p_senha <> v_jogador.senha_hash THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    v_jogador.id,
    v_jogador.username,
    v_jogador.posicao,
    v_jogador.is_admin,
    v_jogador.is_ativo,
    v_jogador.is_mensalista,
    v_jogador.posicao_b;
END;
$$;

GRANT EXECUTE ON FUNCTION fazer_login(text, text) TO anon, authenticated;

-- 5.2 Criar Jogador
CREATE OR REPLACE FUNCTION criar_jogador(
  p_username      text,
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
  v_is_mensalista boolean;
BEGIN
  v_posicao_b := CASE WHEN p_posicao = 'goleiro' THEN NULL ELSE p_posicao_b END;
  v_is_mensalista := CASE WHEN p_posicao = 'goleiro' THEN false ELSE COALESCE(p_is_mensalista, false) END;

  INSERT INTO jogadores (username, senha_hash, posicao, is_admin, is_ativo, posicao_b, is_mensalista)
  VALUES (p_username, '123', p_posicao, p_is_admin, true, v_posicao_b, v_is_mensalista)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION criar_jogador(text, text, boolean, text, boolean) TO anon, authenticated;

-- 5.3 Trocar Senha
CREATE OR REPLACE FUNCTION trocar_senha(
  p_jogador_id  bigint,
  p_senha_antiga text,
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
  SELECT senha_hash INTO v_senha_hash FROM jogadores WHERE id = p_jogador_id AND is_ativo = true;
  IF v_senha_hash IS NULL THEN
    RETURN false;
  END IF;

  IF v_senha_hash <> p_senha_antiga THEN
    RETURN false;
  END IF;

  UPDATE jogadores
  SET senha_hash = p_senha_nova
  WHERE id = p_jogador_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION trocar_senha(bigint, text, text) TO anon, authenticated;

-- 5.4 Resetar Senha (Admin)
CREATE OR REPLACE FUNCTION resetar_senha(
  p_jogador_id bigint,
  p_admin_id   bigint
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM jogadores WHERE id = p_admin_id AND is_admin = true) THEN
    RETURN false;
  END IF;

  UPDATE jogadores
  SET senha_hash = '123'
  WHERE id = p_jogador_id;

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION resetar_senha(bigint, bigint) TO anon, authenticated;

-- 5.5 Alterar Username (Próprio Atleta ou Admin)
CREATE OR REPLACE FUNCTION alterar_username(
  p_jogador_id    bigint,
  p_novo_username text,
  p_admin_id      bigint DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_username_limpo text;
  v_is_admin       boolean := false;
BEGIN
  IF p_admin_id IS NOT NULL THEN
    SELECT is_admin INTO v_is_admin FROM jogadores WHERE id = p_admin_id;
  END IF;

  IF p_admin_id IS NOT NULL AND p_admin_id <> p_jogador_id AND v_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem alterar o nome de outro atleta.';
  END IF;

  v_username_limpo := lower(trim(p_novo_username));

  IF length(v_username_limpo) < 2 THEN
    RAISE EXCEPTION 'O apelido deve ter pelo menos 2 caracteres.';
  END IF;

  IF v_username_limpo ~ '^random[0-9]*$' THEN
    RAISE EXCEPTION 'O apelido escolhido é reservado pelo sistema.';
  END IF;

  IF EXISTS (SELECT 1 FROM jogadores WHERE username = v_username_limpo AND id <> p_jogador_id) THEN
    RAISE EXCEPTION 'Este apelido já está em uso por outro atleta.';
  END IF;

  UPDATE jogadores
  SET username = v_username_limpo
  WHERE id = p_jogador_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION alterar_username(bigint, text, bigint) TO anon, authenticated;

-- 5.6 Cadastro Rápido de Goleiro (Admin)
CREATE OR REPLACE FUNCTION criar_goleiro_rapido(
  p_nome      text,
  p_telefone  text DEFAULT NULL,
  p_chave_pix text DEFAULT NULL,
  p_admin_id  bigint DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_username text;
  v_base     text;
  v_id       bigint;
  v_count    integer := 1;
BEGIN
  IF p_admin_id IS NULL OR NOT EXISTS (SELECT 1 FROM jogadores WHERE id = p_admin_id AND is_admin = true) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem cadastrar goleiros.';
  END IF;

  v_base := lower(regexp_replace(trim(p_nome), '[^a-zA-Z0-9]', '', 'g'));
  IF length(v_base) = 0 THEN
    v_base := 'goleiro';
  END IF;

  v_username := v_base;
  WHILE EXISTS (SELECT 1 FROM jogadores WHERE username = v_username) LOOP
    v_count := v_count + 1;
    v_username := v_base || v_count::text;
  END LOOP;

  INSERT INTO jogadores (
    username,
    senha_hash,
    posicao,
    is_admin,
    is_ativo,
    is_mensalista,
    telefone,
    chave_pix
  )
  VALUES (
    v_username,
    '123',
    'goleiro',
    false,
    true,
    false,
    NULLIF(trim(p_telefone), ''),
    NULLIF(trim(p_chave_pix), '')
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION criar_goleiro_rapido(text, text, text, bigint) TO anon, authenticated;

-- 5.7 Atualizar PIX e Telefone
CREATE OR REPLACE FUNCTION atualizar_dados_pix_telefone(
  p_jogador_id  bigint,
  p_chave_pix   text,
  p_telefone    text,
  p_operador_id bigint
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean := false;
BEGIN
  SELECT is_admin INTO v_is_admin
  FROM jogadores
  WHERE id = p_operador_id;

  IF p_operador_id <> p_jogador_id AND v_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado: você não tem permissão para alterar os dados deste atleta.';
  END IF;

  UPDATE jogadores
  SET
    chave_pix = NULLIF(trim(p_chave_pix), ''),
    telefone  = NULLIF(trim(p_telefone), '')
  WHERE id = p_jogador_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION atualizar_dados_pix_telefone(bigint, text, text, bigint) TO anon, authenticated;

-- 5.8 Alternar Status Ativo/Inativo (Admin)
CREATE OR REPLACE FUNCTION alternar_status_ativo_jogador(
  p_jogador_id bigint,
  p_is_ativo   boolean,
  p_admin_id   bigint
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM jogadores WHERE id = p_admin_id AND is_admin = true) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem alterar o status de jogadores.';
  END IF;

  UPDATE jogadores
  SET is_ativo = p_is_ativo
  WHERE id = p_jogador_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION alternar_status_ativo_jogador(bigint, boolean, bigint) TO anon, authenticated;

-- 5.9 Salvar Lote de Características de Jogadores (Admin)
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
  IF p_admin_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM jogadores WHERE id = p_admin_id AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Apenas administradores podem alterar jogadores.';
  END IF;

  IF p_jogadores IS NULL OR jsonb_typeof(p_jogadores) <> 'array' THEN
    RAISE EXCEPTION 'p_jogadores deve ser um array jsonb.';
  END IF;

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

    IF LOWER(v_username) IN ('dico', 'tadeu', 'natal') THEN
      CONTINUE;
    END IF;

    IF v_novo_mensalista = true AND v_posicao = 'goleiro' THEN
      RAISE EXCEPTION 'Goleiros não pagam para jogar e não podem ser mensalistas (@%).', v_username;
    END IF;

    IF v_novo_admin = true AND v_novo_mensalista = false THEN
      RAISE EXCEPTION 'Apenas jogadores mensalistas podem ser administradores (@%).', v_username;
    END IF;

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

-- 5.10 Obter Partidas Recentes dos Atletas
CREATE OR REPLACE FUNCTION obter_partidas_recentes_jogadores(
  p_meses integer DEFAULT 2
)
RETURNS TABLE (
  jogador_id bigint,
  partidas_recentes bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    pp.jogador_id,
    COUNT(DISTINCT pp.partida_id)::bigint AS partidas_recentes
  FROM partidas_participantes pp
  JOIN partidas p ON p.id = pp.partida_id
  WHERE p.status IN ('live', 'published', 'closed')
    AND p.data_jogo >= (now() - (COALESCE(p_meses, 2) || ' months')::interval)
    AND pp.time IS NOT NULL
  GROUP BY pp.jogador_id;
$$;

GRANT EXECUTE ON FUNCTION obter_partidas_recentes_jogadores(integer) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 6. RPCS: PARTIDAS, CONFIRMAÇÃO E ESCALAÇÃO
-- ----------------------------------------------------------------------------

-- 6.1 Criar Partida Manual (Admin)
CREATE OR REPLACE FUNCTION criar_partida(
  p_data_jogo     timestamptz,
  p_criado_por    bigint,
  p_participantes jsonb
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partida_id bigint;
  elem         jsonb;
BEGIN
  INSERT INTO partidas (data_jogo, status, criado_por)
  VALUES (p_data_jogo, 'draft', p_criado_por)
  RETURNING id INTO v_partida_id;

  FOR elem IN SELECT * FROM jsonb_array_elements(p_participantes)
  LOOP
    INSERT INTO partidas_participantes (
      partida_id,
      jogador_id,
      time,
      posicao,
      gols,
      assistencias,
      gols_contra,
      status_confirmacao,
      confirmado_em
    ) VALUES (
      v_partida_id,
      (elem->>'jogador_id')::bigint,
      (elem->>'time')::char(1),
      (elem->>'posicao')::text,
      COALESCE((elem->>'gols')::integer, 0),
      COALESCE((elem->>'assistencias')::integer, 0),
      COALESCE((elem->>'gols_contra')::integer, 0),
      'confirmado',
      now()
    );
  END LOOP;

  RETURN v_partida_id;
END;
$$;

GRANT EXECUTE ON FUNCTION criar_partida(timestamptz, bigint, jsonb) TO anon, authenticated;

-- 6.2 Criar Partida Semanal com Mensalistas (Cron / Automação)
CREATE OR REPLACE FUNCTION criar_partida_semanal_mensalistas(
  p_criado_por bigint DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hoje_sp               date;
  v_proxima_quinta        timestamptz;
  v_confirmacao_limite    timestamptz;
  v_partida_id            bigint;
  v_admin_id              bigint;
  v_dias_ate_quinta       integer;
  v_dow_hoje              integer;
  v_config_dia            smallint;
  v_config_horario        time;
  v_horas_limite          numeric;
BEGIN
  v_hoje_sp := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_dow_hoje := EXTRACT(DOW FROM (now() AT TIME ZONE 'America/Sao_Paulo'))::integer;

  v_dias_ate_quinta := (4 - v_dow_hoje + 7) % 7;
  IF v_dias_ate_quinta = 0 THEN
    v_dias_ate_quinta := 7;
  END IF;

  v_proxima_quinta := ((v_hoje_sp + v_dias_ate_quinta) || ' 21:00:00')::timestamp
                        AT TIME ZONE 'America/Sao_Paulo';

  IF EXISTS (
    SELECT 1 FROM partidas p
    WHERE date_trunc('week', p.data_jogo AT TIME ZONE 'America/Sao_Paulo')
        = date_trunc('week', v_proxima_quinta AT TIME ZONE 'America/Sao_Paulo')
      AND p.status IN ('draft','live','published','closed')
  ) THEN
    RETURN NULL;
  END IF;

  v_confirmacao_limite := ((v_hoje_sp + v_dias_ate_quinta - 1) || ' 16:00:00')::timestamp
                            AT TIME ZONE 'America/Sao_Paulo';

  IF p_criado_por IS NOT NULL THEN
    v_admin_id := p_criado_por;
  ELSE
    SELECT id INTO v_admin_id FROM jogadores WHERE username = 'dico' LIMIT 1;
    IF v_admin_id IS NULL THEN
      SELECT id INTO v_admin_id FROM jogadores WHERE is_admin = true ORDER BY id LIMIT 1;
    END IF;
  END IF;

  INSERT INTO partidas (data_jogo, status, criado_por, confirmacao_closes_at)
  VALUES (v_proxima_quinta, 'draft', v_admin_id, v_confirmacao_limite)
  RETURNING id INTO v_partida_id;

  INSERT INTO partidas_participantes (
    partida_id,
    jogador_id,
    posicao,
    status_confirmacao
  )
  SELECT
    v_partida_id,
    j.id,
    j.posicao,
    'pendente'
  FROM jogadores j
  WHERE j.is_mensalista = true
    AND j.is_ativo = true
    AND j.posicao <> 'goleiro'
  ORDER BY j.id;

  RETURN v_partida_id;
END;
$$;

GRANT EXECUTE ON FUNCTION criar_partida_semanal_mensalistas(bigint) TO anon, authenticated;

-- 6.3 Confirmar Presença (Atleta / Admin)
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

    IF v_ocupadas >= 14 THEN
      RETURN false;
    END IF;
  END IF;

  UPDATE partidas_participantes
    SET status_confirmacao = p_status,
        confirmado_em = CASE WHEN p_status = 'confirmado' THEN now() ELSE NULL END
    WHERE partida_id = p_partida_id AND jogador_id = p_jogador_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION confirmar_presenca(bigint, bigint, text) TO anon, authenticated;

-- 6.4 Adicionar Participante Avulso na Presença (Admin)
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

  IF v_ocupadas >= 14 THEN
    RETURN false;
  END IF;

  INSERT INTO partidas_participantes (partida_id, jogador_id, posicao, status_confirmacao, confirmado_em)
    SELECT p_partida_id, j.id, j.posicao, 'confirmado', now()
    FROM jogadores j
    WHERE j.id = p_jogador_id;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION adicionar_participante(bigint, bigint) TO anon, authenticated;

-- 6.5 Salvar Times de Linha e Goleiros Escalados (Admin)
CREATE OR REPLACE FUNCTION salvar_times_e_goleiros_partida(
  p_partida_id   bigint,
  p_times_linha  jsonb,
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
  IF p_admin_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM jogadores WHERE id = p_admin_id AND is_admin = true) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem alterar a escalação.';
  END IF;

  IF p_goleiro_a_id = p_goleiro_b_id THEN
    RAISE EXCEPTION 'Os goleiros dos times Preto e Branco devem ser diferentes.';
  END IF;

  FOR elem IN SELECT * FROM jsonb_array_elements(p_times_linha)
  LOOP
    UPDATE partidas_participantes
    SET time = (elem->>'time')::char(1)
    WHERE partida_id = p_partida_id
      AND jogador_id = (elem->>'jogador_id')::bigint;
  END LOOP;

  DELETE FROM partidas_participantes
  WHERE partida_id = p_partida_id
    AND posicao = 'goleiro'
    AND jogador_id NOT IN (p_goleiro_a_id, p_goleiro_b_id)
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_times_linha) l
      WHERE (l->>'jogador_id')::bigint = partidas_participantes.jogador_id
    );

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

-- 6.6 Abrir Partida para Modo Ao Vivo (Admin)
CREATE OR REPLACE FUNCTION abrir_partida(
  p_partida_id bigint,
  p_admin_id   bigint DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
  v_time_a bigint;
  v_time_b bigint;
  v_gk_a   bigint;
  v_gk_b   bigint;
BEGIN
  IF p_admin_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM jogadores WHERE id = p_admin_id AND is_admin = true) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem iniciar a partida.';
  END IF;

  SELECT status INTO v_status
  FROM partidas
  WHERE id = p_partida_id;

  IF v_status IS NULL OR v_status <> 'draft' THEN
    RETURN false;
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE time = 'a' AND posicao <> 'goleiro'),
    COUNT(*) FILTER (WHERE time = 'b' AND posicao <> 'goleiro'),
    COUNT(*) FILTER (WHERE time = 'a' AND posicao = 'goleiro'),
    COUNT(*) FILTER (WHERE time = 'b' AND posicao = 'goleiro')
  INTO v_time_a, v_time_b, v_gk_a, v_gk_b
  FROM partidas_participantes
  WHERE partida_id = p_partida_id
    AND status_confirmacao = 'confirmado';

  IF v_time_a <> 7 OR v_time_b <> 7 THEN
    RETURN false;
  END IF;

  IF v_gk_a <> 1 OR v_gk_b <> 1 THEN
    RETURN false;
  END IF;

  DELETE FROM partida_eventos WHERE partida_id = p_partida_id;

  UPDATE partidas_participantes
  SET gols = 0, assistencias = 0, gols_contra = 0
  WHERE partida_id = p_partida_id
    AND status_confirmacao = 'confirmado';

  UPDATE partidas
  SET status = 'live'
  WHERE id = p_partida_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION abrir_partida(bigint, bigint) TO anon, authenticated;

-- 6.7 Salvar Edição Transacional de Súmula (Admin)
CREATE OR REPLACE FUNCTION salvar_edicao_partida(
  p_partida_id    bigint,
  p_participantes jsonb,
  p_primeira_vez   boolean DEFAULT false
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
  elem jsonb;
  v_novos_ids bigint[];
BEGIN
  SELECT status INTO v_status FROM partidas WHERE id = p_partida_id;
  IF v_status IS NULL THEN
    RETURN false;
  END IF;

  SELECT array_agg((e->>'jogador_id')::bigint)
    INTO v_novos_ids
    FROM jsonb_array_elements(p_participantes) e;

  IF v_novos_ids IS NOT NULL THEN
    DELETE FROM partida_eventos
     WHERE partida_id = p_partida_id
       AND (
         jogador_id NOT IN (SELECT unnest(v_novos_ids))
         OR (assistencia_jogador_id IS NOT NULL AND assistencia_jogador_id NOT IN (SELECT unnest(v_novos_ids)))
       );

    DELETE FROM votes
     WHERE partida_id = p_partida_id
       AND (
         voter_id NOT IN (SELECT unnest(v_novos_ids))
         OR target_id NOT IN (SELECT unnest(v_novos_ids))
       );

    DELETE FROM dividas
     WHERE partida_id = p_partida_id
       AND tipo = 'avulso'
       AND paga = false
       AND jogador_id NOT IN (SELECT unnest(v_novos_ids));

    DELETE FROM dividas
     WHERE partida_id = p_partida_id
       AND tipo = 'avulso'
       AND paga = false
       AND jogador_id IN (
         SELECT (e->>'jogador_id')::bigint
         FROM jsonb_array_elements(p_participantes) e
         WHERE (e->>'posicao')::text = 'goleiro'
       );

    DELETE FROM partidas_participantes
     WHERE partida_id = p_partida_id
       AND jogador_id NOT IN (SELECT unnest(v_novos_ids));
  ELSE
    DELETE FROM partida_eventos WHERE partida_id = p_partida_id;
    DELETE FROM votes WHERE partida_id = p_partida_id;
    DELETE FROM dividas WHERE partida_id = p_partida_id AND tipo = 'avulso' AND paga = false;
    DELETE FROM partidas_participantes WHERE partida_id = p_partida_id;
  END IF;

  FOR elem IN SELECT * FROM jsonb_array_elements(p_participantes)
  LOOP
    INSERT INTO partidas_participantes (
      partida_id,
      jogador_id,
      time,
      posicao,
      gols,
      assistencias,
      gols_contra,
      status_confirmacao,
      confirmado_em
    ) VALUES (
      p_partida_id,
      (elem->>'jogador_id')::bigint,
      (elem->>'time')::char(1),
      (elem->>'posicao')::text,
      COALESCE((elem->>'gols')::integer, 0),
      COALESCE((elem->>'assistencias')::integer, 0),
      COALESCE((elem->>'gols_contra')::integer, 0),
      'confirmado',
      now()
    )
    ON CONFLICT (partida_id, jogador_id)
    DO UPDATE SET
      time               = EXCLUDED.time,
      posicao            = EXCLUDED.posicao,
      gols               = EXCLUDED.gols,
      assistencias       = EXCLUDED.assistencias,
      gols_contra        = EXCLUDED.gols_contra,
      status_confirmacao = 'confirmado';
  END LOOP;

  PERFORM gerar_avulsos_partida(p_partida_id);

  IF p_primeira_vez OR v_status = 'draft' OR v_status = 'live' THEN
    UPDATE partidas
    SET status = 'published',
        published_at = COALESCE(published_at, now()),
        voting_closes_at = COALESCE(voting_closes_at, now() + interval '24 hours')
    WHERE id = p_partida_id;
  END IF;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION salvar_edicao_partida(bigint, jsonb, boolean) TO anon, authenticated;

-- 6.8 Excluir Partida (Admin)
CREATE OR REPLACE FUNCTION excluir_partida(p_partida_id bigint)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM partidas WHERE id = p_partida_id) THEN
    RETURN false;
  END IF;

  DELETE FROM dividas
  WHERE partida_id = p_partida_id
    AND paga = false;

  UPDATE dividas
  SET partida_id = NULL
  WHERE partida_id = p_partida_id
    AND paga = true;

  DELETE FROM partida_eventos WHERE partida_id = p_partida_id;
  DELETE FROM votes WHERE partida_id = p_partida_id;
  DELETE FROM partidas_participantes WHERE partida_id = p_partida_id;
  DELETE FROM partidas WHERE id = p_partida_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION excluir_partida(bigint) TO anon, authenticated;

-- 6.9 Descartar Votos de Partida (Admin)
CREATE OR REPLACE FUNCTION descartar_votos_partida(p_partida_id bigint)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  SELECT status INTO v_status
  FROM partidas
  WHERE id = p_partida_id;

  IF v_status IS NULL OR v_status NOT IN ('published', 'closed') THEN
    RETURN false;
  END IF;

  DELETE FROM votes
  WHERE partida_id = p_partida_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION descartar_votos_partida(bigint) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 7. RPCS: MODO AO VIVO E OPERAÇÃO DE CAMPO
-- ----------------------------------------------------------------------------

-- 7.1 Registrar Evento (Gol / Gol Contra)
CREATE OR REPLACE FUNCTION registrar_evento_partida(
  p_partida_id             bigint,
  p_tipo                   text,
  p_jogador_id             bigint,
  p_time                   text,
  p_assistencia_jogador_id bigint DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status    text;
  v_evento_id bigint;
BEGIN
  SELECT status INTO v_status FROM partidas WHERE id = p_partida_id;
  IF v_status IS NULL OR v_status <> 'live' THEN
    RETURN NULL;
  END IF;

  IF p_tipo NOT IN ('gol', 'gol_contra') THEN
    RETURN NULL;
  END IF;

  INSERT INTO partida_eventos (
    partida_id, tipo, jogador_id, assistencia_jogador_id, time
  ) VALUES (
    p_partida_id, p_tipo, p_jogador_id, p_assistencia_jogador_id, p_time
  )
  RETURNING id INTO v_evento_id;

  IF p_tipo = 'gol' THEN
    UPDATE partidas_participantes
    SET gols = gols + 1
    WHERE partida_id = p_partida_id AND jogador_id = p_jogador_id;

    IF p_assistencia_jogador_id IS NOT NULL THEN
      UPDATE partidas_participantes
      SET assistencias = assistencias + 1
      WHERE partida_id = p_partida_id AND jogador_id = p_assistencia_jogador_id;
    END IF;
  ELSIF p_tipo = 'gol_contra' THEN
    UPDATE partidas_participantes
    SET gols_contra = gols_contra + 1
    WHERE partida_id = p_partida_id AND jogador_id = p_jogador_id;
  END IF;

  RETURN v_evento_id;
END;
$$;

GRANT EXECUTE ON FUNCTION registrar_evento_partida(bigint, text, bigint, text, bigint) TO anon, authenticated;

-- 7.2 Editar Evento
CREATE OR REPLACE FUNCTION editar_evento_partida(
  p_evento_id              bigint,
  p_jogador_id             bigint,
  p_assistencia_jogador_id bigint,
  p_time                   text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_evento partida_eventos%ROWTYPE;
  v_status text;
BEGIN
  SELECT * INTO v_evento FROM partida_eventos WHERE id = p_evento_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  SELECT status INTO v_status FROM partidas WHERE id = v_evento.partida_id;
  IF v_status IS NULL OR v_status <> 'live' THEN
    RETURN false;
  END IF;

  IF v_evento.tipo = 'gol' THEN
    UPDATE partidas_participantes
    SET gols = GREATEST(0, gols - 1)
    WHERE partida_id = v_evento.partida_id AND jogador_id = v_evento.jogador_id;

    IF v_evento.assistencia_jogador_id IS NOT NULL THEN
      UPDATE partidas_participantes
      SET assistencias = GREATEST(0, assistencias - 1)
      WHERE partida_id = v_evento.partida_id AND jogador_id = v_evento.assistencia_jogador_id;
    END IF;

    UPDATE partidas_participantes
    SET gols = gols + 1
    WHERE partida_id = v_evento.partida_id AND jogador_id = p_jogador_id;

    IF p_assistencia_jogador_id IS NOT NULL THEN
      UPDATE partidas_participantes
      SET assistencias = assistencias + 1
      WHERE partida_id = v_evento.partida_id AND jogador_id = p_assistencia_jogador_id;
    END IF;
  ELSIF v_evento.tipo = 'gol_contra' THEN
    UPDATE partidas_participantes
    SET gols_contra = GREATEST(0, gols_contra - 1)
    WHERE partida_id = v_evento.partida_id AND jogador_id = v_evento.jogador_id;

    UPDATE partidas_participantes
    SET gols_contra = gols_contra + 1
    WHERE partida_id = v_evento.partida_id AND jogador_id = p_jogador_id;
  END IF;

  UPDATE partida_eventos
  SET jogador_id = p_jogador_id,
      assistencia_jogador_id = p_assistencia_jogador_id,
      time = p_time
  WHERE id = p_evento_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION editar_evento_partida(bigint, bigint, bigint, text) TO anon, authenticated;

-- 7.3 Remover Evento
CREATE OR REPLACE FUNCTION remover_evento_partida(p_evento_id bigint)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_evento partida_eventos%ROWTYPE;
  v_status text;
BEGIN
  SELECT * INTO v_evento FROM partida_eventos WHERE id = p_evento_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  SELECT status INTO v_status FROM partidas WHERE id = v_evento.partida_id;
  IF v_status IS NULL OR v_status <> 'live' THEN
    RETURN false;
  END IF;

  IF v_evento.tipo = 'gol' THEN
    UPDATE partidas_participantes
    SET gols = GREATEST(0, gols - 1)
    WHERE partida_id = v_evento.partida_id AND jogador_id = v_evento.jogador_id;

    IF v_evento.assistencia_jogador_id IS NOT NULL THEN
      UPDATE partidas_participantes
      SET assistencias = GREATEST(0, assistencias - 1)
      WHERE partida_id = v_evento.partida_id AND jogador_id = v_evento.assistencia_jogador_id;
    END IF;
  ELSIF v_evento.tipo = 'gol_contra' THEN
    UPDATE partidas_participantes
    SET gols_contra = GREATEST(0, gols_contra - 1)
    WHERE partida_id = v_evento.partida_id AND jogador_id = v_evento.jogador_id;
  END IF;

  DELETE FROM partida_eventos WHERE id = p_evento_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION remover_evento_partida(bigint) TO anon, authenticated;

-- 7.4 Finalizar Partida (Encerrar Campo e Abrir Votação)
CREATE OR REPLACE FUNCTION finalizar_partida(p_partida_id bigint)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  SELECT status INTO v_status
  FROM partidas
  WHERE id = p_partida_id;

  IF v_status IS NULL OR v_status <> 'live' THEN
    RETURN false;
  END IF;

  UPDATE partidas
  SET status           = 'published',
      published_at     = now(),
      voting_closes_at = now() + interval '24 hours'
  WHERE id = p_partida_id;

  PERFORM gerar_avulsos_partida(p_partida_id);
  PERFORM executar_eventos_financeiros_partida(p_partida_id);

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION finalizar_partida(bigint) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 8. RPCS: VOTAÇÃO E NOTAS
-- ----------------------------------------------------------------------------

-- 8.1 Registrar Cédula Secreta de Votos
CREATE OR REPLACE FUNCTION registrar_votos(
  p_partida_id  bigint,
  p_voter_id    bigint,
  p_votos       jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status           text;
  v_voting_closes_at timestamptz;
  elem               jsonb;
  v_target_id        bigint;
  v_rating           smallint;
BEGIN
  SELECT status, voting_closes_at
  INTO v_status, v_voting_closes_at
  FROM partidas
  WHERE id = p_partida_id;

  IF v_status IS NULL
     OR v_status <> 'published'
     OR v_voting_closes_at IS NULL
     OR v_voting_closes_at <= now() THEN
    RETURN false;
  END IF;

  PERFORM 1
    FROM partidas_participantes
    WHERE partida_id = p_partida_id
      AND jogador_id = p_voter_id
      AND posicao <> 'goleiro';
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  PERFORM 1
    FROM jogadores
    WHERE id = p_voter_id
      AND username NOT ILIKE 'random%';
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  FOR elem IN SELECT * FROM jsonb_array_elements(p_votos)
  LOOP
    v_target_id := (elem->>'target_id')::bigint;
    v_rating    := (elem->>'rating')::smallint;

    IF v_rating < 1 OR v_rating > 10 THEN
      RETURN false;
    END IF;

    IF v_target_id = p_voter_id THEN
      RETURN false;
    END IF;

    PERFORM 1
      FROM partidas_participantes
      WHERE partida_id = p_partida_id
        AND jogador_id = v_target_id;
    IF NOT FOUND THEN
      RETURN false;
    END IF;

    PERFORM 1
      FROM jogadores
      WHERE id = v_target_id
        AND username NOT ILIKE 'random%';
    IF NOT FOUND THEN
      RETURN false;
    END IF;

    INSERT INTO votes (partida_id, voter_id, target_id, rating)
    VALUES (p_partida_id, p_voter_id, v_target_id, v_rating)
    ON CONFLICT (partida_id, voter_id, target_id)
    DO UPDATE SET rating = EXCLUDED.rating;
  END LOOP;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION registrar_votos(bigint, bigint, jsonb) TO anon, authenticated;

-- 8.2 Publicar Partida (Manual / Fora do Ao Vivo)
CREATE OR REPLACE FUNCTION publicar_partida(p_partida_id bigint)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  SELECT status INTO v_status
  FROM partidas
  WHERE id = p_partida_id;

  IF v_status IS NULL OR v_status <> 'draft' THEN
    RETURN false;
  END IF;

  UPDATE partidas
  SET status           = 'published',
      published_at     = now(),
      voting_closes_at = now() + interval '24 hours'
  WHERE id = p_partida_id;

  PERFORM gerar_avulsos_partida(p_partida_id);

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION publicar_partida(bigint) TO anon, authenticated;

-- 8.3 Obter Médias de Notas de Todos os Jogadores
CREATE OR REPLACE FUNCTION obter_medias_notas_jogadores()
RETURNS TABLE (
  jogador_id bigint,
  media_nota numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    v.target_id AS jogador_id,
    ROUND(
      media_aparada(SUM(v.rating), MIN(v.rating), MAX(v.rating), COUNT(*)),
      2
    ) AS media_nota
  FROM votes v
  GROUP BY v.target_id;
$$;

GRANT EXECUTE ON FUNCTION obter_medias_notas_jogadores() TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 9. RPCS: FINANCEIRO E EVENTOS AUTOMÁTICOS
-- ----------------------------------------------------------------------------

-- 9.1 Gerar Avulsos da Partida
CREATE OR REPLACE FUNCTION gerar_avulsos_partida(p_partida_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO dividas (jogador_id, tipo, valor, partida_id, data_divida, referencia, descricao)
  SELECT
    pp.jogador_id,
    'avulso',
    20.00,
    p.id,
    (p.data_jogo AT TIME ZONE 'America/Sao_Paulo')::date,
    to_char(p.data_jogo AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM'),
    'Avulso — partida ' || to_char(p.data_jogo AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY')
  FROM partidas_participantes pp
  JOIN jogadores j ON j.id = pp.jogador_id
  JOIN partidas   p ON p.id = pp.partida_id
  WHERE pp.partida_id = p_partida_id
    AND j.is_mensalista = false
    AND pp.posicao <> 'goleiro'
    AND j.posicao <> 'goleiro'
  ON CONFLICT DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION gerar_avulsos_partida(bigint) TO anon, authenticated;

-- 9.2 Executar Eventos Financeiros Mensais (Cron / Manual)
CREATE OR REPLACE FUNCTION executar_eventos_financeiros_mensais(
  p_data_referencia date DEFAULT current_date
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ev RECORD;
  v_jg RECORD;
  v_ref text;
  v_desc text;
  v_gerados integer := 0;
BEGIN
  v_ref := to_char(p_data_referencia, 'YYYY-MM');

  FOR v_ev IN
    SELECT *
    FROM eventos_financeiros_automaticos
    WHERE ativo = true
      AND gatilho = 'mensal'
  LOOP
    IF v_ev.destino = 'caixa' THEN
      v_desc := substituir_template_financeiro(v_ev.descricao_template, p_data_referencia, NULL);
      INSERT INTO dividas (
        jogador_id, tipo, valor, data_divida, descricao, referencia, natureza, evento_automatico_id
      )
      VALUES (
        NULL, v_ev.tipo, v_ev.valor, p_data_referencia, v_desc, v_ref, v_ev.natureza, v_ev.id
      )
      ON CONFLICT DO NOTHING;
      IF FOUND THEN
        v_gerados := v_gerados + 1;
      END IF;

    ELSIF v_ev.destino = 'mensalistas' THEN
      FOR v_jg IN
        SELECT id, username
        FROM jogadores
        WHERE is_ativo = true
          AND is_mensalista = true
          AND posicao <> 'goleiro'
      LOOP
        v_desc := substituir_template_financeiro(v_ev.descricao_template, p_data_referencia, v_jg.username);
        INSERT INTO dividas (
          jogador_id, tipo, valor, data_divida, descricao, referencia, natureza, evento_automatico_id
        )
        VALUES (
          v_jg.id, v_ev.tipo, v_ev.valor, p_data_referencia, v_desc, v_ref, v_ev.natureza, v_ev.id
        )
        ON CONFLICT DO NOTHING;
        IF FOUND THEN
          v_gerados := v_gerados + 1;
        END IF;
      END LOOP;

    ELSIF v_ev.destino = 'jogador_fixo' AND v_ev.jogador_id IS NOT NULL THEN
      SELECT username INTO v_jg FROM jogadores WHERE id = v_ev.jogador_id;
      v_desc := substituir_template_financeiro(v_ev.descricao_template, p_data_referencia, v_jg.username);
      INSERT INTO dividas (
        jogador_id, tipo, valor, data_divida, descricao, referencia, natureza, evento_automatico_id
      )
      VALUES (
        v_ev.jogador_id, v_ev.tipo, v_ev.valor, p_data_referencia, v_desc, v_ref, v_ev.natureza, v_ev.id
      )
      ON CONFLICT DO NOTHING;
      IF FOUND THEN
        v_gerados := v_gerados + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN v_gerados;
END;
$$;

GRANT EXECUTE ON FUNCTION executar_eventos_financeiros_mensais(date) TO anon, authenticated;

-- 9.3 Executar Eventos Financeiros por Fim de Partida
CREATE OR REPLACE FUNCTION executar_eventos_financeiros_partida(p_partida_id bigint)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ev RECORD;
  v_gk RECORD;
  v_data_jogo date;
  v_ref text;
  v_desc text;
  v_gerados integer := 0;
BEGIN
  SELECT (data_jogo AT TIME ZONE 'America/Sao_Paulo')::date
    INTO v_data_jogo
    FROM partidas
    WHERE id = p_partida_id;

  IF v_data_jogo IS NULL THEN
    RETURN 0;
  END IF;

  v_ref := to_char(v_data_jogo, 'YYYY-MM');

  FOR v_ev IN
    SELECT *
    FROM eventos_financeiros_automaticos
    WHERE ativo = true
      AND gatilho = 'fim_partida'
  LOOP
    IF v_ev.destino = 'caixa' THEN
      v_desc := substituir_template_financeiro(v_ev.descricao_template, v_data_jogo, NULL);
      INSERT INTO dividas (
        jogador_id, tipo, valor, data_divida, descricao, referencia, partida_id, natureza, evento_automatico_id
      )
      VALUES (
        NULL, v_ev.tipo, v_ev.valor, v_data_jogo, v_desc, v_ref, p_partida_id, v_ev.natureza, v_ev.id
      )
      ON CONFLICT DO NOTHING;
      IF FOUND THEN
        v_gerados := v_gerados + 1;
      END IF;

    ELSIF v_ev.destino = 'goleiros_partida' THEN
      FOR v_gk IN
        SELECT pp.jogador_id, j.username
        FROM partidas_participantes pp
        JOIN jogadores j ON j.id = pp.jogador_id
        WHERE pp.partida_id = p_partida_id
          AND pp.posicao = 'goleiro'
      LOOP
        v_desc := substituir_template_financeiro(v_ev.descricao_template, v_data_jogo, v_gk.username);
        INSERT INTO dividas (
          jogador_id, tipo, valor, data_divida, descricao, referencia, partida_id, natureza, evento_automatico_id
        )
        VALUES (
          v_gk.jogador_id, v_ev.tipo, v_ev.valor, v_data_jogo, v_desc, v_ref, p_partida_id, v_ev.natureza, v_ev.id
        )
        ON CONFLICT DO NOTHING;
        IF FOUND THEN
          v_gerados := v_gerados + 1;
        END IF;
      END LOOP;

    ELSIF v_ev.destino = 'jogador_fixo' AND v_ev.jogador_id IS NOT NULL THEN
      SELECT username INTO v_gk FROM jogadores WHERE id = v_ev.jogador_id;
      v_desc := substituir_template_financeiro(v_ev.descricao_template, v_data_jogo, v_gk.username);
      INSERT INTO dividas (
        jogador_id, tipo, valor, data_divida, descricao, referencia, partida_id, natureza, evento_automatico_id
      )
      VALUES (
        v_ev.jogador_id, v_ev.tipo, v_ev.valor, v_data_jogo, v_desc, v_ref, p_partida_id, v_ev.natureza, v_ev.id
      )
      ON CONFLICT DO NOTHING;
      IF FOUND THEN
        v_gerados := v_gerados + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN v_gerados;
END;
$$;

GRANT EXECUTE ON FUNCTION executar_eventos_financeiros_partida(bigint) TO anon, authenticated;

-- 9.4 Registrar Lançamento Manual (Receita / Despesa)
CREATE OR REPLACE FUNCTION registrar_divida(
  p_jogador_id  bigint,
  p_tipo        text,
  p_valor       numeric,
  p_data_divida date,
  p_descricao   text,
  p_referencia  text,
  p_partida_id  bigint,
  p_natureza    text DEFAULT 'receita'
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id       bigint;
  v_natureza text;
BEGIN
  IF p_valor IS NULL OR p_valor <= 0 THEN
    RAISE EXCEPTION 'Valor do lançamento deve ser maior que zero.';
  END IF;

  v_natureza := COALESCE(NULLIF(trim(p_natureza), ''), 'receita');
  IF v_natureza NOT IN ('receita', 'despesa') THEN
    RAISE EXCEPTION 'Natureza inválida. Use receita ou despesa.';
  END IF;

  IF p_tipo NOT IN ('mensalidade', 'avulso', 'outro', 'goleiro', 'campo', 'eventos') THEN
    RAISE EXCEPTION 'Tipo de lançamento inválido.';
  END IF;

  IF v_natureza = 'receita' AND p_jogador_id IS NULL THEN
    RAISE EXCEPTION 'Receita exige um jogador.';
  END IF;

  INSERT INTO dividas (
    jogador_id, tipo, valor, data_divida, descricao, referencia, partida_id, natureza
  )
  VALUES (
    p_jogador_id,
    p_tipo,
    p_valor,
    COALESCE(p_data_divida, current_date),
    p_descricao,
    p_referencia,
    p_partida_id,
    v_natureza
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION registrar_divida(bigint, text, numeric, date, text, text, bigint, text) TO anon, authenticated;

-- 9.5 Quitar Lançamento Individual
CREATE OR REPLACE FUNCTION quitar_divida(p_divida_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE dividas
     SET paga = true, data_pagamento = current_date
   WHERE id = p_divida_id;
END;
$$;

GRANT EXECUTE ON FUNCTION quitar_divida(bigint) TO anon, authenticated;

-- 9.6 Quitar Todas as Receitas de um Jogador
CREATE OR REPLACE FUNCTION quitar_dividas_jogador(p_jogador_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE dividas
     SET paga = true, data_pagamento = current_date
   WHERE jogador_id = p_jogador_id
     AND paga = false
     AND natureza = 'receita';
END;
$$;

GRANT EXECUTE ON FUNCTION quitar_dividas_jogador(bigint) TO anon, authenticated;

-- 9.7 Reverter Quitação de Lançamento
CREATE OR REPLACE FUNCTION reverter_quitacao_divida(p_divida_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE dividas
     SET paga = false, data_pagamento = NULL
   WHERE id = p_divida_id;
END;
$$;

GRANT EXECUTE ON FUNCTION reverter_quitacao_divida(bigint) TO anon, authenticated;

-- 9.8 Salvar / Atualizar Evento Financeiro Automático (Admin)
CREATE OR REPLACE FUNCTION salvar_evento_financeiro_automatico(
  p_admin_id bigint,
  p_evento   jsonb
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_id       bigint;
  v_gatilho  text;
  v_natureza text;
  v_tipo     text;
  v_valor    numeric;
  v_destino  text;
  v_jog_id   bigint;
  v_desc_tpl text;
  v_ref_tpl  text;
  v_ativo    boolean;
  v_nome     text;
BEGIN
  SELECT is_admin INTO v_is_admin FROM jogadores WHERE id = p_admin_id;
  IF v_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'Apenas administradores podem gerenciar automações financeiras.';
  END IF;

  v_id       := (p_evento->>'id')::bigint;
  v_nome     := trim(p_evento->>'nome');
  v_gatilho  := trim(p_evento->>'gatilho');
  v_natureza := trim(p_evento->>'natureza');
  v_tipo     := trim(p_evento->>'tipo');
  v_valor    := (p_evento->>'valor')::numeric;
  v_destino  := trim(p_evento->>'destino');
  v_jog_id   := (p_evento->>'jogador_id')::bigint;
  v_desc_tpl := trim(p_evento->>'descricao_template');
  v_ref_tpl  := NULLIF(trim(p_evento->>'referencia_template'), '');
  v_ativo    := COALESCE((p_evento->>'ativo')::boolean, true);

  IF v_nome IS NULL OR length(v_nome) = 0 THEN
    RAISE EXCEPTION 'Nome do evento é obrigatório.';
  END IF;
  IF v_valor IS NULL OR v_valor <= 0 THEN
    RAISE EXCEPTION 'Valor deve ser positivo.';
  END IF;
  IF v_desc_tpl IS NULL OR length(v_desc_tpl) = 0 THEN
    RAISE EXCEPTION 'Template de descrição é obrigatório.';
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO eventos_financeiros_automaticos (
      nome, gatilho, natureza, tipo, valor, destino, jogador_id, descricao_template, referencia_template, ativo
    )
    VALUES (
      v_nome, v_gatilho, v_natureza, v_tipo, v_valor, v_destino, v_jog_id, v_desc_tpl, v_ref_tpl, v_ativo
    )
    RETURNING id INTO v_id;
  ELSE
    UPDATE eventos_financeiros_automaticos
    SET
      nome = v_nome,
      gatilho = v_gatilho,
      natureza = v_natureza,
      tipo = v_tipo,
      valor = v_valor,
      destino = v_destino,
      jogador_id = v_jog_id,
      descricao_template = v_desc_tpl,
      referencia_template = v_ref_tpl,
      ativo = v_ativo
    WHERE id = v_id;
  END IF;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION salvar_evento_financeiro_automatico(bigint, jsonb) TO anon, authenticated;

-- 9.9 Excluir Evento Financeiro Automático (Admin)
CREATE OR REPLACE FUNCTION excluir_evento_financeiro_automatico(
  p_admin_id  bigint,
  p_evento_id bigint
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  SELECT is_admin INTO v_is_admin FROM jogadores WHERE id = p_admin_id;
  IF v_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'Apenas administradores podem gerenciar automações financeiras.';
  END IF;

  DELETE FROM eventos_financeiros_automaticos WHERE id = p_evento_id;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION excluir_evento_financeiro_automatico(bigint, bigint) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 10. RPCS: CONFIGURAÇÕES E PUSH NOTIFICATIONS
-- ----------------------------------------------------------------------------

-- 10.1 Salvar Configurações Globais e Reagendar Cron de Confirmação
CREATE OR REPLACE FUNCTION salvar_configuracoes_notificacoes(
  p_admin_id bigint,
  p_config   jsonb
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $rpc$
DECLARE
  v_is_admin   boolean;
  v_dia_semana smallint;
  v_horario    time;
  v_minuto     integer;
  v_hora_utc   integer;
  v_cron_expr  text;
  v_reagendar  boolean := false;
BEGIN
  SELECT is_admin INTO v_is_admin FROM jogadores WHERE id = p_admin_id;
  IF v_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso restrito a administradores.';
  END IF;

  IF p_config IS NULL THEN
    RETURN false;
  END IF;

  IF p_config ? 'confirmacao_dia_semana' OR p_config ? 'confirmacao_horario' THEN
    v_reagendar := true;
  END IF;

  UPDATE notificacoes_config
  SET
    confirmacao_ativo = COALESCE((p_config->>'confirmacao_ativo')::boolean, confirmacao_ativo),
    confirmacao_dia_semana = COALESCE((p_config->>'confirmacao_dia_semana')::smallint, confirmacao_dia_semana),
    confirmacao_horario = COALESCE((p_config->>'confirmacao_horario')::time, confirmacao_horario),
    confirmacao_titulo = CASE WHEN p_config ? 'confirmacao_titulo' THEN (p_config->>'confirmacao_titulo') ELSE confirmacao_titulo END,
    confirmacao_mensagem = CASE WHEN p_config ? 'confirmacao_mensagem' THEN (p_config->>'confirmacao_mensagem') ELSE confirmacao_mensagem END,
    reforco_ativo = COALESCE((p_config->>'reforco_ativo')::boolean, reforco_ativo),
    reforco_horas_antes_prazo = COALESCE((p_config->>'reforco_horas_antes_prazo')::smallint, reforco_horas_antes_prazo),
    reforco_titulo = CASE WHEN p_config ? 'reforco_titulo' THEN (p_config->>'reforco_titulo') ELSE reforco_titulo END,
    reforco_mensagem = CASE WHEN p_config ? 'reforco_mensagem' THEN (p_config->>'reforco_mensagem') ELSE reforco_mensagem END,
    votacao_ativo = COALESCE((p_config->>'votacao_ativo')::boolean, votacao_ativo),
    votacao_bucket_6h = COALESCE((p_config->>'votacao_bucket_6h')::boolean, votacao_bucket_6h),
    votacao_bucket_3h = COALESCE((p_config->>'votacao_bucket_3h')::boolean, votacao_bucket_3h),
    votacao_bucket_1h = COALESCE((p_config->>'votacao_bucket_1h')::boolean, votacao_bucket_1h),
    votacao_bucket_30m = COALESCE((p_config->>'votacao_bucket_30m')::boolean, votacao_bucket_30m),
    votacao_template_6h_titulo = CASE WHEN p_config ? 'votacao_template_6h_titulo' THEN (p_config->>'votacao_template_6h_titulo') ELSE votacao_template_6h_titulo END,
    votacao_template_6h_msg = CASE WHEN p_config ? 'votacao_template_6h_msg' THEN (p_config->>'votacao_template_6h_msg') ELSE votacao_template_6h_msg END,
    votacao_template_3h_titulo = CASE WHEN p_config ? 'votacao_template_3h_titulo' THEN (p_config->>'votacao_template_3h_titulo') ELSE votacao_template_3h_titulo END,
    votacao_template_3h_msg = CASE WHEN p_config ? 'votacao_template_3h_msg' THEN (p_config->>'votacao_template_3h_msg') ELSE votacao_template_3h_msg END,
    votacao_template_1h_titulo = CASE WHEN p_config ? 'votacao_template_1h_titulo' THEN (p_config->>'votacao_template_1h_titulo') ELSE votacao_template_1h_titulo END,
    votacao_template_1h_msg = CASE WHEN p_config ? 'votacao_template_1h_msg' THEN (p_config->>'votacao_template_1h_msg') ELSE votacao_template_1h_msg END,
    votacao_template_30m_titulo = CASE WHEN p_config ? 'votacao_template_30m_titulo' THEN (p_config->>'votacao_template_30m_titulo') ELSE votacao_template_30m_titulo END,
    votacao_template_30m_msg = CASE WHEN p_config ? 'votacao_template_30m_msg' THEN (p_config->>'votacao_template_30m_msg') ELSE votacao_template_30m_msg END,
    updated_at = now(),
    updated_by = p_admin_id
  WHERE id = 1
  RETURNING confirmacao_dia_semana, confirmacao_horario INTO v_dia_semana, v_horario;

  IF v_reagendar THEN
    v_minuto := EXTRACT(MINUTE FROM v_horario)::integer;
    v_hora_utc := (EXTRACT(HOUR FROM v_horario)::integer + 3) % 24;
    v_cron_expr := format('%s %s * * %s', v_minuto, v_hora_utc, v_dia_semana);

    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'agendar-partida-semanal') THEN
      PERFORM cron.unschedule('agendar-partida-semanal');
    END IF;

    PERFORM cron.schedule(
      'agendar-partida-semanal',
      v_cron_expr,
      $semanal$
      DO $$
      DECLARE
        v_partida_id bigint;
        v_secret     text;
      BEGIN
        SELECT criar_partida_semanal_mensalistas() INTO v_partida_id;
        IF v_partida_id IS NULL THEN
          SELECT p.id INTO v_partida_id
            FROM partidas p
            WHERE p.status = 'draft'
              AND date_trunc('week', p.data_jogo AT TIME ZONE 'America/Sao_Paulo') = date_trunc('week', now() AT TIME ZONE 'America/Sao_Paulo')
            ORDER BY p.id DESC
            LIMIT 1;
        END IF;

        IF v_partida_id IS NOT NULL THEN
          SELECT decrypted_secret INTO v_secret
            FROM vault.decrypted_secrets
            WHERE name = 'push_cron_secret'
            LIMIT 1;
          PERFORM net.http_post(
            url := 'https://jtavmrlllyctkuxefhpc.supabase.co/functions/v1/send-confirmation-requests',
            headers := jsonb_build_object(
              'Content-Type', 'application/json',
              'x-push-cron-secret', v_secret
            ),
            body := jsonb_build_object('partida_id', v_partida_id)
          );
        END IF;
      END $$;
      $semanal$
    );
  END IF;

  RETURN true;
END;
$rpc$;

GRANT EXECUTE ON FUNCTION salvar_configuracoes_notificacoes(bigint, jsonb) TO anon, authenticated;

-- 10.2 Listar Pendentes de Votação (Candidatos + Subscriptions em 1 Round-Trip)
CREATE OR REPLACE FUNCTION listar_pendentes_votacao(
  p_janela_maxima_interval interval DEFAULT interval '6 hours 10 minutes'
)
RETURNS TABLE (
  partida_id       bigint,
  jogador_id       bigint,
  voting_closes_at timestamptz,
  subscriptions    jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id                                              AS partida_id,
    pp.jogador_id                                     AS jogador_id,
    p.voting_closes_at                                AS voting_closes_at,
    jsonb_agg(
      jsonb_build_object(
        'endpoint', ps.endpoint,
        'p256dh', ps.p256dh,
        'auth', ps.auth
      )
    )                                                 AS subscriptions
  FROM partidas p
  JOIN partidas_participantes pp ON pp.partida_id = p.id
  JOIN jogadores j ON j.id = pp.jogador_id
  JOIN push_subscriptions ps ON ps.jogador_id = pp.jogador_id
  WHERE p.status = 'published'
    AND p.voting_closes_at > now()
    AND p.voting_closes_at <= now() + COALESCE(p_janela_maxima_interval, interval '6 hours 10 minutes')
    AND pp.posicao <> 'goleiro'
    AND j.is_ativo = true
    AND j.posicao <> 'random'
    AND j.username NOT ILIKE 'random%'
    AND NOT EXISTS (
      SELECT 1 FROM votes v
      WHERE v.partida_id = pp.partida_id
        AND v.voter_id = pp.jogador_id
    )
  GROUP BY p.id, pp.jogador_id, p.voting_closes_at;
$$;

GRANT EXECUTE ON FUNCTION listar_pendentes_votacao(interval) TO anon, authenticated;

-- 10.3 Listar Pendentes de Confirmação (Candidatos + Subscriptions em 1 Round-Trip)
CREATE OR REPLACE FUNCTION listar_pendentes_confirmacao(
  p_partida_id bigint DEFAULT NULL
)
RETURNS TABLE (
  partida_id            bigint,
  jogador_id            bigint,
  data_jogo             timestamptz,
  confirmacao_closes_at timestamptz,
  subscriptions         jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_partida_id bigint;
BEGIN
  IF p_partida_id IS NOT NULL THEN
    SELECT id INTO v_target_partida_id
    FROM partidas
    WHERE id = p_partida_id AND status = 'draft';
  ELSE
    SELECT id INTO v_target_partida_id
    FROM partidas
    WHERE status = 'draft' AND confirmacao_closes_at IS NOT NULL
    ORDER BY id DESC
    LIMIT 1;
  END IF;

  IF v_target_partida_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.id                                              AS partida_id,
    pp.jogador_id                                     AS jogador_id,
    p.data_jogo                                       AS data_jogo,
    p.confirmacao_closes_at                           AS confirmacao_closes_at,
    jsonb_agg(
      jsonb_build_object(
        'endpoint', ps.endpoint,
        'p256dh', ps.p256dh,
        'auth', ps.auth
      )
    )                                                 AS subscriptions
  FROM partidas p
  JOIN partidas_participantes pp ON pp.partida_id = p.id
  JOIN jogadores j ON j.id = pp.jogador_id
  JOIN push_subscriptions ps ON ps.jogador_id = pp.jogador_id
  WHERE p.id = v_target_partida_id
    AND p.status = 'draft'
    AND pp.status_confirmacao = 'pendente'
    AND pp.posicao <> 'goleiro'
    AND j.is_ativo = true
    AND j.posicao <> 'random'
    AND j.username NOT ILIKE 'random%'
  GROUP BY p.id, pp.jogador_id, p.data_jogo, p.confirmacao_closes_at;
END;
$$;

GRANT EXECUTE ON FUNCTION listar_pendentes_confirmacao(bigint) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 11. RPCS: RELATÓRIOS E ESTATÍSTICAS
-- ----------------------------------------------------------------------------

-- 11.1 Boletim Oficial da Temporada (Resumo do Ano)
CREATE OR REPLACE FUNCTION resumo_ano(p_ano integer)
RETURNS TABLE (
  ano integer,
  total_partidas bigint,
  artilheiro_jogador_id bigint,
  artilheiro_username text,
  artilheiro_gols bigint,
  artilheiro_partidas bigint,
  maestro_jogador_id bigint,
  maestro_username text,
  maestro_assistencias bigint,
  maestro_partidas bigint,
  participante_jogador_id bigint,
  participante_username text,
  participante_partidas bigint,
  eficiente_jogador_id bigint,
  eficiente_username text,
  eficiente_vitorias bigint,
  eficiente_partidas bigint,
  eficiente_percentual numeric,
  sequencia_vitorias_jogador_id bigint,
  sequencia_vitorias_username text,
  sequencia_vitorias bigint,
  seca_vitorias_jogador_id bigint,
  seca_vitorias_username text,
  seca_vitorias bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH partidas_ano AS (
    SELECT DISTINCT l.partida_id AS id, l.data_jogo
    FROM v_levantamento l
    WHERE EXTRACT(
        YEAR FROM l.data_jogo AT TIME ZONE 'America/Sao_Paulo'
      )::integer = p_ano
  ),
  total AS (
    SELECT COUNT(*)::bigint AS partidas
    FROM partidas_ano
  ),
  stats AS (
    SELECT
      l.jogador_id,
      j.username,
      COUNT(*)::bigint AS partidas,
      SUM(l.gols)::bigint AS gols,
      SUM(l.assistencias)::bigint AS assistencias,
      COUNT(*) FILTER (WHERE l.vitoria)::bigint AS vitorias
    FROM v_levantamento l
    JOIN jogadores j ON j.id = l.jogador_id
    WHERE j.posicao <> 'random'
      AND EXTRACT(
        YEAR FROM l.data_jogo AT TIME ZONE 'America/Sao_Paulo'
      )::integer = p_ano
    GROUP BY l.jogador_id, j.username
  ),
  stats_elegiveis AS (
    SELECT s.*
    FROM stats s
    CROSS JOIN total t
    WHERE t.partidas > 0
      AND (s.partidas::numeric / t.partidas) >= 0.33
  ),
  jogador_partidas AS (
    SELECT
      l.jogador_id,
      j.username,
      l.partida_id,
      l.data_jogo,
      l.vitoria AS venceu,
      ROW_NUMBER() OVER (
        PARTITION BY l.jogador_id
        ORDER BY l.data_jogo DESC, l.partida_id DESC
      ) AS rn
    FROM v_levantamento l
    JOIN jogadores j ON j.id = l.jogador_id
    WHERE j.posicao <> 'random'
      AND EXTRACT(
        YEAR FROM l.data_jogo AT TIME ZONE 'America/Sao_Paulo'
      )::integer = p_ano
  ),
  jogador_primeira_derrota AS (
    SELECT
      jogador_id,
      username,
      MIN(rn) FILTER (WHERE NOT venceu) AS first_loss_rn,
      MAX(rn) AS total_jogos
    FROM jogador_partidas
    GROUP BY jogador_id, username
  ),
  sequencias_vitorias_atuais AS (
    SELECT
      jogador_id,
      username,
      COALESCE(first_loss_rn - 1, total_jogos)::bigint AS tamanho
    FROM jogador_primeira_derrota
  ),
  jogador_primeira_vitoria AS (
    SELECT
      jogador_id,
      username,
      MIN(rn) FILTER (WHERE venceu) AS first_win_rn,
      MAX(rn) AS total_jogos
    FROM jogador_partidas
    GROUP BY jogador_id, username
  ),
  secas_vitorias_atuais AS (
    SELECT
      jogador_id,
      username,
      COALESCE(first_win_rn - 1, total_jogos)::bigint AS tamanho
    FROM jogador_primeira_vitoria
  ),
  artilheiro AS (
    SELECT s.jogador_id, s.username, s.gols, s.partidas
    FROM stats_elegiveis s
    WHERE s.gols > 0
    ORDER BY s.gols DESC, s.partidas DESC, s.username ASC
    LIMIT 1
  ),
  maestro AS (
    SELECT s.jogador_id, s.username, s.assistencias, s.partidas
    FROM stats_elegiveis s
    WHERE s.assistencias > 0
    ORDER BY s.assistencias DESC, s.partidas DESC, s.username ASC
    LIMIT 1
  ),
  participante AS (
    SELECT s.jogador_id, s.username, s.partidas
    FROM stats s
    ORDER BY s.partidas DESC, s.gols DESC, s.username ASC
    LIMIT 1
  ),
  eficiente AS (
    SELECT
      s.jogador_id,
      s.username,
      s.vitorias,
      s.partidas,
      ROUND((s.vitorias::numeric / NULLIF(s.partidas, 0)) * 100, 1) AS percentual
    FROM stats_elegiveis s
    ORDER BY (s.vitorias::numeric / NULLIF(s.partidas, 0)) DESC,
             s.vitorias DESC,
             s.partidas DESC,
             s.username ASC
    LIMIT 1
  ),
  sequencia_vitorias AS (
    SELECT sva.jogador_id, sva.username, sva.tamanho
    FROM sequencias_vitorias_atuais sva
    ORDER BY sva.tamanho DESC, sva.username ASC
    LIMIT 1
  ),
  seca_vitorias AS (
    SELECT sva.jogador_id, sva.username, sva.tamanho
    FROM secas_vitorias_atuais sva
    ORDER BY sva.tamanho DESC, sva.username ASC
    LIMIT 1
  )
  SELECT
    p_ano,
    COALESCE((SELECT partidas FROM total), 0::bigint),
    a.jogador_id,
    a.username,
    a.gols,
    a.partidas,
    m.jogador_id,
    m.username,
    m.assistencias,
    m.partidas,
    pt.jogador_id,
    pt.username,
    pt.partidas,
    e.jogador_id,
    e.username,
    e.vitorias,
    e.partidas,
    e.percentual,
    sv.jogador_id,
    sv.username,
    sv.tamanho,
    sc.jogador_id,
    sc.username,
    sc.tamanho
  FROM (SELECT 1) _
  LEFT JOIN artilheiro a ON true
  LEFT JOIN maestro m ON true
  LEFT JOIN participante pt ON true
  LEFT JOIN eficiente e ON true
  LEFT JOIN sequencia_vitorias sv ON true
  LEFT JOIN seca_vitorias sc ON true;
$$;

GRANT EXECUTE ON FUNCTION resumo_ano(integer) TO anon, authenticated;

-- 11.2 Parcerias por Atleta (Companheiros e Adversários)
CREATE OR REPLACE FUNCTION parcerias_jogador(
  p_jogador_id    bigint,
  p_min_partidas  integer DEFAULT 5
)
RETURNS TABLE (
  tipo             text,
  outro_jogador_id bigint,
  username         text,
  partidas         bigint,
  vitorias         bigint,
  empates          bigint,
  derrotas         bigint,
  pontos           bigint,
  percentual       numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH jogador_partidas AS (
    SELECT partida_id, time, vitoria, empate, derrota, pontos
    FROM v_levantamento
    WHERE jogador_id = p_jogador_id
  ),
  companheiros AS (
    SELECT
      'companheiro'::text AS tipo,
      outl.jogador_id,
      j.username,
      COUNT(*)::bigint                                          AS partidas,
      COUNT(*) FILTER (WHERE jp.vitoria)::bigint                AS vitorias,
      COUNT(*) FILTER (WHERE jp.empate)::bigint                 AS empates,
      COUNT(*) FILTER (WHERE jp.derrota)::bigint                AS derrotas
    FROM jogador_partidas jp
    JOIN v_levantamento outl
      ON outl.partida_id = jp.partida_id
     AND outl.time       = jp.time
     AND outl.jogador_id <> p_jogador_id
    JOIN jogadores j ON j.id = outl.jogador_id
    GROUP BY outl.jogador_id, j.username
    HAVING COUNT(*) >= p_min_partidas
  ),
  adversarios AS (
    SELECT
      'adversario'::text AS tipo,
      outl.jogador_id,
      j.username,
      COUNT(*)::bigint                                          AS partidas,
      COUNT(*) FILTER (WHERE jp.vitoria)::bigint                AS vitorias,
      COUNT(*) FILTER (WHERE jp.empate)::bigint                 AS empates,
      COUNT(*) FILTER (WHERE jp.derrota)::bigint                AS derrotas
    FROM jogador_partidas jp
    JOIN v_levantamento outl
      ON outl.partida_id = jp.partida_id
     AND outl.time       <> jp.time
     AND outl.jogador_id <> p_jogador_id
    JOIN jogadores j ON j.id = outl.jogador_id
    GROUP BY outl.jogador_id, j.username
    HAVING COUNT(*) >= p_min_partidas
  ),
  todos AS (
    SELECT * FROM companheiros
    UNION ALL
    SELECT * FROM adversarios
  )
  SELECT
    tipo,
    jogador_id AS outro_jogador_id,
    username,
    partidas,
    vitorias,
    empates,
    derrotas,
    (vitorias * 3 + empates)::bigint AS pontos,
    (vitorias * 3 + empates)::numeric
      / NULLIF(partidas * 3, 0) AS percentual
  FROM todos
  ORDER BY
    tipo ASC,
    pontos DESC,
    partidas DESC,
    vitorias DESC,
    username ASC;
$$;

GRANT EXECUTE ON FUNCTION parcerias_jogador(bigint, integer) TO anon, authenticated;

-- 11.3 Destaques de Parceria Individual (Mais Gols, Melhor Nota, Pior Nota)
CREATE OR REPLACE FUNCTION parcerias_destaque_jogador(
  p_jogador_id   bigint,
  p_min_partidas integer DEFAULT 3
)
RETURNS TABLE (
  metrica          text,
  outro_jogador_id bigint,
  username         text,
  partidas         bigint,
  valor            numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH jogador_partidas AS (
    SELECT partida_id, time, gols
    FROM v_levantamento
    WHERE jogador_id = p_jogador_id
  ),
  usuario_notas AS (
    SELECT partida_id, avg_rating
    FROM partida_notas
    WHERE target_id = p_jogador_id
  ),
  companheiros AS (
    SELECT
      outl.jogador_id,
      j.username,
      COUNT(*)::bigint                                       AS partidas,
      COALESCE(SUM(jp.gols), 0)::numeric                     AS gols_usuario,
      AVG(un.avg_rating)::numeric                            AS nota_media_usuario
    FROM jogador_partidas jp
    JOIN v_levantamento outl
      ON outl.partida_id = jp.partida_id
     AND outl.time       = jp.time
     AND outl.jogador_id <> p_jogador_id
    JOIN jogadores      j   ON j.id  = outl.jogador_id
    LEFT JOIN usuario_notas un ON un.partida_id = jp.partida_id
    WHERE j.posicao <> 'random'
    GROUP BY outl.jogador_id, j.username
    HAVING COUNT(*) >= p_min_partidas
  )
  (SELECT 'mais_gols'::text   AS metrica,
          jogador_id          AS outro_jogador_id,
          username,
          partidas,
          gols_usuario        AS valor
   FROM companheiros
   ORDER BY gols_usuario DESC NULLS LAST, partidas DESC, username ASC
   LIMIT 1)
  UNION ALL
  (SELECT 'melhor_nota'::text AS metrica,
          jogador_id          AS outro_jogador_id,
          username,
          partidas,
          nota_media_usuario  AS valor
   FROM companheiros
   WHERE nota_media_usuario IS NOT NULL
   ORDER BY nota_media_usuario DESC NULLS LAST, partidas DESC, username ASC
   LIMIT 1)
  UNION ALL
  (SELECT 'pior_nota'::text   AS metrica,
          jogador_id          AS outro_jogador_id,
          username,
          partidas,
          nota_media_usuario  AS valor
   FROM companheiros
   WHERE nota_media_usuario IS NOT NULL
   ORDER BY nota_media_usuario ASC NULLS LAST, partidas DESC, username ASC
   LIMIT 1);
$$;

GRANT EXECUTE ON FUNCTION parcerias_destaque_jogador(bigint, integer) TO anon, authenticated;

-- 11.4 Pares do Racha (Duplas da Temporada)
CREATE OR REPLACE FUNCTION pares_racha(
  p_min_partidas integer DEFAULT 5
)
RETURNS TABLE (
  jogador_a_id   bigint,
  jogador_b_id   bigint,
  jogador_a_username text,
  jogador_b_username text,
  partidas       bigint,
  vitorias       bigint,
  empates        bigint,
  derrotas       bigint,
  pontos         bigint,
  percentual     numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH participacoes AS (
    SELECT
      l.partida_id,
      l.time,
      l.jogador_id,
      l.vitoria,
      l.empate,
      l.derrota
    FROM v_levantamento l
    JOIN jogadores j ON j.id = l.jogador_id
    WHERE j.posicao <> 'random'
  ),
  pares AS (
    SELECT
      a.jogador_id AS jogador_a_id,
      b.jogador_id AS jogador_b_id,
      a.vitoria,
      a.empate,
      a.derrota
    FROM participacoes a
    JOIN participacoes b
      ON b.partida_id = a.partida_id
     AND b.time       = a.time
     AND b.jogador_id > a.jogador_id
  ),
  agregado AS (
    SELECT
      jogador_a_id,
      jogador_b_id,
      COUNT(*)::bigint                                      AS partidas,
      COUNT(*) FILTER (WHERE vitoria)::bigint               AS vitorias,
      COUNT(*) FILTER (WHERE empate)::bigint                AS empates,
      COUNT(*) FILTER (WHERE derrota)::bigint               AS derrotas
    FROM pares
    GROUP BY jogador_a_id, jogador_b_id
    HAVING COUNT(*) >= p_min_partidas
  )
  SELECT
    a.jogador_a_id,
    a.jogador_b_id,
    ja.username AS jogador_a_username,
    jb.username AS jogador_b_username,
    a.partidas,
    a.vitorias,
    a.empates,
    a.derrotas,
    (a.vitorias * 3 + a.empates)::bigint AS pontos,
    (a.vitorias * 3 + a.empates)::numeric
      / NULLIF(a.partidas * 3, 0) AS percentual
  FROM agregado a
  JOIN jogadores ja ON ja.id = a.jogador_a_id
  JOIN jogadores jb ON jb.id = a.jogador_b_id
  ORDER BY
    pontos             DESC,
    partidas           DESC,
    vitorias           DESC,
    jogador_a_username ASC,
    jogador_b_username ASC;
$$;

GRANT EXECUTE ON FUNCTION pares_racha(integer) TO anon, authenticated;

-- 11.5 Confronto Direto (Comparador Cara-a-Cara)
CREATE OR REPLACE FUNCTION confronto_direto(
  p_jogador_a    bigint,
  p_jogador_b    bigint
)
RETURNS TABLE (
  lado           text,
  bloco          text,
  partidas       bigint,
  gols           bigint,
  assistencias   bigint,
  gols_contra    bigint,
  vitorias       bigint,
  empates        bigint,
  derrotas       bigint,
  media_nota     numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_jogador_a = p_jogador_b THEN
    RAISE EXCEPTION 'Selecione dois atletas diferentes.';
  END IF;

  IF (SELECT COUNT(*) FROM jogadores j
       WHERE j.id IN (p_jogador_a, p_jogador_b)
         AND j.posicao <> 'random') <> 2 THEN
    RAISE EXCEPTION 'Atleta não encontrado.';
  END IF;

  RETURN QUERY
  WITH encontros AS (
    SELECT
      la.partida_id               AS partida_id,
      la.time                     AS time_a,
      lb.time                     AS time_b,
      la.vitoria                  AS vitoria_a,
      lb.vitoria                  AS vitoria_b,
      la.empate                   AS empate,
      la.derrota                  AS derrota_a,
      lb.derrota                  AS derrota_b,
      la.gols                     AS gols_a,
      lb.gols                     AS gols_b,
      la.assistencias             AS assistencias_a,
      lb.assistencias             AS assistencias_b,
      la.gols_contra              AS gols_contra_a,
      lb.gols_contra              AS gols_contra_b
    FROM v_levantamento la
    JOIN v_levantamento lb
      ON lb.partida_id = la.partida_id
     AND lb.jogador_id = p_jogador_b
    WHERE la.jogador_id = p_jogador_a
  ),
  lados AS (
    SELECT 'a'::text AS lado, p_jogador_a AS jogador_id
    UNION ALL
    SELECT 'b'::text, p_jogador_b
  ),
  encontros_lado AS (
    SELECT
      ld.lado,
      ld.jogador_id,
      en.partida_id,
      CASE WHEN en.time_a = en.time_b THEN 'juntos' ELSE 'adversos' END AS relacao,
      CASE WHEN ld.lado = 'a' THEN en.gols_a ELSE en.gols_b END AS gols,
      CASE WHEN ld.lado = 'a' THEN en.assistencias_a ELSE en.assistencias_b END AS assistencias,
      CASE WHEN ld.lado = 'a' THEN en.gols_contra_a ELSE en.gols_contra_b END AS gols_contra,
      CASE WHEN ld.lado = 'a' THEN en.vitoria_a ELSE en.vitoria_b END AS vitoria,
      en.empate,
      CASE WHEN ld.lado = 'a' THEN en.derrota_a ELSE en.derrota_b END AS derrota
    FROM encontros en
    CROSS JOIN lados ld
  ),
  por_contexto AS (
    SELECT
      el.lado,
      el.relacao,
      COUNT(*)::bigint                                             AS qtd_partidas,
      COALESCE(SUM(el.gols), 0)::bigint                           AS qtd_gols,
      COALESCE(SUM(el.assistencias), 0)::bigint                   AS qtd_assistencias,
      COALESCE(SUM(el.gols_contra), 0)::bigint                    AS qtd_gols_contra,
      COUNT(*) FILTER (WHERE el.vitoria)::bigint                  AS qtd_vitorias,
      COUNT(*) FILTER (WHERE el.empate)::bigint                   AS qtd_empates,
      COUNT(*) FILTER (WHERE el.derrota)::bigint                  AS qtd_derrotas,
      AVG(pn.avg_rating)::numeric                                 AS val_media_nota
    FROM encontros_lado el
    LEFT JOIN partida_notas pn
      ON pn.partida_id = el.partida_id
     AND pn.target_id  = el.jogador_id
    GROUP BY el.lado, el.relacao
  ),
  combinacoes(lado, bloco) AS (
    VALUES ('a','juntos'), ('a','adversos'), ('b','juntos'), ('b','adversos')
  )
  SELECT
    cb.lado                                   AS lado,
    cb.bloco                                  AS bloco,
    COALESCE(pc.qtd_partidas, 0)              AS partidas,
    COALESCE(pc.qtd_gols, 0)                  AS gols,
    COALESCE(pc.qtd_assistencias, 0)          AS assistencias,
    COALESCE(pc.qtd_gols_contra, 0)           AS gols_contra,
    COALESCE(pc.qtd_vitorias, 0)              AS vitorias,
    COALESCE(pc.qtd_empates, 0)               AS empates,
    COALESCE(pc.qtd_derrotas, 0)              AS derrotas,
    pc.val_media_nota                         AS media_nota
  FROM combinacoes cb
  LEFT JOIN por_contexto pc
    ON pc.lado    = cb.lado
   AND pc.relacao = cb.bloco
  ORDER BY cb.bloco, cb.lado;
END;
$$;

GRANT EXECUTE ON FUNCTION confronto_direto(bigint, bigint) TO anon, authenticated;

-- 11.6 Histórico do Confronto Direto
CREATE OR REPLACE FUNCTION confronto_direto_partidas(
  p_jogador_a  bigint,
  p_jogador_b  bigint,
  p_limite     integer DEFAULT 10
)
RETURNS TABLE (
  partida_id    bigint,
  data_jogo     timestamptz,
  relacao       text,
  time_a        text,
  gols_time_a   bigint,
  gols_time_b   bigint,
  vencedor      text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limite integer;
BEGIN
  IF p_jogador_a = p_jogador_b THEN
    RAISE EXCEPTION 'Selecione dois atletas diferentes.';
  END IF;

  IF (SELECT COUNT(*) FROM jogadores j
       WHERE j.id IN (p_jogador_a, p_jogador_b)
         AND j.posicao <> 'random') <> 2 THEN
    RAISE EXCEPTION 'Atleta não encontrado.';
  END IF;

  v_limite := LEAST(GREATEST(COALESCE(p_limite, 10), 1), 50);

  RETURN QUERY
  SELECT
    p.id                                                    AS partida_id,
    p.data_jogo                                             AS data_jogo,
    CASE WHEN pa.time = pb.time THEN 'juntos' ELSE 'adversos' END AS relacao,
    pa.time::text                                           AS time_a,
    pl.gols_time_a                                          AS gols_time_a,
    pl.gols_time_b                                          AS gols_time_b,
    pl.vencedor                                             AS vencedor
  FROM partidas_participantes pa
  JOIN partidas_participantes pb
    ON pb.partida_id = pa.partida_id
   AND pb.jogador_id = p_jogador_b
  JOIN partidas p
    ON p.id = pa.partida_id
  JOIN partida_placar pl
    ON pl.partida_id = pa.partida_id
  WHERE pa.jogador_id = p_jogador_a
    AND p.status IN ('published','closed')
  ORDER BY p.data_jogo DESC, p.id DESC
  LIMIT v_limite;
END;
$$;

GRANT EXECUTE ON FUNCTION confronto_direto_partidas(bigint, bigint, integer) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 12. AGENDAMENTOS AUTOMÁTICOS (PG_CRON)
-- ----------------------------------------------------------------------------

-- 12.1 Fechamento Automático de Votações Expiradas (A cada minuto)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'fechar-votacao-expirada') THEN
    PERFORM cron.unschedule('fechar-votacao-expirada');
  END IF;

  PERFORM cron.schedule(
    'fechar-votacao-expirada',
    '* * * * *',
    $job$
    UPDATE partidas
    SET status = 'closed'
    WHERE status = 'published'
      AND voting_closes_at IS NOT NULL
      AND voting_closes_at <= now();
    $job$
  );
END $$;

-- 12.2 Lembretes de Votação (A cada 15 minutos)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'enviar-lembretes-votacao-15m') THEN
    PERFORM cron.unschedule('enviar-lembretes-votacao-15m');
  END IF;

  PERFORM cron.schedule(
    'enviar-lembretes-votacao-15m',
    '*/15 * * * *',
    $job$
    DECLARE
      v_secret text;
    BEGIN
      SELECT decrypted_secret INTO v_secret
      FROM vault.decrypted_secrets
      WHERE name = 'push_cron_secret'
      LIMIT 1;

      IF v_secret IS NOT NULL THEN
        PERFORM net.http_post(
          url := 'https://jtavmrlllyctkuxefhpc.supabase.co/functions/v1/send-voting-reminders',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-push-cron-secret', v_secret
          ),
          body := '{}'::jsonb
        );
      END IF;
    END;
    $job$
  );
END $$;

-- 12.3 Executar Eventos Financeiros Mensais (Dia 1 às 00:05 BRT / 03:05 UTC)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'executar-eventos-financeiros-mensal') THEN
    PERFORM cron.unschedule('executar-eventos-financeiros-mensal');
  END IF;

  PERFORM cron.schedule(
    'executar-eventos-financeiros-mensal',
    '5 3 1 * *',
    $job$
    SELECT executar_eventos_financeiros_mensais(current_date);
    $job$
  );
END $$;

-- 12.4 Criar Partida Semanal (Configurável via notificacoes_config)
DO $outer$
DECLARE
  v_dia_semana smallint;
  v_horario    time;
  v_minuto     integer;
  v_hora_utc   integer;
  v_cron_expr  text;
BEGIN
  SELECT confirmacao_dia_semana, confirmacao_horario
    INTO v_dia_semana, v_horario
    FROM notificacoes_config
    WHERE id = 1;

  IF v_dia_semana IS NULL THEN
    v_dia_semana := 1;
    v_horario := '10:00'::time;
  END IF;

  v_minuto := EXTRACT(MINUTE FROM v_horario)::integer;
  v_hora_utc := (EXTRACT(HOUR FROM v_horario)::integer + 3) % 24;
  v_cron_expr := format('%s %s * * %s', v_minuto, v_hora_utc, v_dia_semana);

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'agendar-partida-semanal') THEN
    PERFORM cron.unschedule('agendar-partida-semanal');
  END IF;

  PERFORM cron.schedule(
    'agendar-partida-semanal',
    v_cron_expr,
    $semanal$
    DO $$
    DECLARE
      v_partida_id bigint;
      v_secret     text;
    BEGIN
      SELECT criar_partida_semanal_mensalistas() INTO v_partida_id;
      IF v_partida_id IS NULL THEN
        SELECT p.id INTO v_partida_id
          FROM partidas p
          WHERE p.status = 'draft'
            AND date_trunc('week', p.data_jogo AT TIME ZONE 'America/Sao_Paulo') = date_trunc('week', now() AT TIME ZONE 'America/Sao_Paulo')
          ORDER BY p.id DESC
          LIMIT 1;
      END IF;

      IF v_partida_id IS NOT NULL THEN
        SELECT decrypted_secret INTO v_secret
          FROM vault.decrypted_secrets
          WHERE name = 'push_cron_secret'
          LIMIT 1;
        PERFORM net.http_post(
          url := 'https://jtavmrlllyctkuxefhpc.supabase.co/functions/v1/send-confirmation-requests',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-push-cron-secret', v_secret
          ),
          body := jsonb_build_object('partida_id', v_partida_id)
        );
      END IF;
    END $$;
    $semanal$
  );
END $outer$;

-- ----------------------------------------------------------------------------
-- 13. GRANTS DE SEGURANÇA
-- ----------------------------------------------------------------------------

-- 13.1 Colunas Públicas da Tabela Jogadores (Proteção da Senha)
REVOKE ALL ON TABLE jogadores FROM anon, authenticated;
GRANT SELECT (
  id,
  username,
  posicao,
  posicao_b,
  is_admin,
  is_ativo,
  is_mensalista,
  chave_pix,
  telefone,
  created_at
) ON jogadores TO anon, authenticated;

-- 13.2 Tabelas de Trabalho
GRANT SELECT, INSERT, UPDATE, DELETE ON
  partidas,
  partidas_participantes,
  votes,
  partida_eventos,
  dividas,
  notificacoes_config,
  push_subscriptions,
  eventos_financeiros_automaticos
TO anon, authenticated;

-- 13.3 Sequences
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 14. DADOS INICIAIS / SEEDS DE PRODUÇÃO
-- ----------------------------------------------------------------------------

-- 14.1 Configuração Global Padrão
INSERT INTO notificacoes_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- 14.2 Eventos Financeiros Padrão
INSERT INTO eventos_financeiros_automaticos (
  nome, gatilho, natureza, tipo, valor, destino, descricao_template, referencia_template
)
VALUES
  ('Mensalidade Mensalistas', 'mensal', 'receita', 'mensalidade', 90.00, 'mensalistas', 'Mensalidade {mes_ano} — {username}', '{referencia}'),
  ('Aluguel do Campo', 'mensal', 'despesa', 'campo', 1050.00, 'caixa', 'Aluguel do Campo {mes_ano}', '{referencia}'),
  ('Pagamento de Goleiro', 'fim_partida', 'despesa', 'goleiro', 30.00, 'goleiros_partida', 'Goleiro — partida {data} ({username})', '{referencia}')
ON CONFLICT DO NOTHING;
