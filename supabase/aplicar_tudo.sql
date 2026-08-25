-- 001_create_jogadores.sql
-- Cria a tabela `jogadores`, base do esquema do Racha.
-- PK/FKs sao bigint (sequence) - ZERO UUID (Regra do PLANO.md, secao 2).
-- Senhas sao guardadas em texto puro em `senha_hash`. Senha default de todo jogador
-- recem-criado e "123" ate ser trocada na tela de Perfil.
-- Sem RLS, sem triggers, sem policies (seguranca so no app).

CREATE TABLE jogadores (
  id          bigserial   PRIMARY KEY,
  username    text        NOT NULL UNIQUE,
  senha_hash  text        NOT NULL,
  posicao     text        NOT NULL CHECK (posicao IN ('goleiro','zagueiro','lateral','meia','atacante','random')),
  is_admin    boolean     NOT NULL DEFAULT false,
  is_ativo    boolean     NOT NULL DEFAULT true,
  is_mensalista boolean   NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Marca os 12 mensalistas (vaga garantida quando participam).
-- Equivalente a migration 034_marcar_mensalistas.sql.
UPDATE public.jogadores
SET is_mensalista = true
WHERE username IN (
  'dico', 'natal', 'hees', 'tadeu', 'thiagao', 'ed',
  'jp', 'gualberto', 'danilo', 'fil', 'victor', 'hugo'
);
-- 002_enable_pgcrypto.sql
-- Mantido para compatibilidade com bancos existentes. Nao e usado pelas senhas.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- 003_rpc_fazer_login.sql
-- RPC `fazer_login(p_username text, p_senha text)`:
--   Procura o jogador por `username` (case-sensitive) com is_ativo = true.
--   Valida a senha comparando o texto informado com senha_hash.
--   Se valido, retorna a linha do jogador SEM senha_hash e SEM created_at.
--   Se invalido ou inexistente, retorna 0 linhas (tabela vazia).
--
-- Decisao de risco aceita (Regra 6 do PLANO.md): o sistema nao tem sessao
-- server-side. O `id` retornado e confiado pelo servidor em todas as requests
-- seguintes (voter_id, criado_por, jogador_id em trocar_senha, etc.).
--
-- SECURITY DEFINER + search_path = public para evitar sequestro de search_path.
-- Grants para anon e authenticated.

CREATE OR REPLACE FUNCTION fazer_login(p_username text, p_senha text)
RETURNS TABLE (
  id             bigint,
  username       text,
  posicao        text,
  is_admin       boolean,
  is_ativo       boolean,
  is_mensalista  boolean
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

  -- Jogador inexistente/inativo OU senha invalida => retorna 0 linhas.
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
    v_jogador.is_mensalista;
END;
$$;

GRANT EXECUTE ON FUNCTION fazer_login(text, text) TO anon, authenticated;
-- 004_create_partidas.sql
-- Cria a tabela `partidas`. Cada partida tem status draft -> published -> closed.
--   draft:     admin montando (ainda nao entrou no ranking nem na votacao).
--   published: votacao aberta + entra no ranking + editavel pelo admin.
--   closed:    travada; notas e craque revelados.
-- `voting_closes_at` e setado em publish (now() + 24h) e usado pelo pg_cron
-- (migration 015) e pelo bloqueio server-side em registrar_votos (014).
-- `criado_por` referencia o admin que criou a partida.

CREATE TABLE partidas (
  id                bigserial   PRIMARY KEY,
  data_jogo         timestamptz NOT NULL,
  status            text        NOT NULL DEFAULT 'draft'
                              CHECK (status IN ('draft','live','published','closed')),
  voting_closes_at  timestamptz,
  criado_por        bigint      NOT NULL REFERENCES jogadores(id),
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_partidas_status   ON partidas (status);
CREATE INDEX idx_partidas_data_jogo ON partidas (data_jogo DESC);
-- 005_create_partidas_participantes.sql
-- Cria a tabela `partidas_participantes` (uma linha por jogador em cada partida;
-- tipicamente 16 linhas/partida: 8 no time 'a' e 8 no 'b').
-- Gols e assistencias sao CONTADORES por participante (ints), NAO eventos:
--   placar da partida = SUM(gols) por time; resultado = comparacao dos placares.
-- Times fixos: 'a' = Preto, 'b' = Branco.
-- ON DELETE CASCADE em partida_id: se a partida for apagada, os participantes somem.
-- PK composta (partida_id, jogador_id): um jogador so participa uma vez por partida.

CREATE TABLE partidas_participantes (
  partida_id    bigint  NOT NULL REFERENCES partidas(id) ON DELETE CASCADE,
  jogador_id    bigint  NOT NULL REFERENCES jogadores(id),
  time          char(1) NOT NULL CHECK (time IN ('a','b')),
  posicao       text    NOT NULL CHECK (posicao IN ('goleiro','zagueiro','lateral','meia','atacante','random')),
  gols          integer NOT NULL DEFAULT 0 CHECK (gols >= 0),
  assistencias  integer NOT NULL DEFAULT 0 CHECK (assistencias >= 0),
  gols_contra   integer NOT NULL DEFAULT 0 CHECK (gols_contra >= 0),
  PRIMARY KEY (partida_id, jogador_id)
);

CREATE INDEX idx_partidas_participantes_jogador_id
  ON partidas_participantes (jogador_id);
-- 006_create_votes.sql
-- Cria a tabela `votes`. Cada voto: um votante (voter_id) da uma nota 0..10
-- a um alvo (target_id) numa partida.
--   UNIQUE (partida_id, voter_id, target_id): votante da no maximo 1 nota por alvo
--     por partida (permite UPSERT p/ editar voto dentro da janela de 24h).
--   CHECK (voter_id <> target_id): ninguem vota em si (bloqueio DB-side; a UI
--     tambem esconde o proprio jogador na tela de votacao).
-- Anonimato e propriedade da UX (a UI so expoe proprios votos + medias), nao
-- do servidor. Esta view `partida_notas` (008) e a unica fonte de notas/craque.
--
-- Observacao: `voter_id` NAO aparece em nenhuma view derivada (placar, notas,
-- ranking, stats) - apenas aqui, para o dono do voto consultar os seus.

CREATE TABLE votes (
  id          bigserial   PRIMARY KEY,
  partida_id  bigint      NOT NULL REFERENCES partidas(id) ON DELETE CASCADE,
  voter_id    bigint      NOT NULL REFERENCES jogadores(id),
  target_id   bigint      NOT NULL REFERENCES jogadores(id),
  rating      smallint    NOT NULL CHECK (rating BETWEEN 0 AND 10),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (partida_id, voter_id, target_id),
  CHECK (voter_id <> target_id)
);

CREATE INDEX idx_votes_partida_target
  ON votes (partida_id, target_id);
-- 007_view_partida_placar.sql
-- View `partida_placar` com colunas: partida_id, gols_time_a, gols_time_b, vencedor.
--   gols_time_a = SUM(gols) WHERE time='a' por partida.
--   gols_time_b = SUM(gols) WHERE time='b' por partida.
--   vencedor: 'a' | 'b' | 'empate' (derivado comparando os placares).
--
-- Atenco a partidas SEM participantes (rascunho recem-criado, partida vazia):
--   usamos LEFT JOIN partidas + COALESCE(...,0) para que toda partida apareca
--   com placar 0x0 e vencedor='empate' mesmo sem gols/participantes.
--   Sem o LEFT JOIN, uma partida sem participantes sumiria do resultado.

CREATE OR REPLACE VIEW partida_placar AS
SELECT
  p.id                                                          AS partida_id,
  COALESCE(SUM(CASE WHEN pp.time = 'a' THEN pp.gols ELSE 0 END), 0)
    + COALESCE(SUM(CASE WHEN pp.time = 'b' THEN pp.gols_contra ELSE 0 END), 0)
    AS gols_time_a,
  COALESCE(SUM(CASE WHEN pp.time = 'b' THEN pp.gols ELSE 0 END), 0)
    + COALESCE(SUM(CASE WHEN pp.time = 'a' THEN pp.gols_contra ELSE 0 END), 0)
    AS gols_time_b,
  CASE
    WHEN (
      COALESCE(SUM(CASE WHEN pp.time = 'a' THEN pp.gols ELSE 0 END), 0)
      + COALESCE(SUM(CASE WHEN pp.time = 'b' THEN pp.gols_contra ELSE 0 END), 0)
    ) > (
      COALESCE(SUM(CASE WHEN pp.time = 'b' THEN pp.gols ELSE 0 END), 0)
      + COALESCE(SUM(CASE WHEN pp.time = 'a' THEN pp.gols_contra ELSE 0 END), 0)
    )
      THEN 'a'
    WHEN (
      COALESCE(SUM(CASE WHEN pp.time = 'a' THEN pp.gols ELSE 0 END), 0)
      + COALESCE(SUM(CASE WHEN pp.time = 'b' THEN pp.gols_contra ELSE 0 END), 0)
    ) < (
      COALESCE(SUM(CASE WHEN pp.time = 'b' THEN pp.gols ELSE 0 END), 0)
      + COALESCE(SUM(CASE WHEN pp.time = 'a' THEN pp.gols_contra ELSE 0 END), 0)
    )
      THEN 'b'
    ELSE 'empate'
  END                                                           AS vencedor
FROM partidas p
LEFT JOIN partidas_participantes pp ON pp.partida_id = p.id
GROUP BY p.id;
-- 008_view_partida_notas.sql
-- View `partida_notas` com colunas: partida_id, target_id, nome, avg_rating,
-- vote_count, is_craque.
--   - Agrega `votes` por (partida_id, target_id):
--       avg_rating = média desconsiderando a menor e a maior nota se >= 3 votos, vote_count = COUNT(*).
--   - Join com jogadores para trazer `nome`.
--   - `is_craque` boolean resolvido via window function:
--       RANK() OVER (PARTITION BY partida_id
--                    ORDER BY avg_rating DESC, vote_count DESC, nome ASC) = 1
--     Desempate: maior media -> mais votos -> nome alfabetico.
--     Calculado numa CTE primeiro; depois `is_craque = (rk = 1)`.
--   - NAO expoe voter_id: esta view e a unica fonte de notas/craque na UI,
--     preservando a propriedade de "anonimato da UX" (Regra 6).
--
-- Nota: pode haver empate no rank 1 (dois jogadores com mesma media, mesmos
-- votos e mesmo nome - improvavel, mas o RANK() atribui 1 a todos os empatados
-- e ambos ficariam is_craque=true). Isso e aceitavel para o MVP.

CREATE OR REPLACE VIEW partida_notas AS
WITH raw_agg AS (
  SELECT
    v.partida_id,
    v.target_id,
    j.username,
    CASE
      WHEN COUNT(*) >= 3 THEN (SUM(v.rating) - MIN(v.rating) - MAX(v.rating))::numeric / (COUNT(*) - 2)
      ELSE AVG(v.rating)::numeric
    END                                                        AS avg_rating,
    COUNT(*)::bigint                                           AS vote_count
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
    )                                                          AS rk
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
-- 009_view_ranking.sql
-- View `ranking` por jogador com colunas:
--   jogador_id, username, pontos, vitorias, empates, derrotas, partidas, gols, assistencias, gols_contra, posicao.

CREATE OR REPLACE VIEW ranking AS
SELECT
  pp.jogador_id,
  j.username,
  -- pontos = 3 por vitoria + 1 por empate
  (
    COUNT(*) FILTER (
      WHERE pl.vencedor = pp.time
    ) * 3
    +
    COUNT(*) FILTER (
      WHERE pl.vencedor = 'empate'
    ) * 1
  )                                                         AS pontos,
  COUNT(*) FILTER (WHERE pl.vencedor = pp.time)             AS vitorias,
  COUNT(*) FILTER (WHERE pl.vencedor = 'empate')            AS empates,
  COUNT(*) FILTER (WHERE pl.vencedor <> pp.time
                    AND pl.vencedor <> 'empate')            AS derrotas,
  COUNT(*)                                                  AS partidas,
  COALESCE(SUM(pp.gols), 0)                                 AS gols,
  COALESCE(SUM(pp.assistencias), 0)                         AS assistencias,
  COALESCE(SUM(pp.gols_contra), 0)                          AS gols_contra,
  j.posicao
FROM partidas_participantes pp
JOIN partidas      p  ON p.id  = pp.partida_id
JOIN partida_placar pl ON pl.partida_id = pp.partida_id
JOIN jogadores     j  ON j.id  = pp.jogador_id
WHERE p.status IN ('published','closed')
GROUP BY pp.jogador_id, j.username, j.posicao;
-- 010_view_stats_jogador.sql
-- View `stats_jogador` com colunas: jogador_id, partidas, gols, assistencias, vitorias.
-- Similar ao ranking, mas sem pontos/derrotas/empates. Alimenta a tela de Perfil.
--   - Considera apenas partidas com status IN ('published','closed').
--   - vitorias = participacoes onde o time do jogador == vencedor da partida
--     (join com partida_placar, mesmas regras do ranking).

CREATE OR REPLACE VIEW stats_jogador AS
SELECT
  pp.jogador_id,
  COUNT(*)                                  AS partidas,
  COALESCE(SUM(pp.gols), 0)                 AS gols,
  COALESCE(SUM(pp.assistencias), 0)         AS assistencias,
  COUNT(*) FILTER (WHERE pl.vencedor = pp.time) AS vitorias,
  COALESCE(SUM(pp.gols_contra), 0)          AS gols_contra
FROM partidas_participantes pp
JOIN partidas       p  ON p.id  = pp.partida_id
JOIN partida_placar pl ON pl.partida_id = pp.partida_id
WHERE p.status IN ('published','closed')
GROUP BY pp.jogador_id;
-- 011_rpc_criar_jogador.sql
-- RPC `criar_jogador(p_username, p_nome, p_posicao, p_is_admin) RETURNS bigint`:
--   Insere em `jogadores` com:
--     senha_hash = '123'   <- senha default fixa
--     is_ativo   = true
--   Retorna o `id` do novo jogador.
--
-- NAO valida admin aqui: o controle de quem pode chamar (so admin logado) fica
-- no app (UI esconde a tela de NovoJogador para nao-admin). A funcao confia no
-- caller (postura de seguranca relaxada, coerente com a Regra 6).
--
-- A senha default "123" deve ser trocada pelo jogador na tela de Perfil.
-- Se o username ja existir, a constraint UNIQUE levanta excecao (tratada no app).
--
-- SECURITY DEFINER + search_path = public.

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
  -- Goleiros primarios nao tem posicao secundaria e sao isentos de pagamentos.
  v_posicao_b := CASE WHEN p_posicao = 'goleiro' THEN NULL ELSE p_posicao_b END;
  v_is_mensalista := CASE WHEN p_posicao = 'goleiro' THEN false ELSE COALESCE(p_is_mensalista, false) END;

  INSERT INTO jogadores (username, senha_hash, posicao, is_admin, is_ativo, posicao_b, is_mensalista)
  VALUES (p_username, '123', p_posicao, p_is_admin, true, v_posicao_b, v_is_mensalista)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION criar_jogador(text, text, boolean, text, boolean) TO anon, authenticated;

-- 012_rpc_trocar_senha.sql
-- RPC `trocar_senha(p_jogador_id bigint, p_senha_atual text, p_senha_nova text)
--      RETURNS boolean`:
--   1. Busca o jogador por id. Se nao existir, retorna false.
--   2. Valida a senha atual comparando o texto informado com senha_hash.
--      Se invalida, retorna false (nao atualiza nada).
--   3. Atualiza senha_hash = p_senha_nova. Retorna true.
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
  IF p_senha_atual <> v_senha_hash THEN
    RETURN false;
  END IF;

  UPDATE jogadores
  SET senha_hash = p_senha_nova
  WHERE id = p_jogador_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION trocar_senha(bigint, text, text) TO anon, authenticated;
-- 013_rpc_criar_partida.sql
-- RPC TRANSACIONAL `criar_partida(p_data_jogo, p_criado_por, p_participantes jsonb)
--                   RETURNS bigint`:
--   p_participantes = array de objetos:
--     [{jogador_id, time, posicao, gols, assistencias}, ...]
--   (tipicamente 16 elementos: 8 no time 'a', 8 no 'b').
--
--   Fluxo:
--     1. INSERT em partidas (status='draft', criado_por=p_criado_por) -> v_partida_id.
--     2. Para cada elemento do array (jsonb_array_elements), INSERT em
--        partidas_participantes com partida_id=v_partida_id e os campos do elemento.
--     3. Retorna v_partida_id.
--
--   Tudo envolto em BEGIN ... EXCEPTION WHEN OTHERS THEN ROLLBACK; RETURN NULL; END.
--   Qualquer falha (CHECK violado, FK invalida, JSON malformado, etc.) faz
--   rollback completo (nem a partida nem participantes ficam gravados) e
--   retorna NULL. O app trata NULL como erro.
--
--   A publicacao (status='published' + voting_closes_at=now()+24h) e feita
--   em outra chamada (UPDATE direto do app), fora desta funcao.
--
--   p_criado_por e confiado (Regra 6) - esperado ser o id do admin logado.
--
-- SECURITY DEFINER + search_path = public.

CREATE OR REPLACE FUNCTION criar_partida(
  p_data_jogo       timestamptz,
  p_criado_por      bigint,
  p_participantes   jsonb
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
  BEGIN
    INSERT INTO partidas (data_jogo, status, criado_por)
    VALUES (p_data_jogo, 'draft', p_criado_por)
    RETURNING id INTO v_partida_id;

    FOR elem IN SELECT * FROM jsonb_array_elements(p_participantes)
    LOOP
      INSERT INTO partidas_participantes
        (partida_id, jogador_id, time, posicao, gols, assistencias, gols_contra)
      VALUES (
        v_partida_id,
        (elem->>'jogador_id')::bigint,
        (elem->>'time')::char(1),
        (elem->>'posicao')::text,
        COALESCE((elem->>'gols')::integer, 0),
        COALESCE((elem->>'assistencias')::integer, 0),
        COALESCE((elem->>'gols_contra')::integer, 0)
      );
    END LOOP;

    RETURN v_partida_id;

  EXCEPTION WHEN OTHERS THEN
    ROLLBACK;
    RETURN NULL;
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION criar_partida(timestamptz, bigint, jsonb) TO anon, authenticated;
-- 014_rpc_registrar_votos.sql
-- RPC TRANSACIONAL + UPSERT `registrar_votos(p_partida_id, p_voter_id, p_votos jsonb)
--                            RETURNS boolean`:
--   p_votos = array de [{target_id, rating}, ...] (notas 0..10 dadas pelo votante).
--
--   BLOQUEIO SERVER-SIDE DUPLO (independente do pg_cron, que so sincroniza status):
--     1. Valida que a partida tem status='published' E voting_closes_at > now().
--        Se nao, retorna false SEM gravar nada (janela de 24h fechada).
--     2. Valida que p_voter_id <> target_id para todos os votos (defesa em
--        profundidade, embora a tabela votes ja tenha CHECK(voter_id<>target_id)).
--        Se algum for self-vote, retorna false (sem gravar nada).
--
--   Em transacao, para cada voto faz UPSERT:
--     INSERT INTO votes (partida_id, voter_id, target_id, rating)
--     VALUES (p_partida_id, p_voter_id, v_target_id, v_rating)
--     ON CONFLICT (partida_id, voter_id, target_id)
--     DO UPDATE SET rating = EXCLUDED.rating;
--   Isso permite EDITAR votos dentro da janela (reenviar muda o rating).
--
--   Retorna true se sucesso; false em qualquer falha (com rollback completo).
--
--   p_voter_id e confiado (Regra 6) - esperado ser o id do jogador logado.
--
-- SECURITY DEFINER + search_path = public.

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
  -- (1) Bloqueio de janela: partida deve estar published e dentro do prazo.
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

  -- (2) Votante precisa ser participante da partida.
  PERFORM 1
    FROM partidas_participantes
    WHERE partida_id = p_partida_id
      AND jogador_id = p_voter_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- (3) Votante não pode ser jogador 'random' (placeholder do sorteio).
  PERFORM 1
    FROM jogadores
    WHERE id = p_voter_id
      AND username NOT ILIKE 'random%';
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- (4) Validacao previa: nenhum self-vote. Iteramos antes de gravar para
  --     garantir atomicidade (ou grava tudo, ou nada).
  FOR elem IN SELECT * FROM jsonb_array_elements(p_votos)
  LOOP
    v_target_id := (elem->>'target_id')::bigint;
    IF v_target_id = p_voter_id THEN
      RETURN false;
    END IF;
  END LOOP;

  -- (5) UPSERT de cada voto em transacao.
  BEGIN
    FOR elem IN SELECT * FROM jsonb_array_elements(p_votos)
    LOOP
      v_target_id := (elem->>'target_id')::bigint;
      v_rating    := (elem->>'rating')::smallint;

      INSERT INTO votes (partida_id, voter_id, target_id, rating)
      VALUES (p_partida_id, p_voter_id, v_target_id, v_rating)
      ON CONFLICT (partida_id, voter_id, target_id)
      DO UPDATE SET rating = EXCLUDED.rating;
    END LOOP;

    RETURN true;

  EXCEPTION WHEN OTHERS THEN
    ROLLBACK;
    RETURN false;
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION registrar_votos(bigint, bigint, jsonb) TO anon, authenticated;
-- 015_pg_cron_fechar_votacao.sql
-- Agenda via pg_cron um job que roda a cada 1 minuto para fechar partidas
-- expiradas: status published -> closed quando voting_closes_at < now().
--
-- IMPORTANTE:
--   - pg_cron roda no banco de dados do Supabase (nao na aplicacao). A extensao
--     precisa estar habilitada no painel do Supabase (Database > Extensions).
--   - O BLOQUEIO EFETIVO de votos fora do prazo JA e garantido pela RPC
--     `registrar_votos` (migration 014), que valida status='published' E
--     voting_closes_at > now() ANTES de gravar - independente deste cron.
--     Este job apenas SINCRONIZA o status para 'closed' para a UI mostrar
--     "Encerrada" e revelar notas/craque na tela de detalhe.
--   - Rodar a cada 1 minuto (e nao a cada hora) reduz a janela em que a UI
--     mostra uma partida como "publicada" apos o prazo - defasagem maxima ~60s.
--
-- Idempotente: o SELECT no cron.schedule levanta erro se o job ja existe com
-- o mesmo nome. Se precisar re-aplicar, faca cron.unschedule('fechar-votacao-1min')
-- antes. Em migrations novas do Supabase isso costuma ser aceitavel rodar uma
-- unica vez.

CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'fechar-votacao-1min',
  '* * * * *',
  $$UPDATE partidas SET status = 'closed' WHERE status = 'published' AND voting_closes_at < now();$$
);

-- 028_rpc_resumo_ano.sql
-- RPC `resumo_ano(p_ano)` com os destaques estatisticos do ano.
-- Considera apenas partidas publicadas ou encerradas.

CREATE OR REPLACE FUNCTION resumo_ano(p_ano integer)
RETURNS TABLE (
  ano integer,
  total_partidas bigint,
  artilheiro_jogador_id bigint,
  artilheiro_nome text,
  artilheiro_gols bigint,
  artilheiro_partidas bigint,
  maestro_jogador_id bigint,
  maestro_nome text,
  maestro_assistencias bigint,
  maestro_partidas bigint,
  participante_jogador_id bigint,
  participante_nome text,
  participante_partidas bigint,
  eficiente_jogador_id bigint,
  eficiente_nome text,
  eficiente_vitorias bigint,
  eficiente_partidas bigint,
  eficiente_percentual numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH partidas_ano AS (
    SELECT p.id
    FROM partidas p
    WHERE p.status IN ('published', 'closed')
      AND EXTRACT(
        YEAR FROM p.data_jogo AT TIME ZONE 'America/Sao_Paulo'
      )::integer = p_ano
  ),
  total AS (
    SELECT COUNT(*)::bigint AS partidas
    FROM partidas_ano
  ),
  stats AS (
    SELECT
      pp.jogador_id,
      j.nome,
      COUNT(*)::bigint AS partidas,
      COALESCE(SUM(pp.gols), 0)::bigint AS gols,
      COALESCE(SUM(pp.assistencias), 0)::bigint AS assistencias,
      COUNT(*) FILTER (WHERE pl.vencedor = pp.time)::bigint AS vitorias
    FROM partidas_participantes pp
    JOIN partidas p ON p.id = pp.partida_id
    JOIN partidas_ano pa ON pa.id = p.id
    JOIN partida_placar pl ON pl.partida_id = pp.partida_id
    JOIN jogadores j ON j.id = pp.jogador_id
    GROUP BY pp.jogador_id, j.nome
  ),
  artilheiro AS (
    SELECT s.*
    FROM stats s
    ORDER BY s.gols DESC, s.partidas DESC, s.nome ASC
    LIMIT 1
  ),
  maestro AS (
    SELECT s.*
    FROM stats s
    ORDER BY s.assistencias DESC, s.partidas DESC, s.nome ASC
    LIMIT 1
  ),
  participante AS (
    SELECT s.*
    FROM stats s
    ORDER BY s.partidas DESC, s.gols DESC, s.nome ASC
    LIMIT 1
  ),
  eficiente AS (
    SELECT s.*
    FROM stats s
    CROSS JOIN total t
    WHERE s.partidas * 2 >= t.partidas
    ORDER BY s.vitorias::numeric / NULLIF(s.partidas, 0) DESC,
             s.partidas DESC,
             s.nome ASC
    LIMIT 1
  )
  SELECT
    p_ano,
    t.partidas,
    a.jogador_id,
    a.nome,
    a.gols,
    a.partidas,
    m.jogador_id,
    m.nome,
    m.assistencias,
    m.partidas,
    pt.jogador_id,
    pt.nome,
    pt.partidas,
    e.jogador_id,
    e.nome,
    e.vitorias,
    e.partidas,
    CASE
      WHEN e.jogador_id IS NULL THEN NULL
      ELSE e.vitorias::numeric / NULLIF(e.partidas, 0)
    END
  FROM total t
  LEFT JOIN artilheiro a ON true
  LEFT JOIN maestro m ON true
  LEFT JOIN participante pt ON true
  LEFT JOIN eficiente e ON true;
$$;

GRANT EXECUTE ON FUNCTION resumo_ano(integer) TO anon, authenticated;

-- 030_rpc_parcerias_jogador.sql
-- RPC `parcerias_jogador(p_jogador_id, p_min_partidas DEFAULT 5)` devolve o ranking
-- de companheiros (mesmo time) e adversarios (time diferente) do jogador logado.
-- Metrica: pontos = vitorias*3 + empates*1; percentual = pontos/(partidas*3).
-- Filtro HAVING >= p_min_partidas. Apenas partidas published/closed.

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
SECURITY DEFINER
SET search_path = public
AS $$
  WITH jogador_partidas AS (
    SELECT pp.partida_id, pp.time, pl.vencedor
    FROM partidas_participantes pp
    JOIN partidas       p  ON p.id  = pp.partida_id
    JOIN partida_placar pl ON pl.partida_id = pp.partida_id
    WHERE pp.jogador_id = p_jogador_id
      AND p.status IN ('published','closed')
  ),
  companheiros AS (
    SELECT
      'companheiro'::text AS tipo,
      outp.jogador_id,
      j.username,
      COUNT(*)::bigint                                          AS partidas,
      COUNT(*) FILTER (WHERE jp.vencedor = jp.time)::bigint     AS vitorias,
      COUNT(*) FILTER (WHERE jp.vencedor = 'empate')::bigint    AS empates,
      COUNT(*) FILTER (WHERE jp.vencedor <> jp.time
                        AND jp.vencedor <> 'empate')::bigint     AS derrotas
    FROM jogador_partidas jp
    JOIN partidas_participantes outp
      ON outp.partida_id = jp.partida_id
     AND outp.time       = jp.time
     AND outp.jogador_id <> p_jogador_id
    JOIN jogadores j ON j.id = outp.jogador_id
    GROUP BY outp.jogador_id, j.username
    HAVING COUNT(*) >= p_min_partidas
  ),
  adversarios AS (
    SELECT
      'adversario'::text AS tipo,
      outp.jogador_id,
      j.username,
      COUNT(*)::bigint                                          AS partidas,
      COUNT(*) FILTER (WHERE jp.vencedor = jp.time)::bigint     AS vitorias,
      COUNT(*) FILTER (WHERE jp.vencedor = 'empate')::bigint    AS empates,
      COUNT(*) FILTER (WHERE jp.vencedor <> jp.time
                        AND jp.vencedor <> 'empate')::bigint     AS derrotas
    FROM jogador_partidas jp
    JOIN partidas_participantes outp
      ON outp.partida_id = jp.partida_id
     AND outp.time       <> jp.time
     AND outp.jogador_id <> p_jogador_id
    JOIN jogadores j ON j.id = outp.jogador_id
    GROUP BY outp.jogador_id, j.username
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

-- 031_add_sequencias_resumo_ano.sql
-- Acrescenta ao resumo anual a maior sequencia de vitorias e a maior seca.

DROP FUNCTION IF EXISTS resumo_ano(integer);

CREATE FUNCTION resumo_ano(p_ano integer)
RETURNS TABLE (
  ano integer,
  total_partidas bigint,
  artilheiro_jogador_id bigint,
  artilheiro_nome text,
  artilheiro_gols bigint,
  artilheiro_partidas bigint,
  maestro_jogador_id bigint,
  maestro_nome text,
  maestro_assistencias bigint,
  maestro_partidas bigint,
  participante_jogador_id bigint,
  participante_nome text,
  participante_partidas bigint,
  eficiente_jogador_id bigint,
  eficiente_nome text,
  eficiente_vitorias bigint,
  eficiente_partidas bigint,
  eficiente_percentual numeric,
  sequencia_vitorias_jogador_id bigint,
  sequencia_vitorias_nome text,
  sequencia_vitorias bigint,
  seca_vitorias_jogador_id bigint,
  seca_vitorias_nome text,
  seca_vitorias bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH partidas_ano AS (
    SELECT p.id, p.data_jogo
    FROM partidas p
    WHERE p.status IN ('published', 'closed')
      AND EXTRACT(
        YEAR FROM p.data_jogo AT TIME ZONE 'America/Sao_Paulo'
      )::integer = p_ano
  ),
  total AS (
    SELECT COUNT(*)::bigint AS partidas
    FROM partidas_ano
  ),
  stats AS (
    SELECT
      pp.jogador_id,
      j.nome,
      COUNT(*)::bigint AS partidas,
      COALESCE(SUM(pp.gols), 0)::bigint AS gols,
      COALESCE(SUM(pp.assistencias), 0)::bigint AS assistencias,
      COUNT(*) FILTER (WHERE pl.vencedor = pp.time)::bigint AS vitorias
    FROM partidas_participantes pp
    JOIN partidas p ON p.id = pp.partida_id
    JOIN partidas_ano pa ON pa.id = p.id
    JOIN partida_placar pl ON pl.partida_id = pp.partida_id
    JOIN jogadores j ON j.id = pp.jogador_id
    GROUP BY pp.jogador_id, j.nome
  ),
  jogador_partidas AS (
    SELECT
      pp.jogador_id,
      j.nome,
      p.id AS partida_id,
      p.data_jogo,
      (pl.vencedor = pp.time) AS venceu
    FROM partidas_participantes pp
    JOIN partidas_ano pa ON pa.id = pp.partida_id
    JOIN partidas p ON p.id = pa.id
    JOIN partida_placar pl ON pl.partida_id = pp.partida_id
    JOIN jogadores j ON j.id = pp.jogador_id
  ),
  sequencias_marcadas AS (
    SELECT
      jp.*,
      SUM(CASE WHEN NOT jp.venceu THEN 1 ELSE 0 END) OVER (
        PARTITION BY jp.jogador_id
        ORDER BY jp.data_jogo, jp.partida_id
        ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
      ) AS grupo_vitorias,
      SUM(CASE WHEN jp.venceu THEN 1 ELSE 0 END) OVER (
        PARTITION BY jp.jogador_id
        ORDER BY jp.data_jogo, jp.partida_id
        ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
      ) AS grupo_secas
    FROM jogador_partidas jp
  ),
  sequencias_vitorias AS (
    SELECT jogador_id, nome, grupo_vitorias AS grupo, COUNT(*)::bigint AS tamanho
    FROM sequencias_marcadas
    WHERE venceu
    GROUP BY jogador_id, nome, grupo_vitorias
  ),
  secas_vitorias AS (
    SELECT jogador_id, nome, grupo_secas AS grupo, COUNT(*)::bigint AS tamanho
    FROM sequencias_marcadas
    WHERE NOT venceu
    GROUP BY jogador_id, nome, grupo_secas
  ),
  maior_sequencia_vitorias AS (
    SELECT sv.jogador_id, sv.nome, sv.tamanho
    FROM sequencias_vitorias sv
    JOIN stats s ON s.jogador_id = sv.jogador_id
    ORDER BY sv.tamanho DESC, s.partidas DESC, sv.nome ASC
    LIMIT 1
  ),
  maior_seca_vitorias AS (
    SELECT sv.jogador_id, sv.nome, sv.tamanho
    FROM secas_vitorias sv
    JOIN stats s ON s.jogador_id = sv.jogador_id
    ORDER BY sv.tamanho DESC, s.partidas DESC, sv.nome ASC
    LIMIT 1
  ),
  artilheiro AS (
    SELECT s.* FROM stats s
    ORDER BY s.gols DESC, s.partidas DESC, s.nome ASC
    LIMIT 1
  ),
  maestro AS (
    SELECT s.* FROM stats s
    ORDER BY s.assistencias DESC, s.partidas DESC, s.nome ASC
    LIMIT 1
  ),
  participante AS (
    SELECT s.* FROM stats s
    ORDER BY s.partidas DESC, s.gols DESC, s.nome ASC
    LIMIT 1
  ),
  eficiente AS (
    SELECT s.* FROM stats s
    CROSS JOIN total t
    WHERE s.partidas * 2 >= t.partidas
    ORDER BY s.vitorias::numeric / NULLIF(s.partidas, 0) DESC,
             s.partidas DESC, s.nome ASC
    LIMIT 1
  )
  SELECT
    p_ano, t.partidas,
    a.jogador_id, a.nome, a.gols, a.partidas,
    m.jogador_id, m.nome, m.assistencias, m.partidas,
    pt.jogador_id, pt.nome, pt.partidas,
    e.jogador_id, e.nome, e.vitorias, e.partidas,
    CASE WHEN e.jogador_id IS NULL THEN NULL
         ELSE e.vitorias::numeric / NULLIF(e.partidas, 0) END,
    sv.jogador_id, sv.nome, sv.tamanho,
    ss.jogador_id, ss.nome, ss.tamanho
  FROM total t
  LEFT JOIN artilheiro a ON true
  LEFT JOIN maestro m ON true
  LEFT JOIN participante pt ON true
  LEFT JOIN eficiente e ON true
  LEFT JOIN maior_sequencia_vitorias sv ON true
  LEFT JOIN maior_seca_vitorias ss ON true;
$$;

GRANT EXECUTE ON FUNCTION resumo_ano(integer) TO anon, authenticated;

-- 032_rpc_pares_racha.sql
-- RPC `pares_racha(p_min_partidas integer DEFAULT 5)`
-- Ranking GLOBAL de duplas (2 jogadores que jogaram JUNTOS no mesmo time):
--   - par nao-ordenado: (jogador_a_id, jogador_b_id) com a.id < b.id garante
--     que cada dupla apareca uma unica vez (sem LEAST/GREATEST).
--   - metrica: pontos = vitorias*3 + empates*1 (mesmo criterio do `ranking` e
--     do `parcerias_jogador`).
--   - percentual = pontos / (partidas*3) -> razao sobre o maximo possivel.
--   - filtro HAVING COUNT(*) >= p_min_partidas (default 5) para evitar fluke.
--   - vitorias empregadas sao SEMPRE do ponto de vista do time conjugado:
--     a.time vs pl.vencedor (igual ranking/parcerias_jogador).
--   - exclui jogadores com posicao='random' (placeholders random1..6).
-- Considera apenas partidas com status IN ('published','closed').
-- O ORDER BY pontos DESC coloca a "melhor dupla" no topo e a "pior" no fim.

CREATE OR REPLACE FUNCTION pares_racha(
  p_min_partidas integer DEFAULT 5
)
RETURNS TABLE (
  jogador_a_id    bigint,
  jogador_b_id    bigint,
  jogador_a_nome  text,
  jogador_b_nome  text,
  partidas        bigint,
  vitorias        bigint,
  empates         bigint,
  derrotas        bigint,
  pontos          bigint,
  percentual      numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  -- CTE 1: cada (partida, time, jogador) com o vencedor da partida.
  --        Filtra status e exclui jogadores placeholder 'random'.
  WITH participacoes AS (
    SELECT
      pp.partida_id,
      pp.time,
      pp.jogador_id,
      pl.vencedor
    FROM partidas_participantes pp
    JOIN partidas       p  ON p.id  = pp.partida_id
    JOIN partida_placar pl ON pl.partida_id = pp.partida_id
    JOIN jogadores      j  ON j.id  = pp.jogador_id
    WHERE p.status IN ('published','closed')
      AND j.posicao <> 'random'
  ),
  -- CTE 2: self-join na mesma (partida, time) -> cada par de companheiros.
  --        a.jogador_id < b.jogador_id garante o par nao-ordenado (unico).
  pares AS (
    SELECT
      a.jogador_id AS jogador_a_id,
      b.jogador_id AS jogador_b_id,
      a.vencedor   AS vencedor,
      a.time       AS time
    FROM participacoes a
    JOIN participacoes b
      ON b.partida_id = a.partida_id
     AND b.time       = a.time
     AND b.jogador_id > a.jogador_id
  ),
  -- CTE 3: agrega por par, contando V/E/D e aplicando o filtro de minimo.
  agregado AS (
    SELECT
      jogador_a_id,
      jogador_b_id,
      COUNT(*)::bigint                                      AS partidas,
      COUNT(*) FILTER (WHERE vencedor = time)::bigint       AS vitorias,
      COUNT(*) FILTER (WHERE vencedor = 'empate')::bigint   AS empates,
      COUNT(*) FILTER (WHERE vencedor <> time
                        AND vencedor <> 'empate')::bigint    AS derrotas
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

-- 036_create_push_notifications.sql
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id           bigserial PRIMARY KEY,
  jogador_id   bigint NOT NULL REFERENCES jogadores(id) ON DELETE CASCADE,
  endpoint     text NOT NULL UNIQUE,
  p256dh       text NOT NULL,
  auth         text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_jogador
  ON push_subscriptions (jogador_id);

CREATE TABLE IF NOT EXISTS push_reminder_deliveries (
  partida_id    bigint NOT NULL REFERENCES partidas(id) ON DELETE CASCADE,
  jogador_id    bigint NOT NULL REFERENCES jogadores(id) ON DELETE CASCADE,
  reminder_key  text NOT NULL CHECK (reminder_key IN ('6h', '3h', '1h', '30m')),
  claimed_at    timestamptz NOT NULL DEFAULT now(),
  sent_at       timestamptz,
  error_message text,
  PRIMARY KEY (partida_id, jogador_id, reminder_key)
);

CREATE INDEX IF NOT EXISTS idx_push_reminders_claimed
  ON push_reminder_deliveries (claimed_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON push_subscriptions TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE push_subscriptions_id_seq TO anon, authenticated;
REVOKE ALL ON push_reminder_deliveries FROM anon, authenticated;

-- 037_push_function_permissions.sql
CREATE EXTENSION IF NOT EXISTS pg_net;

GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT ON public.partidas,
  public.partidas_participantes,
  public.jogadores,
  public.votes,
  public.push_subscriptions,
  public.push_reminder_deliveries
  TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.push_subscriptions,
  public.push_reminder_deliveries
  TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.push_subscriptions_id_seq
  TO service_role;

-- 040_schedule_push_reminders.sql
-- Agenda a chamada da Edge Function de lembretes a cada minuto.
-- O segredo `push_cron_secret` deve ser criado no Vault separadamente.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobname = 'enviar-lembretes-votacao-1min'
  ) THEN
    PERFORM cron.unschedule('enviar-lembretes-votacao-1min');
  END IF;
END;
$$;

SELECT cron.schedule(
  'enviar-lembretes-votacao-1min',
  '* * * * *',
  $push_job$
  SELECT net.http_post(
    url := 'https://jtavmrlllyctkuxefhpc.supabase.co/functions/v1/send-voting-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-cron-secret', (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'push_cron_secret'
      )
    ),
    body := '{}'::jsonb
  );
  $push_job$
);

-- 041_rpc_descartar_votos.sql
-- RPC `descartar_votos(p_partida_id, p_voter_id) RETURNS boolean`:
--   Apaga TODOS os votos de um votante numa partida, devolvendo-o ao estado
--   "ainda nao votei" para refazer do zero. Bloqueio server-side identico ao
--   `registrar_votos` (status='published' E voting_closes_at > now()).
--   Retorna true se sucesso (mesmo que 0 linhas apagadas); false caso contrario.

CREATE OR REPLACE FUNCTION descartar_votos(
  p_partida_id  bigint,
  p_voter_id    bigint
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status           text;
  v_voting_closes_at timestamptz;
BEGIN
  -- (1) Bloqueio de janela: partida deve estar published e dentro do prazo.
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

  -- (2) Só participa do descarte quem podia votar (participante e não-random).
  PERFORM 1
    FROM partidas_participantes pp
    JOIN jogadores j ON j.id = pp.jogador_id
    WHERE pp.partida_id = p_partida_id
      AND pp.jogador_id = p_voter_id
      AND j.username NOT ILIKE 'random%';
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- (3) DELETE de todos os votos do votante na partida, em transacao.
  BEGIN
    DELETE FROM votes
    WHERE partida_id = p_partida_id
      AND voter_id = p_voter_id;

    RETURN true;

  EXCEPTION WHEN OTHERS THEN
    ROLLBACK;
    RETURN false;
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION descartar_votos(bigint, bigint) TO anon, authenticated;

-- 042_rpc_parcerias_destaque_jogador.sql
-- RPC `parcerias_destaque_jogador(p_jogador_id bigint, p_min_partidas integer DEFAULT 5)`
-- Devolve ate 3 linhas com companheiros de time (mesmo time) que mais se
-- associaram ao jogador logado em metricas de gols e notas:
--   - 'mais_gols'   : companheiro com quem o jogador logado mais marcou gols.
--   - 'melhor_nota' : maior AVG(partida_notas.avg_rating) do proprio usuario.
--   - 'pior_nota'   : mesma metrica, menor valor.
-- Apenas partidas com status IN ('published','closed'); HAVING >= p_min_partidas
-- (default 5); exclui placeholders (posicao='random'). Gols = UP	only `gols`
-- (sem gols_contra). Nota SEMPRE do proprio usuario (target_id = p_jogador_id).

CREATE OR REPLACE FUNCTION parcerias_destaque_jogador(
  p_jogador_id    bigint,
  p_min_partidas  integer DEFAULT 5
)
RETURNS TABLE (
  metrica           text,
  outro_jogador_id  bigint,
  nome              text,
  partidas          bigint,
  valor             numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH jogador_partidas AS (
    SELECT pp.partida_id, pp.time
    FROM partidas_participantes pp
    JOIN partidas p ON p.id = pp.partida_id
    WHERE pp.jogador_id = p_jogador_id
      AND p.status IN ('published','closed')
  ),
  usuario_gols AS (
    SELECT partida_id, gols
    FROM partidas_participantes
    WHERE jogador_id = p_jogador_id
  ),
  usuario_notas AS (
    SELECT partida_id, avg_rating
    FROM partida_notas
    WHERE target_id = p_jogador_id
  ),
  companheiros AS (
    SELECT
      outp.jogador_id,
      j.nome,
      COUNT(*)::bigint                                       AS partidas,
      COALESCE(SUM(ug.gols), 0)::numeric                     AS gols_usuario,
      AVG(un.avg_rating)::numeric                            AS nota_media_usuario
    FROM jogador_partidas jp
    JOIN partidas_participantes outp
      ON outp.partida_id = jp.partida_id
     AND outp.time       = jp.time
     AND outp.jogador_id <> p_jogador_id
    JOIN jogadores      j   ON j.id  = outp.jogador_id
    LEFT JOIN usuario_gols  ug ON ug.partida_id = jp.partida_id
    LEFT JOIN usuario_notas un ON un.partida_id = jp.partida_id
    WHERE j.posicao <> 'random'
    GROUP BY outp.jogador_id, j.username
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

-- 049_update_resumo_ano_sequencias_atuais.sql / 073_resumo_ano_minimo_33_porcento.sql
-- Atualiza resumo_ano(p_ano) para considerar somente jogadores com pelo menos 33% das partidas jogadas no ano.

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
SECURITY DEFINER
SET search_path = public
AS $$
  WITH partidas_ano AS (
    SELECT p.id, p.data_jogo
    FROM partidas p
    WHERE p.status IN ('published', 'closed')
      AND EXTRACT(
        YEAR FROM p.data_jogo AT TIME ZONE 'America/Sao_Paulo'
      )::integer = p_ano
  ),
  total AS (
    SELECT COUNT(*)::bigint AS partidas
    FROM partidas_ano
  ),
  stats AS (
    SELECT
      pp.jogador_id,
      j.username,
      COUNT(*)::bigint AS partidas,
      COALESCE(SUM(pp.gols), 0)::bigint AS gols,
      COALESCE(SUM(pp.assistencias), 0)::bigint AS assistencias,
      COUNT(*) FILTER (WHERE pl.vencedor = pp.time)::bigint AS vitorias
    FROM partidas_participantes pp
    JOIN partidas p ON p.id = pp.partida_id
    JOIN partidas_ano pa ON pa.id = p.id
    JOIN partida_placar pl ON pl.partida_id = pp.partida_id
    JOIN jogadores j ON j.id = pp.jogador_id
    WHERE j.posicao <> 'random'
    GROUP BY pp.jogador_id, j.username
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
      pp.jogador_id,
      j.username,
      p.id AS partida_id,
      p.data_jogo,
      (pl.vencedor = pp.time) AS venceu,
      ROW_NUMBER() OVER (
        PARTITION BY pp.jogador_id
        ORDER BY p.data_jogo DESC, p.id DESC
      ) AS rn
    FROM partidas_participantes pp
    JOIN partidas_ano pa ON pa.id = pp.partida_id
    JOIN partidas p ON p.id = pa.id
    JOIN partida_placar pl ON pl.partida_id = pp.partida_id
    JOIN jogadores j ON j.id = pp.jogador_id
    WHERE j.posicao <> 'random'
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
  maior_sequencia_vitorias AS (
    SELECT sv.jogador_id, sv.username, sv.tamanho
    FROM sequencias_vitorias_atuais sv
    JOIN stats_elegiveis s ON s.jogador_id = sv.jogador_id
    WHERE sv.tamanho > 0
    ORDER BY sv.tamanho DESC, s.partidas DESC, sv.username ASC
    LIMIT 1
  ),
  maior_seca_vitorias AS (
    SELECT sv.jogador_id, sv.username, sv.tamanho
    FROM secas_vitorias_atuais sv
    JOIN stats_elegiveis s ON s.jogador_id = sv.jogador_id
    WHERE sv.tamanho > 0
    ORDER BY sv.tamanho DESC, s.partidas DESC, sv.username ASC
    LIMIT 1
  ),
  artilheiro AS (
    SELECT s.* FROM stats_elegiveis s
    ORDER BY s.gols DESC, s.partidas DESC, s.username ASC
    LIMIT 1
  ),
  maestro AS (
    SELECT s.* FROM stats_elegiveis s
    ORDER BY s.assistencias DESC, s.partidas DESC, s.username ASC
    LIMIT 1
  ),
  participante AS (
    SELECT s.* FROM stats_elegiveis s
    ORDER BY s.partidas DESC, s.gols DESC, s.username ASC
    LIMIT 1
  ),
  eficiente AS (
    SELECT s.* FROM stats_elegiveis s
    ORDER BY s.vitorias::numeric / NULLIF(s.partidas, 0) DESC,
             s.partidas DESC, s.username ASC
    LIMIT 1
  )
  SELECT
    p_ano,
    t.partidas,
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
    CASE
      WHEN e.jogador_id IS NULL THEN NULL
      ELSE e.vitorias::numeric / NULLIF(e.partidas, 0)
    END,
    sv.jogador_id,
    sv.username,
    sv.tamanho,
    ss.jogador_id,
    ss.username,
    ss.tamanho
  FROM total t
  LEFT JOIN artilheiro a ON true
  LEFT JOIN maestro m ON true
  LEFT JOIN participante pt ON true
  LEFT JOIN eficiente e ON true
  LEFT JOIN maior_sequencia_vitorias sv ON true
  LEFT JOIN maior_seca_vitorias ss ON true;
$$;

GRANT EXECUTE ON FUNCTION resumo_ano(integer) TO anon, authenticated;


-- 051_create_dividas.sql
-- (mirror para bootstrap) Controle financeiro: cada linha = UMA dívida individual
-- de um jogador. Total devido por jogador = SUM(valor) WHERE paga = false.

CREATE TABLE dividas (
  id             bigserial     PRIMARY KEY,
  jogador_id     bigint        NOT NULL REFERENCES jogadores(id) ON DELETE CASCADE,
  tipo           text          NOT NULL CHECK (tipo IN ('mensalidade','avulso','outro')),
  valor          numeric(10,2) NOT NULL CHECK (valor > 0),
  descricao      text,
  referencia     text,
  partida_id     bigint        REFERENCES partidas(id) ON DELETE SET NULL,
  data_divida    date          NOT NULL DEFAULT current_date,
  paga           boolean       NOT NULL DEFAULT false,
  data_pagamento date,
  created_at     timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX idx_dividas_jogador   ON dividas (jogador_id);
CREATE INDEX idx_dividas_em_aberto ON dividas (jogador_id) WHERE paga = false;

CREATE UNIQUE INDEX uq_dividas_mensalidade_mes
  ON dividas (jogador_id, referencia)
  WHERE tipo = 'mensalidade' AND referencia IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON dividas TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE dividas_id_seq TO anon, authenticated;

CREATE OR REPLACE FUNCTION registrar_divida(
  p_jogador_id  bigint,
  p_tipo        text,
  p_valor       numeric,
  p_data_divida date,
  p_descricao   text,
  p_referencia  text,
  p_partida_id  bigint
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id bigint;
BEGIN
  IF p_valor IS NULL OR p_valor <= 0 THEN
    RAISE EXCEPTION 'Valor da dívida deve ser maior que zero.';
  END IF;
  INSERT INTO dividas (jogador_id, tipo, valor, data_divida, descricao, referencia, partida_id)
  VALUES (p_jogador_id, p_tipo, p_valor, COALESCE(p_data_divida, current_date),
          p_descricao, p_referencia, p_partida_id)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION registrar_divida(bigint, text, numeric, date, text, text, bigint) TO anon, authenticated;

CREATE OR REPLACE FUNCTION quitar_divida(p_divida_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE dividas SET paga = true, data_pagamento = current_date WHERE id = p_divida_id;
END;
$$;
GRANT EXECUTE ON FUNCTION quitar_divida(bigint) TO anon, authenticated;

CREATE OR REPLACE FUNCTION quitar_dividas_jogador(p_jogador_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE dividas SET paga = true, data_pagamento = current_date
   WHERE jogador_id = p_jogador_id AND paga = false;
END;
$$;
GRANT EXECUTE ON FUNCTION quitar_dividas_jogador(bigint) TO anon, authenticated;

-- 052_seed_divida_tadeu.sql
-- (mirror para bootstrap) No-op se 'tadeu' ainda não existir (aplicar_tudo.sql nao
-- inclui o seed de jogadores). Em `db push` normal roda apos o seed de jogadores.
INSERT INTO dividas (jogador_id, tipo, valor, referencia, data_divida, descricao)
SELECT id, 'mensalidade', 90.00, '2026-08', current_date, 'Mensalidade Agosto/2026'
  FROM jogadores
 WHERE username = 'tadeu'
ON CONFLICT DO NOTHING;

-- 053_view_dividas_resumo.sql
CREATE OR REPLACE VIEW dividas_resumo AS
SELECT
  j.id            AS jogador_id,
  j.username      AS username,
  j.is_mensalista AS is_mensalista,
  COALESCE(SUM(d.valor) FILTER (WHERE d.paga = false), 0)::numeric AS total_devido,
  COUNT(d.id)     FILTER (WHERE d.paga = false)::bigint          AS qtd_dividas
FROM jogadores j
LEFT JOIN dividas d ON d.jogador_id = j.id
GROUP BY j.id, j.username, j.is_mensalista;

GRANT SELECT ON dividas_resumo TO anon, authenticated;

-- 054_avulsos_partida.sql
CREATE UNIQUE INDEX uq_dividas_avulso_partida
  ON dividas (partida_id, jogador_id)
  WHERE tipo = 'avulso' AND partida_id IS NOT NULL;

CREATE OR REPLACE FUNCTION gerar_avulsos_partida(p_partida_id bigint)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO dividas (jogador_id, tipo, valor, partida_id, data_divida, referencia, descricao)
  SELECT
    pp.jogador_id, 'avulso', 20.00, p.id,
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

CREATE OR REPLACE FUNCTION publicar_partida(p_partida_id bigint)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status text;
BEGIN
  SELECT status INTO v_status FROM partidas WHERE id = p_partida_id;
  IF v_status IS NULL OR v_status <> 'draft' THEN RETURN false; END IF;
  PERFORM gerar_avulsos_partida(p_partida_id);
  UPDATE partidas SET status = 'published', voting_closes_at = now() + interval '24 hours' WHERE id = p_partida_id;
  RETURN true;
END;
$$;
GRANT EXECUTE ON FUNCTION publicar_partida(bigint) TO anon, authenticated;

CREATE OR REPLACE FUNCTION finalizar_partida(p_partida_id bigint)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status text;
BEGIN
  SELECT status INTO v_status FROM partidas WHERE id = p_partida_id;
  IF v_status IS NULL OR v_status <> 'live' THEN RETURN false; END IF;
  PERFORM sincronizar_contadores_partida(p_partida_id);
  PERFORM gerar_avulsos_partida(p_partida_id);
  UPDATE partidas SET status = 'published', voting_closes_at = now() + interval '24 hours' WHERE id = p_partida_id;
  RETURN true;
END;
$$;
GRANT EXECUTE ON FUNCTION finalizar_partida(bigint) TO anon, authenticated;

-- 055_cron_mensalidades.sql
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'gerar-mensalidades-mensal') THEN
    PERFORM cron.unschedule('gerar-mensalidades-mensal');
  END IF;
END;
$$;

SELECT cron.schedule(
  'gerar-mensalidades-mensal',
  '0 13 1 * *',
  $$
  INSERT INTO dividas (jogador_id, tipo, valor, referencia, data_divida, descricao)
  SELECT
    j.id, 'mensalidade', 90.00,
    to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM'),
    (now() AT TIME ZONE 'America/Sao_Paulo')::date,
    'Mensalidade ' || to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'MM/YYYY')
  FROM jogadores j
  WHERE j.is_mensalista = true
    AND j.is_ativo = true
    AND j.posicao <> 'goleiro'
  ON CONFLICT DO NOTHING;
  $$
);

-- 057_confirmacoes_presenca.sql
--
-- Confirmação de presença dos mensalistas para a partida automática semanal.
--
-- Modelo:
--   * partidas_participantes ganha status_confirmacao ∈ ('pendente','confirmado','recusado')
--     e confirmado_em. O elenco e a confirmação são a mesma entidade (como hoje).
--   * partidas ganha confirmacao_closes_at (quarta 16h BR da semana): a partir
--     daí as reservas dos 'pendente' são liberadas — avulsos do admin e
--     mensalistas atrasados disputam as vagas restantes (first-come-first-served).
--   * time vira nullable: a criação automática pré-inscreve os mensalistas SEM
--     time (o admin monta os times depois). posicao continua NOT NULL porque
--     TODO mensalista tem posição — ela é copiada de jogadores.posicao.
--
-- Regra única de capacidade (16):
--   ocupa(p) = (status='confirmado') OR (status='pendente' AND now() < closes_at)
--   Uma transição para o estado `alvo` é permitida sse
--     vagas_ocupadas_pelos_DEMAIS + (1 se ocupa(alvo) senão 0) <= 16.
--   => sair (recusar / desconfirmar pós-prazo) sempre libera; confirmar/reaver
--      vaga respeita o limite de 16.
--
-- Obs.: relaxa também o CHECK de push_reminder_deliveries.reminder_key para
-- permitir o tipo 'confirmacao' (reuso do ledger de idempotência do push).

-- 1) `time` nullable (posicao segue NOT NULL — copiada de jogadores.posicao).
ALTER TABLE partidas_participantes
  ALTER COLUMN time DROP NOT NULL;

-- 2) Confirmação de presença por participante + prazo na partida.
ALTER TABLE partidas_participantes
  ADD COLUMN status_confirmacao text NOT NULL DEFAULT 'pendente'
    CHECK (status_confirmacao IN ('pendente','confirmado','recusado')),
  ADD COLUMN confirmado_em timestamptz;

ALTER TABLE partidas
  ADD COLUMN confirmacao_closes_at timestamptz;

-- 3) Relaxa o CHECK de reminder_key para permitir 'confirmacao'
--    (além dos buckets 6h/3h/1h/30m e slots HH:MM da migration 045).
ALTER TABLE push_reminder_deliveries
  DROP CONSTRAINT IF EXISTS push_reminder_deliveries_reminder_key_check;
ALTER TABLE push_reminder_deliveries
  ADD CONSTRAINT push_reminder_deliveries_reminder_key_check
  CHECK (
    reminder_key IN ('6h','3h','1h','30m','confirmacao')
    OR reminder_key ~ '^([01][0-9]|2[0-3]):(00|15|30|45)$'
  );

-- 4) RPC: o próprio jogador confirma/desconfirma/recusa a própria presença.
--    p_status ∈ ('pendente','confirmado','recusado'). Aplica a regra de capacidade.
--    Só opera em partidas em 'draft'. (Modelo de confiança atual: jogador_id vem
--    do client; o gate de "é o próprio jogador" é no client.)
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
  v_closes_at      timestamptz;
  v_atual          text;
  v_ocupadas       bigint;
  v_alvo_ocupa     boolean;
BEGIN
  IF p_status NOT IN ('pendente','confirmado','recusado') THEN
    RETURN false;
  END IF;

  SELECT p.status, p.confirmacao_closes_at
    INTO v_status_partida, v_closes_at
    FROM partidas p
    WHERE p.id = p_partida_id;
  IF v_status_partida IS NULL OR v_status_partida <> 'draft' THEN
    RETURN false;
  END IF;

  SELECT pp.status_confirmacao INTO v_atual
    FROM partidas_participantes pp
    WHERE pp.partida_id = p_partida_id AND pp.jogador_id = p_jogador_id;
  IF NOT FOUND THEN
    RETURN false;  -- não convidado para esta partida
  END IF;

  -- vagas ocupadas pelos DEMAIS jogadores (regra de capacidade).
  SELECT count(*) INTO v_ocupadas
    FROM partidas_participantes pp
    WHERE pp.partida_id = p_partida_id
      AND pp.jogador_id <> p_jogador_id
      AND (
        pp.status_confirmacao = 'confirmado'
        OR (pp.status_confirmacao = 'pendente' AND now() < COALESCE(v_closes_at, now()))
      );

  -- estado-alvo ocupa vaga?
  v_alvo_ocupa := (p_status = 'confirmado')
               OR (p_status = 'pendente' AND now() < COALESCE(v_closes_at, now()));

  IF v_alvo_ocupa AND v_ocupadas >= 14 THEN
    RETURN false;  -- vagas esgotadas
  END IF;

  UPDATE partidas_participantes
    SET status_confirmacao = p_status,
        confirmado_em = CASE WHEN p_status = 'confirmado' THEN now() ELSE NULL END
    WHERE partida_id = p_partida_id AND jogador_id = p_jogador_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION confirmar_presenca(bigint, bigint, text) TO anon, authenticated;

-- 5) RPC: admin altera o status de QUALQUER jogador (confirmar/desconfirmar/
--    recusar), inclusive o criador da partida. Mesma regra de capacidade.
--    Valida is_admin server-side (fortalece o gate que hoje é só client-side).
CREATE OR REPLACE FUNCTION admin_definir_confirmacao(
  p_partida_id bigint,
  p_jogador_id bigint,
  p_status     text,
  p_admin_id   bigint
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM jogadores WHERE id = p_admin_id AND is_admin) THEN
    RETURN false;
  END IF;
  RETURN confirmar_presenca(p_partida_id, p_jogador_id, p_status);
END;
$$;

GRANT EXECUTE ON FUNCTION admin_definir_confirmacao(bigint, bigint, text, bigint) TO anon, authenticated;

-- 6) RPC: admin adiciona um avulso (típicamente após o prazo, para preencher
--    vagas liberadas). Insere como 'confirmado', SEM time (admin atribui depois),
--    com posicao copiada de jogadores. Só se houver vaga livre (< 14 ocupadas).
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
  v_closes_at      timestamptz;
  v_ocupadas       bigint;
  v_existe         boolean;
BEGIN
  SELECT p.status, p.confirmacao_closes_at
    INTO v_status_partida, v_closes_at
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
      AND (
        pp.status_confirmacao = 'confirmado'
        OR (pp.status_confirmacao = 'pendente' AND now() < COALESCE(v_closes_at, now()))
      );
  IF v_ocupadas >= 14 THEN
    RETURN false;  -- sem vagas
  END IF;

  INSERT INTO partidas_participantes (partida_id, jogador_id, posicao, status_confirmacao)
    SELECT p_partida_id, j.id, j.posicao, 'confirmado'
    FROM jogadores j
    WHERE j.id = p_jogador_id;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION adicionar_participante(bigint, bigint) TO anon, authenticated;

-- 058_abrir_partida_so_confirmados.sql
--
-- Com a confirmação de presença (migration 057), o elenco que efetivamente
-- joga é o conjunto dos 'confirmado' (7 por time, max 1 goleiro por time).
-- `abrir_partida` agora filtra por status_confirmacao='confirmado' nas
-- contagens e no reset de placar, ignorando pendente/recusado (que ficam
-- apenas como registro na lista pública).

CREATE OR REPLACE FUNCTION abrir_partida(p_partida_id bigint)
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
  SELECT status INTO v_status
  FROM partidas
  WHERE id = p_partida_id;

  IF v_status IS NULL OR v_status <> 'draft' THEN
    RETURN false;
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE time = 'a'),
    COUNT(*) FILTER (WHERE time = 'b'),
    COUNT(*) FILTER (WHERE time = 'a' AND posicao = 'goleiro'),
    COUNT(*) FILTER (WHERE time = 'b' AND posicao = 'goleiro')
  INTO v_time_a, v_time_b, v_gk_a, v_gk_b
  FROM partidas_participantes
  WHERE partida_id = p_partida_id
    AND status_confirmacao = 'confirmado';

  IF v_time_a <> 7 OR v_time_b <> 7 THEN
    RETURN false;
  END IF;

  -- Cada time pode ter no máximo 1 goleiro.
  IF v_gk_a > 1 OR v_gk_b > 1 THEN
    RETURN false;
  END IF;

  DELETE FROM partida_eventos WHERE partida_id = p_partida_id;

  -- Zera placar só de quem vai jogar (confirmado).
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

GRANT EXECUTE ON FUNCTION abrir_partida(bigint) TO anon, authenticated;

-- Ajusta criar_partida (fluxo manual, migration 013) para marcar os participantes
-- escolhidos pelo admin como 'confirmado' (default do novo campo seria 'pendente').
-- Como o admin já definiu o elenco ao criar, abrir_partida (que agora conta só
-- confirmados) continua validando o elenco completo normalmente.
CREATE OR REPLACE FUNCTION criar_partida(
  p_data_jogo       timestamptz,
  p_criado_por      bigint,
  p_participantes   jsonb
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
  BEGIN
    INSERT INTO partidas (data_jogo, status, criado_por)
    VALUES (p_data_jogo, 'draft', p_criado_por)
    RETURNING id INTO v_partida_id;

    FOR elem IN SELECT * FROM jsonb_array_elements(p_participantes)
    LOOP
      INSERT INTO partidas_participantes
        (partida_id, jogador_id, time, posicao, gols, assistencias, gols_contra, status_confirmacao)
      VALUES (
        v_partida_id,
        (elem->>'jogador_id')::bigint,
        (elem->>'time')::char(1),
        (elem->>'posicao')::text,
        COALESCE((elem->>'gols')::integer, 0),
        COALESCE((elem->>'assistencias')::integer, 0),
        COALESCE((elem->>'gols_contra')::integer, 0),
        'confirmado'
      );
    END LOOP;

    RETURN v_partida_id;

  EXCEPTION WHEN OTHERS THEN
    ROLLBACK;
    RETURN NULL;
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION criar_partida(timestamptz, bigint, jsonb) TO anon, authenticated;

-- 059_rpc_criar_partida_semanal.sql
--
-- Cria automaticamente a partida semanal (quinta 19h BRT) já com todos os
-- mensalistas ativos pré-inscritos como 'pendente', e deadline de confirmação
-- na quarta 16h BRT. Idempotente: se já existe partida em draft nesta semana,
-- retorna NULL sem recriar. Acionada pela cron da migration 060.
--
-- BRT = UTC-3 fixo. date_trunc('week', ...) usa segunda como início (ISO).
-- Conversões via AT TIME ZONE 'America/Sao_Paulo' (padrão das migrations 028/049/055).

CREATE OR REPLACE FUNCTION criar_partida_semanal_mensalistas()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inicio_semana timestamp;   -- segunda 00:00 BRT (naive)
  v_data_jogo     timestamptz; -- quinta 19h BRT
  v_closes_at     timestamptz; -- quarta 16h BRT
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

  -- Pré-inscreve os mensalistas ativos, com sua posição (todo mensalista tem
  -- posição), SEM time (admin atribui depois). status_confirmacao='pendente'.
  INSERT INTO partidas_participantes (partida_id, jogador_id, posicao, status_confirmacao)
    SELECT v_partida_id, j.id, j.posicao, 'pendente'
    FROM jogadores j
    WHERE j.is_mensalista = true AND j.is_ativo = true;

  RETURN v_partida_id;
END;
$$;

GRANT EXECUTE ON FUNCTION criar_partida_semanal_mensalistas() TO anon, authenticated;

-- 060_cron_agendar_partida_semanal.sql
--
-- Toda segunda às 10:00 (Brasília): cria a partida semanal (RPC 059) e, se uma
-- partida nova foi criada, dispara o push de pedido de confirmação para os
-- mensalistas (Edge Function send-confirmation-requests).
--
-- BRT = UTC-3 fixo => 10:00 BRT == 13:00 UTC => "0 13 * * 1" (segunda).
-- O pg_cron do Supabase avalia o cron no fuso da sessão (UTC), por isso a hora
-- vai em UTC. Padrão de agendamento: unschedule-if-exists -> schedule (040/055).

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'agendar-partida-semanal') THEN
    PERFORM cron.unschedule('agendar-partida-semanal');
  END IF;
END;
$$;

SELECT cron.schedule(
  'agendar-partida-semanal',
  '0 13 * * 1',
  $semanal$
  DO $$
  DECLARE
    v_partida_id bigint;
    v_secret     text;
  BEGIN
    SELECT criar_partida_semanal_mensalistas() INTO v_partida_id;
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
-- 071_view_partidas_com_placar.sql
--
-- View `partidas_com_placar` com colunas: id, data_jogo, status, gols_time_a, gols_time_b.
-- LEFT JOIN de `partidas` com a view agregada `partida_placar` para que o mural
-- de Jogos resolva partidas + placares em UMA unica query, eliminando o
-- waterfall no client (query 1: `partidas`; espera; query 2: `partida_placar.in(ids)`).
--
-- Atencao a partidas SEM placar (rascunho recem-criado, partida sem gols):
--   mesmo principio do LEFT JOIN da view `partida_placar` (007): COALESCE(...,0)
--   garante que toda partida apareca com placar 0x0 mesmo sem linha agregada.
--   A UI continua exibindo o placar tracejado para partidas em status 'draft'.

CREATE OR REPLACE VIEW partidas_com_placar AS
SELECT
  p.id                        AS id,
  p.data_jogo                 AS data_jogo,
  p.status                    AS status,
  COALESCE(pp.gols_time_a, 0) AS gols_time_a,
  COALESCE(pp.gols_time_b, 0) AS gols_time_b
FROM partidas p
LEFT JOIN partida_placar pp ON pp.partida_id = p.id;

GRANT SELECT ON partidas_com_placar TO anon, authenticated;

-- 070_rpc_medias_notas_jogadores.sql
--
-- RPC para obter a média geral aparada das notas de cada jogador
-- agregada no servidor, substituindo o download integral da tabela `votes` no cliente.
--
-- Regra:
--   - Se o jogador tiver 3 ou mais notas recebidas, descarta 1 menor e 1 maior:
--     (SUM(rating) - MIN(rating) - MAX(rating))::numeric / (COUNT(*) - 2)
--   - Se tiver 1 ou 2 notas, calcula a média simples AVG(rating).
--   - Retorna array/linhas com jogador_id e media_nota arredondada para 2 casas decimais.
--
-- (Incluída tardiamente neste script mestre — a migration 072 aproveitou o
--  momento para sanar a lacuna, regra 7.2 do AGENTS.md.)

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
      CASE
        WHEN COUNT(*) >= 3 THEN (SUM(v.rating) - MIN(v.rating) - MAX(v.rating))::numeric / (COUNT(*) - 2)
        ELSE AVG(v.rating)::numeric
      END,
      2
    ) AS media_nota
  FROM votes v
  GROUP BY v.target_id;
$$;

GRANT EXECUTE ON FUNCTION obter_medias_notas_jogadores() TO anon, authenticated;

-- 072_rpc_confronto_direto.sql
--
-- RPCs do Comparador Cara-a-Cara (Confronto Direto). Toda a agregação vive no
-- PostgreSQL (regra 7.5 do AGENTS.md: nunca baixar tabelas para agregar no client).
-- Precedentes de leitura agregada: `parcerias_jogador` (030) e
-- `parcerias_destaque_jogador` (042).
--
-- Função 1 — `confronto_direto(p_jogador_a, p_jogador_b)`:
--   Devolve SEMPRE 4 linhas (lado 'a'/'b' × bloco 'juntos'/'adversos') com a
--   produção individual (gols/assistências/gols_contra), o retrospecto V/E/D do
--   time do atleta e a média de nota (aparada, via view `partida_notas`) de cada
--   atleta no contexto:
--     - 'juntos'   = encontros em que ambos vestiram o MESMO time (time_a =
--                    time_b); o retrospecto é comum aos dois lados;
--     - 'adversos' = encontros em times opostos (time_a <> time_b); o
--                    retrospecto é individual e espelhado (vitória de A =
--                    derrota de B), pois cada linha compara o PRÓPRIO time do
--                    atleta com o `vencedor` da partida.
--   Contexto sem nenhuma partida devolve a linha com zeros e `media_nota` NULL
--   (o client decide exibir ou não o bloco). A ordenação `bloco, lado` é
--   cortesia; o client mapeia por (lado, bloco), nunca por índice.
--
-- Função 2 — `confronto_direto_partidas(p_jogador_a, p_jogador_b, p_limite)`:
--   Histórico das últimas partidas compartilhadas (mais recentes primeiro):
--   data, relação ('juntos'/'adversos'), time do jogador A ('a'/'b'), placar
--   final e vencedor. Atenção à semântica das colunas de placar: `gols_time_a` /
--   `gols_time_b` são os gols dos times 'a' e 'b' DA PARTIDA (passthrough da
--   view `partida_placar`), NÃO o placar do time de cada atleta comparado — o
--   client cruza com `time_a` para saber de que lado cada um jogou.
--   `p_limite` sofre clamp defensivo: LEAST(GREATEST(p_limite, 1), 50).
--
-- Regras comuns às duas funções:
--   - Encontros = partidas com status IN ('published','closed') em que AMBOS os
--     atletas participaram (draft/live não contam, igual ao ranking e às
--     parcerias). O vencedor e o placar vêm da view `partida_placar`, mesma
--     fonte das views `ranking`/`stats_jogador` (gols contra já corrigidos
--     pelas migrations 061-064).
--   - Validações server-side via RAISE EXCEPTION (por isso LANGUAGE plpgsql,
--     pois RAISE não existe em funções LANGUAGE sql — precedente
--     `salvar_edicao_partida`, 068):
--       * p_jogador_a = p_jogador_b                 -> 'Selecione dois atletas diferentes.'
--       * id inexistente OU posicao = 'random'      -> 'Atleta não encontrado.'
--     (placeholders `random\d*` ficam fora dos relatórios — regra 8.6.)
--   - Notas: LEFT JOIN com a view `partida_notas`, que agrega por
--     (partida_id, target_id) => 1 linha por partida, logo o JOIN não infla
--     COUNT/AVG (mesmo artifício da 042). Partida sem nota apenas sai do AVG.
--   - Em plpgsql TODAS as colunas do RETURNS TABLE viram variáveis: todas as
--     referências de coluna estão qualificadas com alias de tabela (`pp.gols`,
--     `p.status`, `pl.vencedor`...) para evitar a ambiguidade corrigida na
--     migration 044.
--   - STABLE (leitura agregada pura), SECURITY DEFINER + SET search_path =
--     public, GRANT EXECUTE explícito para anon/authenticated. ZERO UUID
--     (apenas bigint/bigserial).
--
-- Nota de nomenclatura (regra 7.3-1): a diretriz pede infinitivo, porém as RPCs
-- de leitura canônicas do projeto são substantivos (`parcerias_jogador`,
-- `pares_racha`, `parcerias_destaque_jogador`) — mantém-se o substantivo
-- `confronto_direto` pelo precedente interno.

CREATE OR REPLACE FUNCTION confronto_direto(
  p_jogador_a    bigint,
  p_jogador_b    bigint
)
RETURNS TABLE (
  lado           text,    -- 'a' | 'b' (referente a p_jogador_a / p_jogador_b)
  bloco          text,    -- 'juntos' | 'adversos'
  partidas       bigint,
  gols           bigint,  -- produção do atleta nas partidas do contexto
  assistencias   bigint,
  gols_contra    bigint,
  vitorias       bigint,  -- retrospecto do time do atleta no contexto
  empates        bigint,
  derrotas       bigint,
  media_nota     numeric  -- AVG(partida_notas.avg_rating) do atleta no contexto (NULL se nunca recebeu nota)
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1) Validações dos parâmetros.
  IF p_jogador_a = p_jogador_b THEN
    RAISE EXCEPTION 'Selecione dois atletas diferentes.';
  END IF;

  IF (SELECT COUNT(*) FROM jogadores j
       WHERE j.id IN (p_jogador_a, p_jogador_b)
         AND j.posicao <> 'random') <> 2 THEN
    RAISE EXCEPTION 'Atleta não encontrado.';
  END IF;

  -- 2) Agregados por (lado, bloco); o LEFT JOIN final garante as 4 linhas.
  RETURN QUERY
  WITH encontros AS (
    -- Partidas decididas em que AMBOS participaram, com o time de cada um e o
    -- vencedor oficial. PK (partida_id, jogador_id) garante 1 linha por partida.
    SELECT
      pa.partida_id               AS partida_id,
      pa.time                     AS time_a,
      pb.time                     AS time_b,
      pl.vencedor                 AS vencedor
    FROM partidas_participantes pa
    JOIN partidas_participantes pb
      ON pb.partida_id = pa.partida_id
     AND pb.jogador_id = p_jogador_b
    JOIN partidas       p  ON p.id  = pa.partida_id
    JOIN partida_placar pl ON pl.partida_id = pa.partida_id
    WHERE pa.jogador_id = p_jogador_a
      AND p.status IN ('published','closed')
  ),
  lados AS (
    -- Espelha os encontros para os dois atletas (lado 'a' = p_jogador_a).
    SELECT 'a'::text AS lado, p_jogador_a AS jogador_id
    UNION ALL
    SELECT 'b'::text, p_jogador_b
  ),
  encontros_lado AS (
    SELECT
      ld.lado,
      ld.jogador_id,
      en.partida_id,
      -- Time do atleta naquela partida e a relação entre os dois.
      CASE WHEN ld.lado = 'a' THEN en.time_a ELSE en.time_b END AS time_atleta,
      CASE WHEN en.time_a = en.time_b THEN 'juntos' ELSE 'adversos' END AS relacao,
      en.vencedor
    FROM encontros en
    CROSS JOIN lados ld
  ),
  por_contexto AS (
    -- Produção + retrospecto + nota média de cada atleta em cada contexto.
    -- O JOIN com partidas_participantes é 1:1 (PK partida_id + jogador_id) e
    -- partida_notas agrega 1 linha por (partida_id, target_id): COUNT e AVG
    -- ficam exatos, sem inflar.
    SELECT
      el.lado,
      el.relacao,
      COUNT(*)::bigint                                             AS qtd_partidas,
      COALESCE(SUM(pp.gols), 0)::bigint                           AS qtd_gols,
      COALESCE(SUM(pp.assistencias), 0)::bigint                   AS qtd_assistencias,
      COALESCE(SUM(pp.gols_contra), 0)::bigint                    AS qtd_gols_contra,
      COUNT(*) FILTER (WHERE el.vencedor = el.time_atleta)::bigint AS qtd_vitorias,
      COUNT(*) FILTER (WHERE el.vencedor = 'empate')::bigint      AS qtd_empates,
      COUNT(*) FILTER (WHERE el.vencedor <> el.time_atleta
                         AND el.vencedor <> 'empate')::bigint      AS qtd_derrotas,
      AVG(pn.avg_rating)::numeric                                 AS val_media_nota
    FROM encontros_lado el
    JOIN partidas_participantes pp
      ON pp.partida_id = el.partida_id
     AND pp.jogador_id  = el.jogador_id
    LEFT JOIN partida_notas pn
      ON pn.partida_id = el.partida_id
     AND pn.target_id  = el.jogador_id
    GROUP BY el.lado, el.relacao
  ),
  combinacoes(lado, bloco) AS (
    -- As 4 saídas contratadas, existam ou não partidas no contexto.
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

-- Função 2: histórico das últimas partidas compartilhadas (as duas relações
-- juntas, mais recentes primeiro).

CREATE OR REPLACE FUNCTION confronto_direto_partidas(
  p_jogador_a  bigint,
  p_jogador_b  bigint,
  p_limite     integer DEFAULT 10
)
RETURNS TABLE (
  partida_id    bigint,
  data_jogo     timestamptz,  -- partidas.data_jogo
  relacao       text,         -- 'juntos' | 'adversos'
  time_a        text,         -- time ('a'|'b') do jogador A naquela partida
  gols_time_a   bigint,       -- placar final do time 'a' da partida (partida_placar)
  gols_time_b   bigint,       -- placar final do time 'b' da partida (partida_placar)
  vencedor      text          -- 'a' | 'b' | 'empate'
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1) Mesmas validações da confronto_direto.
  IF p_jogador_a = p_jogador_b THEN
    RAISE EXCEPTION 'Selecione dois atletas diferentes.';
  END IF;

  IF (SELECT COUNT(*) FROM jogadores j
       WHERE j.id IN (p_jogador_a, p_jogador_b)
         AND j.posicao <> 'random') <> 2 THEN
    RAISE EXCEPTION 'Atleta não encontrado.';
  END IF;

  -- 2) Lista cronológica inversa com clamp defensivo do limite (1..50).
  RETURN QUERY
  WITH encontros AS (
    SELECT
      pa.partida_id               AS partida_id,
      p.data_jogo                 AS data_jogo,
      pa.time                     AS time_a,
      pb.time                     AS time_b,
      pl.gols_time_a              AS gols_time_a,
      pl.gols_time_b              AS gols_time_b,
      pl.vencedor                 AS vencedor
    FROM partidas_participantes pa
    JOIN partidas_participantes pb
      ON pb.partida_id = pa.partida_id
     AND pb.jogador_id = p_jogador_b
    JOIN partidas       p  ON p.id  = pa.partida_id
    JOIN partida_placar pl ON pl.partida_id = pa.partida_id
    WHERE pa.jogador_id = p_jogador_a
      AND p.status IN ('published','closed')
  )
  SELECT
    en.partida_id                                                AS partida_id,
    en.data_jogo                                                 AS data_jogo,
    CASE WHEN en.time_a = en.time_b THEN 'juntos' ELSE 'adversos' END AS relacao,
    en.time_a::text                                              AS time_a,
    en.gols_time_a                                               AS gols_time_a,
    en.gols_time_b                                               AS gols_time_b,
    en.vencedor                                                  AS vencedor
  FROM encontros en
  ORDER BY en.data_jogo DESC
  LIMIT LEAST(GREATEST(p_limite, 1), 50);
END;
$$;

GRANT EXECUTE ON FUNCTION confronto_direto_partidas(bigint, bigint, integer) TO anon, authenticated;

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

-- 076_remover_coluna_nome_jogadores.sql
-- Remove a coluna `nome` da tabela `jogadores` e unifica a identidade dos atletas exclusivamente em `username`.
-- Recria views e RPCs dependentes de `nome`.

-- 1. Recriação da view `partida_notas` sem a coluna `nome`
DROP VIEW IF EXISTS partida_notas CASCADE;

CREATE OR REPLACE VIEW partida_notas AS
WITH raw_agg AS (
  SELECT
    v.partida_id,
    v.target_id,
    j.username,
    CASE
      WHEN COUNT(*) >= 3 THEN (SUM(v.rating) - MIN(v.rating) - MAX(v.rating))::numeric / (COUNT(*) - 2)
      ELSE AVG(v.rating)::numeric
    END                                                        AS avg_rating,
    COUNT(*)::bigint                                           AS vote_count
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
    )                                                          AS rk
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

-- 2. Recriação da view `ranking` sem a coluna `nome`
DROP VIEW IF EXISTS ranking CASCADE;

CREATE OR REPLACE VIEW ranking AS
SELECT
  pp.jogador_id,
  j.username,
  (
    COUNT(*) FILTER (
      WHERE pl.vencedor = pp.time
    ) * 3
    +
    COUNT(*) FILTER (
      WHERE pl.vencedor = 'empate'
    ) * 1
  )                                                         AS pontos,
  COUNT(*) FILTER (WHERE pl.vencedor = pp.time)             AS vitorias,
  COUNT(*) FILTER (WHERE pl.vencedor = 'empate')            AS empates,
  COUNT(*) FILTER (WHERE pl.vencedor <> pp.time
                    AND pl.vencedor <> 'empate')            AS derrotas,
  COUNT(*)                                                  AS partidas,
  COALESCE(SUM(pp.gols), 0)                                 AS gols,
  COALESCE(SUM(pp.assistencias), 0)                         AS assistencias,
  COALESCE(SUM(pp.gols_contra), 0)                          AS gols_contra,
  j.posicao
FROM partidas_participantes pp
JOIN partidas      p  ON p.id  = pp.partida_id
JOIN partida_placar pl ON pl.partida_id = pp.partida_id
JOIN jogadores     j  ON j.id  = pp.jogador_id
WHERE p.status IN ('published','closed')
GROUP BY pp.jogador_id, j.username, j.posicao;

GRANT SELECT ON ranking TO anon, authenticated;

-- 3. Recriação da view `dividas_resumo` sem a coluna `nome`
DROP VIEW IF EXISTS dividas_resumo CASCADE;

CREATE OR REPLACE VIEW dividas_resumo AS
SELECT
  j.id            AS jogador_id,
  j.username      AS username,
  j.is_mensalista AS is_mensalista,
  COALESCE(SUM(d.valor) FILTER (WHERE d.paga = false), 0)::numeric AS total_devido,
  COUNT(d.id)     FILTER (WHERE d.paga = false)::bigint          AS qtd_dividas
FROM jogadores j
LEFT JOIN dividas d ON d.jogador_id = j.id
GROUP BY j.id, j.username, j.is_mensalista;

GRANT SELECT ON dividas_resumo TO anon, authenticated;

-- 4. Recriação da RPC `fazer_login` sem a coluna `nome`
DROP FUNCTION IF EXISTS fazer_login(text, text);

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

-- 5. Recriação da RPC `criar_jogador` sem o parâmetro `p_nome`
DROP FUNCTION IF EXISTS criar_jogador(text, text, text, boolean, text, boolean);
DROP FUNCTION IF EXISTS criar_jogador(text, text, boolean, text, boolean);

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

-- 6. Recriação da RPC `resumo_ano` com campos `*_username`
DROP FUNCTION IF EXISTS resumo_ano(integer);

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
SECURITY DEFINER
SET search_path = public
AS $$
  WITH partidas_ano AS (
    SELECT p.id, p.data_jogo
    FROM partidas p
    WHERE p.status IN ('published', 'closed')
      AND EXTRACT(
        YEAR FROM p.data_jogo AT TIME ZONE 'America/Sao_Paulo'
      )::integer = p_ano
  ),
  total AS (
    SELECT COUNT(*)::bigint AS partidas
    FROM partidas_ano
  ),
  stats AS (
    SELECT
      pp.jogador_id,
      j.username,
      COUNT(*)::bigint AS partidas,
      COALESCE(SUM(pp.gols), 0)::bigint AS gols,
      COALESCE(SUM(pp.assistencias), 0)::bigint AS assistencias,
      COUNT(*) FILTER (WHERE pl.vencedor = pp.time)::bigint AS vitorias
    FROM partidas_participantes pp
    JOIN partidas p ON p.id = pp.partida_id
    JOIN partidas_ano pa ON pa.id = p.id
    JOIN partida_placar pl ON pl.partida_id = pp.partida_id
    JOIN jogadores j ON j.id = pp.jogador_id
    WHERE j.posicao <> 'random'
    GROUP BY pp.jogador_id, j.username
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
      pp.jogador_id,
      j.username,
      p.id AS partida_id,
      p.data_jogo,
      (pl.vencedor = pp.time) AS venceu,
      ROW_NUMBER() OVER (
        PARTITION BY pp.jogador_id
        ORDER BY p.data_jogo DESC, p.id DESC
      ) AS rn
    FROM partidas_participantes pp
    JOIN partidas_ano pa ON pa.id = pp.partida_id
    JOIN partidas p ON p.id = pa.id
    JOIN partida_placar pl ON pl.partida_id = pp.partida_id
    JOIN jogadores j ON j.id = pp.jogador_id
    WHERE j.posicao <> 'random'
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

-- 7. Recriação da RPC `parcerias_jogador`
DROP FUNCTION IF EXISTS parcerias_jogador(bigint, integer);

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
SECURITY DEFINER
SET search_path = public
AS $$
  WITH jogador_partidas AS (
    SELECT pp.partida_id, pp.time, pl.vencedor
    FROM partidas_participantes pp
    JOIN partidas       p  ON p.id  = pp.partida_id
    JOIN partida_placar pl ON pl.partida_id = pp.partida_id
    WHERE pp.jogador_id = p_jogador_id
      AND p.status IN ('published','closed')
  ),
  companheiros AS (
    SELECT
      'companheiro'::text AS tipo,
      outp.jogador_id,
      j.username,
      COUNT(*)::bigint                                          AS partidas,
      COUNT(*) FILTER (WHERE jp.vencedor = jp.time)::bigint     AS vitorias,
      COUNT(*) FILTER (WHERE jp.vencedor = 'empate')::bigint    AS empates,
      COUNT(*) FILTER (WHERE jp.vencedor <> jp.time
                        AND jp.vencedor <> 'empate')::bigint     AS derrotas
    FROM jogador_partidas jp
    JOIN partidas_participantes outp
      ON outp.partida_id = jp.partida_id
     AND outp.time       = jp.time
     AND outp.jogador_id <> p_jogador_id
    JOIN jogadores j ON j.id = outp.jogador_id
    GROUP BY outp.jogador_id, j.username
    HAVING COUNT(*) >= p_min_partidas
  ),
  adversarios AS (
    SELECT
      'adversario'::text AS tipo,
      outp.jogador_id,
      j.username,
      COUNT(*)::bigint                                          AS partidas,
      COUNT(*) FILTER (WHERE jp.vencedor = jp.time)::bigint     AS vitorias,
      COUNT(*) FILTER (WHERE jp.vencedor = 'empate')::bigint    AS empates,
      COUNT(*) FILTER (WHERE jp.vencedor <> jp.time
                        AND jp.vencedor <> 'empate')::bigint     AS derrotas
    FROM jogador_partidas jp
    JOIN partidas_participantes outp
      ON outp.partida_id = jp.partida_id
     AND outp.time       <> jp.time
     AND outp.jogador_id <> p_jogador_id
    JOIN jogadores j ON j.id = outp.jogador_id
    GROUP BY outp.jogador_id, j.username
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

-- 8. Recriação da RPC `parcerias_destaque_jogador`
DROP FUNCTION IF EXISTS parcerias_destaque_jogador(bigint, integer);

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
SECURITY DEFINER
SET search_path = public
AS $$
  WITH jogador_partidas AS (
    SELECT pp.partida_id, pp.time
    FROM partidas_participantes pp
    JOIN partidas p ON p.id = pp.partida_id
    WHERE pp.jogador_id = p_jogador_id
      AND p.status IN ('published', 'closed')
  ),
  usuario_gols AS (
    SELECT pp.partida_id, COALESCE(pp.gols, 0) AS gols
    FROM partidas_participantes pp
    WHERE pp.jogador_id = p_jogador_id
  ),
  usuario_notas AS (
    SELECT partida_id, avg_rating
    FROM partida_notas
    WHERE target_id = p_jogador_id
  ),
  companheiros AS (
    SELECT
      outp.jogador_id,
      j.username,
      COUNT(*)::bigint                                       AS partidas,
      COALESCE(SUM(ug.gols), 0)::numeric                     AS gols_usuario,
      AVG(un.avg_rating)::numeric                            AS nota_media_usuario
    FROM jogador_partidas jp
    JOIN partidas_participantes outp
      ON outp.partida_id = jp.partida_id
     AND outp.time       = jp.time
     AND outp.jogador_id <> p_jogador_id
    JOIN jogadores      j   ON j.id  = outp.jogador_id
    LEFT JOIN usuario_gols  ug ON ug.partida_id = jp.partida_id
    LEFT JOIN usuario_notas un ON un.partida_id = jp.partida_id
    WHERE j.posicao <> 'random'
    GROUP BY outp.jogador_id, j.username
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

-- 9. Recriação da RPC `pares_racha`
DROP FUNCTION IF EXISTS pares_racha(integer);

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
SECURITY DEFINER
SET search_path = public
AS $$
  WITH participacoes AS (
    SELECT
      pp.partida_id,
      pp.time,
      pp.jogador_id,
      pl.vencedor
    FROM partidas_participantes pp
    JOIN partidas       p  ON p.id  = pp.partida_id
    JOIN partida_placar pl ON pl.partida_id = pp.partida_id
    JOIN jogadores      j  ON j.id  = pp.jogador_id
    WHERE p.status IN ('published','closed')
      AND j.posicao <> 'random'
  ),
  pares AS (
    SELECT
      a.jogador_id AS jogador_a_id,
      b.jogador_id AS jogador_b_id,
      a.vencedor   AS vencedor,
      a.time       AS time
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
      COUNT(*) FILTER (WHERE vencedor = time)::bigint       AS vitorias,
      COUNT(*) FILTER (WHERE vencedor = 'empate')::bigint   AS empates,
      COUNT(*) FILTER (WHERE vencedor <> time
                        AND vencedor <> 'empate')::bigint    AS derrotas
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
  FROM todos
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

-- 10. Remoção da coluna `nome` da tabela `jogadores`
ALTER TABLE jogadores DROP COLUMN IF EXISTS nome;

-- 11. Atualização dos Grants de Leitura
REVOKE SELECT ON jogadores FROM anon, authenticated;

GRANT SELECT (
  id,
  username,
  posicao,
  posicao_b,
  is_admin,
  is_ativo,
  is_mensalista,
  created_at
) ON jogadores TO anon, authenticated;

-- 077_configuracoes_notificacoes.sql
--
-- Gestão de Notificações Push no Painel de Administração:
-- 1. Cria a tabela singleton `notificacoes_config`.
-- 2. Relaxa o CHECK de `reminder_key` em `push_reminder_deliveries` para suportar 'reforco'.
-- 3. RPC `obter_configuracoes_notificacoes(p_admin_id bigint)` (STABLE).
-- 4. RPC `salvar_configuracoes_notificacoes(p_admin_id bigint, p_config jsonb)` (VOLATILE).
-- 5. RPC `disparar_confirmacao_manual(p_admin_id bigint, p_partida_id bigint)`.
-- 6. RPC `disparar_push_teste(p_admin_id bigint)`.
-- 7. Reagendamento do cron `enviar-push-reminders-1min` (votação + reforço).

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 1. Tabela singleton notificacoes_config
CREATE TABLE IF NOT EXISTS notificacoes_config (
  id                          integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  confirmacao_ativo           boolean NOT NULL DEFAULT true,
  confirmacao_dia_semana      smallint NOT NULL DEFAULT 1 CHECK (confirmacao_dia_semana BETWEEN 1 AND 3),
  confirmacao_horario         time NOT NULL DEFAULT '10:00' CHECK (confirmacao_horario < time '21:00'),
  confirmacao_titulo          text CHECK (char_length(confirmacao_titulo) <= 120),
  confirmacao_mensagem        text CHECK (char_length(confirmacao_mensagem) <= 500),
  reforco_ativo               boolean NOT NULL DEFAULT true,
  reforco_horas_antes_prazo   smallint NOT NULL DEFAULT 4 CHECK (reforco_horas_antes_prazo BETWEEN 1 AND 48),
  reforco_titulo              text CHECK (char_length(reforco_titulo) <= 120),
  reforco_mensagem            text CHECK (char_length(reforco_mensagem) <= 500),
  votacao_ativo               boolean NOT NULL DEFAULT true,
  votacao_bucket_6h           boolean NOT NULL DEFAULT true,
  votacao_bucket_3h           boolean NOT NULL DEFAULT true,
  votacao_bucket_1h           boolean NOT NULL DEFAULT true,
  votacao_bucket_30m          boolean NOT NULL DEFAULT true,
  votacao_template_6h_titulo  text CHECK (char_length(votacao_template_6h_titulo) <= 120),
  votacao_template_6h_msg     text CHECK (char_length(votacao_template_6h_msg) <= 500),
  votacao_template_3h_titulo  text CHECK (char_length(votacao_template_3h_titulo) <= 120),
  votacao_template_3h_msg     text CHECK (char_length(votacao_template_3h_msg) <= 500),
  votacao_template_1h_titulo  text CHECK (char_length(votacao_template_1h_titulo) <= 120),
  votacao_template_1h_msg     text CHECK (char_length(votacao_template_1h_msg) <= 500),
  votacao_template_30m_titulo text CHECK (char_length(votacao_template_30m_titulo) <= 120),
  votacao_template_30m_msg    text CHECK (char_length(votacao_template_30m_msg) <= 500),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  updated_by                  bigint REFERENCES jogadores(id),
  CONSTRAINT notificacoes_config_dia_hora_valido CHECK (
    confirmacao_dia_semana < 3 OR confirmacao_horario < time '16:00'
  )
);

-- Seed singleton (garante existência da linha padrão)
INSERT INTO notificacoes_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Restringe escrita direta: client só altera via RPC; Edge Functions lêem via service_role
REVOKE ALL ON notificacoes_config FROM anon, authenticated;
GRANT SELECT ON notificacoes_config TO service_role;

-- 2. Relaxa o CHECK de reminder_key em push_reminder_deliveries (preservando o formato histórico)
ALTER TABLE push_reminder_deliveries
  DROP CONSTRAINT IF EXISTS push_reminder_deliveries_reminder_key_check;

ALTER TABLE push_reminder_deliveries
  ADD CONSTRAINT push_reminder_deliveries_reminder_key_check
  CHECK (
    reminder_key IN ('6h','3h','1h','30m','confirmacao','reforco')
    OR reminder_key ~ '^([01][0-9]|2[0-3]):(00|15|30|45)$'
  );

-- 3. RPC obter_configuracoes_notificacoes(p_admin_id bigint)
CREATE OR REPLACE FUNCTION obter_configuracoes_notificacoes(p_admin_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_res jsonb;
BEGIN
  SELECT is_admin INTO v_is_admin FROM jogadores WHERE id = p_admin_id;
  IF v_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso restrito a administradores.';
  END IF;

  SELECT to_jsonb(c) INTO v_res FROM notificacoes_config c WHERE c.id = 1;
  RETURN v_res;
END;
$$;

GRANT EXECUTE ON FUNCTION obter_configuracoes_notificacoes(bigint) TO anon, authenticated;

-- 4. RPC salvar_configuracoes_notificacoes(p_admin_id bigint, p_config jsonb)
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

-- 5. RPC disparar_confirmacao_manual(p_admin_id bigint, p_partida_id bigint)
CREATE OR REPLACE FUNCTION disparar_confirmacao_manual(
  p_admin_id   bigint,
  p_partida_id bigint
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin   boolean;
  v_status     text;
  v_secret     text;
BEGIN
  SELECT is_admin INTO v_is_admin FROM jogadores WHERE id = p_admin_id;
  IF v_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso restrito a administradores.';
  END IF;

  SELECT status INTO v_status FROM partidas WHERE id = p_partida_id;
  IF v_status IS NULL OR v_status <> 'draft' THEN
    RAISE EXCEPTION 'Partida inválida ou não está em rascunho (draft).';
  END IF;

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
    body := jsonb_build_object('partida_id', p_partida_id, 'reenviar', true)
  );

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION disparar_confirmacao_manual(bigint, bigint) TO anon, authenticated;

-- 6. RPC disparar_push_teste(p_admin_id bigint)
CREATE OR REPLACE FUNCTION disparar_push_teste(
  p_admin_id bigint
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_secret   text;
BEGIN
  SELECT is_admin INTO v_is_admin FROM jogadores WHERE id = p_admin_id;
  IF v_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso restrito a administradores.';
  END IF;

  SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets
    WHERE name = 'push_cron_secret'
    LIMIT 1;

  PERFORM net.http_post(
    url := 'https://jtavmrlllyctkuxefhpc.supabase.co/functions/v1/send-test-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-cron-secret', v_secret
    ),
    body := jsonb_build_object('jogador_id', p_admin_id)
  );

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION disparar_push_teste(bigint) TO anon, authenticated;

-- 7. Reagendamento do cron de 1 minuto para push reminders (Votação + Reforço de Confirmação)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'enviar-lembretes-votacao-1min') THEN
    PERFORM cron.unschedule('enviar-lembretes-votacao-1min');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'enviar-lembretes-votacao-15min') THEN
    PERFORM cron.unschedule('enviar-lembretes-votacao-15min');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'enviar-push-reminders-1min') THEN
    PERFORM cron.unschedule('enviar-push-reminders-1min');
  END IF;
END;
$$;

SELECT cron.schedule(
  'enviar-push-reminders-1min',
  '* * * * *',
  $push_job$
  DO $$
  DECLARE
    v_secret text;
  BEGIN
    SELECT decrypted_secret INTO v_secret
      FROM vault.decrypted_secrets
      WHERE name = 'push_cron_secret'
      LIMIT 1;

    -- 1. Lembretes de Votação
    PERFORM net.http_post(
      url := 'https://jtavmrlllyctkuxefhpc.supabase.co/functions/v1/send-voting-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-push-cron-secret', v_secret
      ),
      body := '{}'::jsonb
    );

    -- 2. Reforço de Confirmação de Presença
    PERFORM net.http_post(
      url := 'https://jtavmrlllyctkuxefhpc.supabase.co/functions/v1/send-confirmation-requests',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-push-cron-secret', v_secret
      ),
      body := '{}'::jsonb
    );
  END $$;
  $push_job$
);

-- 078_dividas_natureza_despesa.sql
-- Controle financeiro: diferencia receita (racha a receber) de despesa
-- (racha a pagar) e amplia os tipos de lançamento.
--
-- Novos tipos: goleiro | campo | eventos (além de mensalidade | avulso | outro).
-- Natureza: receita (default, compatível com dados existentes) | despesa.
-- jogador_id fica opcional em despesas (ex.: aluguel de campo sem atleta).
-- Depende de 076 (remoção da coluna nome): a view usa apenas username.

ALTER TABLE dividas
  ADD COLUMN IF NOT EXISTS natureza text NOT NULL DEFAULT 'receita';

ALTER TABLE dividas
  DROP CONSTRAINT IF EXISTS dividas_natureza_check;

ALTER TABLE dividas
  ADD CONSTRAINT dividas_natureza_check
  CHECK (natureza IN ('receita', 'despesa'));

ALTER TABLE dividas
  DROP CONSTRAINT IF EXISTS dividas_tipo_check;

ALTER TABLE dividas
  ADD CONSTRAINT dividas_tipo_check
  CHECK (tipo IN ('mensalidade', 'avulso', 'outro', 'goleiro', 'campo', 'eventos'));

ALTER TABLE dividas
  ALTER COLUMN jogador_id DROP NOT NULL;

-- Receita exige jogador; despesa pode ficar sem (caixa do racha).
ALTER TABLE dividas
  DROP CONSTRAINT IF EXISTS dividas_receita_exige_jogador;

ALTER TABLE dividas
  ADD CONSTRAINT dividas_receita_exige_jogador
  CHECK (natureza <> 'receita' OR jogador_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_dividas_natureza_abertas
  ON dividas (natureza)
  WHERE paga = false;

-- Resumo de cobrança: só receitas em aberto (despesas não entram no "total devido").
CREATE OR REPLACE VIEW dividas_resumo AS
SELECT
  j.id            AS jogador_id,
  j.username      AS username,
  j.is_mensalista AS is_mensalista,
  COALESCE(
    SUM(d.valor) FILTER (WHERE d.paga = false AND d.natureza = 'receita'),
    0
  )::numeric AS total_devido,
  COUNT(d.id) FILTER (WHERE d.paga = false AND d.natureza = 'receita')::bigint AS qtd_dividas
FROM jogadores j
LEFT JOIN dividas d ON d.jogador_id = j.id
GROUP BY j.id, j.username, j.is_mensalista;

GRANT SELECT ON dividas_resumo TO anon, authenticated;

DROP FUNCTION IF EXISTS registrar_divida(bigint, text, numeric, date, text, text, bigint);

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

GRANT EXECUTE ON FUNCTION registrar_divida(bigint, text, numeric, date, text, text, bigint, text)
  TO anon, authenticated;

-- "Quitar todas" no acordeão de cobrança: só receitas daquele jogador.
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

-- 079_eventos_financeiros_automaticos.sql
-- Eventos financeiros configuráveis (mensal / fim de partida).
-- Substitui o INSERT hardcoded do cron de mensalidades e adiciona:
--   - Despesa Campo R$1050 no dia 01 (caixa do racha)
--   - Despesa Goleiro R$30 por goleiro ao finalizar a partida
--
-- Placeholders em descricao_template / referencia_template:
--   {data} {mes} {ano} {mes_ano} {referencia} {nome} {username}
-- ({nome} e {username} recebem o username do atleta — coluna nome foi removida).

-- 1) Tabela de configuração
CREATE TABLE IF NOT EXISTS eventos_financeiros_automaticos (
  id                   bigserial     PRIMARY KEY,
  nome                 text          NOT NULL,
  gatilho              text          NOT NULL
                         CHECK (gatilho IN ('mensal', 'fim_partida')),
  natureza             text          NOT NULL
                         CHECK (natureza IN ('receita', 'despesa')),
  tipo                 text          NOT NULL
                         CHECK (tipo IN (
                           'mensalidade', 'avulso', 'outro',
                           'goleiro', 'campo', 'eventos'
                         )),
  valor                numeric(10,2) NOT NULL CHECK (valor > 0),
  destino              text          NOT NULL
                         CHECK (destino IN (
                           'caixa',
                           'mensalistas',
                           'goleiros_partida',
                           'jogador_fixo'
                         )),
  jogador_id           bigint        REFERENCES jogadores(id) ON DELETE SET NULL,
  descricao_template   text          NOT NULL,
  referencia_template  text,
  ativo                boolean       NOT NULL DEFAULT true,
  created_at           timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT eventos_auto_jogador_fixo CHECK (
    destino <> 'jogador_fixo' OR jogador_id IS NOT NULL
  ),
  CONSTRAINT eventos_auto_goleiros_so_partida CHECK (
    destino <> 'goleiros_partida' OR gatilho = 'fim_partida'
  ),
  CONSTRAINT eventos_auto_mensalistas_so_mensal CHECK (
    destino <> 'mensalistas' OR gatilho = 'mensal'
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON eventos_financeiros_automaticos
  TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE eventos_financeiros_automaticos_id_seq
  TO anon, authenticated;

-- 2) Rastreio nos lançamentos gerados (histórico permanece se a config for apagada)
ALTER TABLE dividas
  ADD COLUMN IF NOT EXISTS evento_automatico_id bigint
    REFERENCES eventos_financeiros_automaticos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_dividas_evento_automatico
  ON dividas (evento_automatico_id)
  WHERE evento_automatico_id IS NOT NULL;

-- Idempotência mensal: mesmo evento + referência + jogador (0 = caixa)
CREATE UNIQUE INDEX IF NOT EXISTS uq_dividas_evento_auto_mensal
  ON dividas (evento_automatico_id, referencia, (COALESCE(jogador_id, 0)))
  WHERE evento_automatico_id IS NOT NULL
    AND partida_id IS NULL
    AND referencia IS NOT NULL;

-- Idempotência fim de partida: mesmo evento + partida + jogador (0 = caixa)
CREATE UNIQUE INDEX IF NOT EXISTS uq_dividas_evento_auto_partida
  ON dividas (evento_automatico_id, partida_id, (COALESCE(jogador_id, 0)))
  WHERE evento_automatico_id IS NOT NULL
    AND partida_id IS NOT NULL;

-- 3) Substituição de placeholders
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
  v_mes_ano := to_char(p_data, 'MM/YYYY');
  v_ref := to_char(p_data, 'YYYY-MM');

  v_out := p_template;
  v_out := replace(v_out, '{data}', v_data);
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

-- 4) Geração mensal (cron dia 01 10h BRT)
CREATE OR REPLACE FUNCTION gerar_lancamentos_mensais()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_hoje date;
  v_ref text;
  v_desc text;
  j RECORD;
BEGIN
  v_hoje := (now() AT TIME ZONE 'America/Sao_Paulo')::date;

  FOR r IN
    SELECT *
    FROM eventos_financeiros_automaticos
    WHERE ativo = true AND gatilho = 'mensal'
  LOOP
    v_ref := COALESCE(
      NULLIF(trim(substituir_template_financeiro(r.referencia_template, v_hoje)), ''),
      to_char(v_hoje, 'YYYY-MM')
    );

    IF r.destino = 'caixa' THEN
      v_desc := substituir_template_financeiro(r.descricao_template, v_hoje);
      INSERT INTO dividas (
        jogador_id, tipo, natureza, valor, referencia, data_divida,
        descricao, evento_automatico_id
      )
      SELECT
        NULL, r.tipo, r.natureza, r.valor, v_ref, v_hoje, v_desc, r.id
      WHERE NOT EXISTS (
        SELECT 1 FROM dividas d
        WHERE d.evento_automatico_id = r.id
          AND d.referencia = v_ref
          AND d.jogador_id IS NULL
          AND d.partida_id IS NULL
      );

    ELSIF r.destino = 'mensalistas' THEN
      FOR j IN
        SELECT id, username
        FROM jogadores
        WHERE is_mensalista = true
          AND is_ativo = true
          AND posicao <> 'goleiro'
      LOOP
        v_desc := substituir_template_financeiro(r.descricao_template, v_hoje, j.username);
        INSERT INTO dividas (
          jogador_id, tipo, natureza, valor, referencia, data_divida,
          descricao, evento_automatico_id
        )
        SELECT
          j.id, r.tipo, r.natureza, r.valor, v_ref, v_hoje, v_desc, r.id
        WHERE NOT EXISTS (
          SELECT 1 FROM dividas d
          WHERE d.evento_automatico_id = r.id
            AND d.referencia = v_ref
            AND d.jogador_id = j.id
            AND d.partida_id IS NULL
        );
      END LOOP;

    ELSIF r.destino = 'jogador_fixo' AND r.jogador_id IS NOT NULL THEN
      SELECT username INTO v_desc FROM jogadores WHERE id = r.jogador_id;
      v_desc := substituir_template_financeiro(r.descricao_template, v_hoje, v_desc);
      INSERT INTO dividas (
        jogador_id, tipo, natureza, valor, referencia, data_divida,
        descricao, evento_automatico_id
      )
      SELECT
        r.jogador_id, r.tipo, r.natureza, r.valor, v_ref, v_hoje, v_desc, r.id
      WHERE NOT EXISTS (
        SELECT 1 FROM dividas d
        WHERE d.evento_automatico_id = r.id
          AND d.referencia = v_ref
          AND d.jogador_id = r.jogador_id
          AND d.partida_id IS NULL
      );
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION gerar_lancamentos_mensais() TO anon, authenticated;

-- 5) Geração ao finalizar/publicar partida
CREATE OR REPLACE FUNCTION gerar_lancamentos_fim_partida(p_partida_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_data date;
  v_ref text;
  v_desc text;
  v_nome text;
  g RECORD;
BEGIN
  SELECT (data_jogo AT TIME ZONE 'America/Sao_Paulo')::date
    INTO v_data
  FROM partidas
  WHERE id = p_partida_id;

  IF v_data IS NULL THEN
    RETURN;
  END IF;

  FOR r IN
    SELECT *
    FROM eventos_financeiros_automaticos
    WHERE ativo = true AND gatilho = 'fim_partida'
  LOOP
    v_ref := COALESCE(
      NULLIF(trim(substituir_template_financeiro(r.referencia_template, v_data)), ''),
      to_char(v_data, 'YYYY-MM')
    );

    IF r.destino = 'goleiros_partida' THEN
      FOR g IN
        SELECT pp.jogador_id, j.username
        FROM partidas_participantes pp
        JOIN jogadores j ON j.id = pp.jogador_id
        WHERE pp.partida_id = p_partida_id
          AND pp.posicao = 'goleiro'
      LOOP
        v_desc := substituir_template_financeiro(r.descricao_template, v_data, g.username);
        INSERT INTO dividas (
          jogador_id, tipo, natureza, valor, referencia, data_divida,
          descricao, partida_id, evento_automatico_id
        )
        SELECT
          g.jogador_id, r.tipo, r.natureza, r.valor, v_ref, v_data,
          v_desc, p_partida_id, r.id
        WHERE NOT EXISTS (
          SELECT 1 FROM dividas d
          WHERE d.evento_automatico_id = r.id
            AND d.partida_id = p_partida_id
            AND d.jogador_id = g.jogador_id
        );
      END LOOP;

    ELSIF r.destino = 'caixa' THEN
      v_desc := substituir_template_financeiro(r.descricao_template, v_data);
      INSERT INTO dividas (
        jogador_id, tipo, natureza, valor, referencia, data_divida,
        descricao, partida_id, evento_automatico_id
      )
      SELECT
        NULL, r.tipo, r.natureza, r.valor, v_ref, v_data,
        v_desc, p_partida_id, r.id
      WHERE NOT EXISTS (
        SELECT 1 FROM dividas d
        WHERE d.evento_automatico_id = r.id
          AND d.partida_id = p_partida_id
          AND d.jogador_id IS NULL
      );

    ELSIF r.destino = 'jogador_fixo' AND r.jogador_id IS NOT NULL THEN
      SELECT username INTO v_nome FROM jogadores WHERE id = r.jogador_id;
      v_desc := substituir_template_financeiro(r.descricao_template, v_data, v_nome);
      INSERT INTO dividas (
        jogador_id, tipo, natureza, valor, referencia, data_divida,
        descricao, partida_id, evento_automatico_id
      )
      SELECT
        r.jogador_id, r.tipo, r.natureza, r.valor, v_ref, v_data,
        v_desc, p_partida_id, r.id
      WHERE NOT EXISTS (
        SELECT 1 FROM dividas d
        WHERE d.evento_automatico_id = r.id
          AND d.partida_id = p_partida_id
          AND d.jogador_id = r.jogador_id
      );
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION gerar_lancamentos_fim_partida(bigint) TO anon, authenticated;

-- 6) Hooks em finalizar / publicar
CREATE OR REPLACE FUNCTION finalizar_partida(p_partida_id bigint)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_status text;
BEGIN
  SELECT status INTO v_status FROM partidas WHERE id = p_partida_id;
  IF v_status IS NULL OR v_status <> 'live' THEN
    RETURN false;
  END IF;

  PERFORM sincronizar_contadores_partida(p_partida_id);
  PERFORM gerar_avulsos_partida(p_partida_id);
  PERFORM gerar_lancamentos_fim_partida(p_partida_id);

  UPDATE partidas
     SET status = 'published',
         voting_closes_at = now() + interval '24 hours'
   WHERE id = p_partida_id;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION finalizar_partida(bigint) TO anon, authenticated;

CREATE OR REPLACE FUNCTION publicar_partida(p_partida_id bigint)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_status text;
BEGIN
  SELECT status INTO v_status FROM partidas WHERE id = p_partida_id;
  IF v_status IS NULL OR v_status <> 'draft' THEN
    RETURN false;
  END IF;

  PERFORM gerar_avulsos_partida(p_partida_id);
  PERFORM gerar_lancamentos_fim_partida(p_partida_id);

  UPDATE partidas
     SET status = 'published',
         voting_closes_at = now() + interval '24 hours'
   WHERE id = p_partida_id;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION publicar_partida(bigint) TO anon, authenticated;

-- Em edição de súmula já publicada: re-gera (idempotente) diárias de goleiro etc.
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
         OR (assistencia_jogador_id IS NOT NULL
             AND assistencia_jogador_id NOT IN (SELECT unnest(v_novos_ids)))
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
         SELECT (elem->>'jogador_id')::bigint
         FROM jsonb_array_elements(p_participantes) elem
         WHERE (elem->>'posicao')::text = 'goleiro'
       );

    -- Remove diárias de goleiro em aberto se o atleta saiu ou deixou de ser goleiro
    DELETE FROM dividas
     WHERE partida_id = p_partida_id
       AND natureza = 'despesa'
       AND tipo = 'goleiro'
       AND paga = false
       AND evento_automatico_id IS NOT NULL
       AND jogador_id NOT IN (
         SELECT (elem->>'jogador_id')::bigint
         FROM jsonb_array_elements(p_participantes) elem
         WHERE (elem->>'posicao')::text = 'goleiro'
       );

    DELETE FROM partidas_participantes
     WHERE partida_id = p_partida_id
       AND jogador_id NOT IN (SELECT unnest(v_novos_ids));
  END IF;

  FOR elem IN SELECT * FROM jsonb_array_elements(p_participantes)
  LOOP
    INSERT INTO partidas_participantes (
      partida_id, jogador_id, time, posicao, gols, assistencias, gols_contra,
      status_confirmacao
    )
    VALUES (
      p_partida_id,
      (elem->>'jogador_id')::bigint,
      (elem->>'time')::char(1),
      (elem->>'posicao')::text,
      COALESCE((elem->>'gols')::integer, 0),
      COALESCE((elem->>'assistencias')::integer, 0),
      COALESCE((elem->>'gols_contra')::integer, 0),
      COALESCE((elem->>'status_confirmacao')::text, 'confirmado')
    )
    ON CONFLICT (partida_id, jogador_id) DO UPDATE SET
      time               = EXCLUDED.time,
      posicao            = EXCLUDED.posicao,
      gols               = EXCLUDED.gols,
      assistencias       = EXCLUDED.assistencias,
      gols_contra        = EXCLUDED.gols_contra,
      status_confirmacao = EXCLUDED.status_confirmacao;
  END LOOP;

  IF p_primeira_vez THEN
    IF NOT publicar_partida(p_partida_id) THEN
      RAISE EXCEPTION 'Não foi possível publicar a partida (ela precisa estar em rascunho).';
    END IF;
  ELSIF v_status IN ('published', 'closed') THEN
    PERFORM gerar_avulsos_partida(p_partida_id);
    PERFORM gerar_lancamentos_fim_partida(p_partida_id);
  END IF;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION salvar_edicao_partida(bigint, jsonb, boolean)
  TO anon, authenticated;

-- 7) Reagenda cron mensal para a função unificada
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'gerar-mensalidades-mensal') THEN
    PERFORM cron.unschedule('gerar-mensalidades-mensal');
  END IF;
END;
$$;

SELECT cron.schedule(
  'gerar-mensalidades-mensal',
  '0 13 1 * *',
  $$SELECT gerar_lancamentos_mensais();$$
);

-- 8) Seeds (idempotentes por nome)
INSERT INTO eventos_financeiros_automaticos (
  nome, gatilho, natureza, tipo, valor, destino,
  descricao_template, referencia_template, ativo
)
SELECT
  'Mensalidade',
  'mensal',
  'receita',
  'mensalidade',
  90.00,
  'mensalistas',
  'Mensalidade {mes_ano}',
  '{referencia}',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM eventos_financeiros_automaticos WHERE nome = 'Mensalidade' AND gatilho = 'mensal'
);

INSERT INTO eventos_financeiros_automaticos (
  nome, gatilho, natureza, tipo, valor, destino,
  descricao_template, referencia_template, ativo
)
SELECT
  'Aluguel do campo',
  'mensal',
  'despesa',
  'campo',
  1050.00,
  'caixa',
  'Aluguel campo {mes_ano}',
  '{referencia}',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM eventos_financeiros_automaticos WHERE nome = 'Aluguel do campo' AND gatilho = 'mensal'
);

INSERT INTO eventos_financeiros_automaticos (
  nome, gatilho, natureza, tipo, valor, destino,
  descricao_template, referencia_template, ativo
)
SELECT
  'Diária goleiro',
  'fim_partida',
  'despesa',
  'goleiro',
  30.00,
  'goleiros_partida',
  'Diária goleiro racha dia {data}',
  '{referencia}',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM eventos_financeiros_automaticos WHERE nome = 'Diária goleiro' AND gatilho = 'fim_partida'
);

-- 080_capacidade_partida_14.sql
-- Ajusta a capacidade máxima de confirmações de presença de 16 para 14 (jogadores de linha).

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
  v_closes_at      timestamptz;
  v_atual          text;
  v_ocupadas       bigint;
  v_alvo_ocupa     boolean;
BEGIN
  IF p_status NOT IN ('pendente','confirmado','recusado') THEN
    RETURN false;
  END IF;

  SELECT p.status, p.confirmacao_closes_at
    INTO v_status_partida, v_closes_at
    FROM partidas p
    WHERE p.id = p_partida_id;
  IF v_status_partida IS NULL OR v_status_partida <> 'draft' THEN
    RETURN false;
  END IF;

  SELECT pp.status_confirmacao INTO v_atual
    FROM partidas_participantes pp
    WHERE pp.partida_id = p_partida_id AND pp.jogador_id = p_jogador_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  SELECT count(*) INTO v_ocupadas
    FROM partidas_participantes pp
    WHERE pp.partida_id = p_partida_id
      AND pp.jogador_id <> p_jogador_id
      AND (
        pp.status_confirmacao = 'confirmado'
        OR (pp.status_confirmacao = 'pendente' AND now() < COALESCE(v_closes_at, now()))
      );

  v_alvo_ocupa := (p_status = 'confirmado')
               OR (p_status = 'pendente' AND now() < COALESCE(v_closes_at, now()));

  IF v_alvo_ocupa AND v_ocupadas >= 14 THEN
    RETURN false;
  END IF;

  UPDATE partidas_participantes
    SET status_confirmacao = p_status,
        confirmado_em = CASE WHEN p_status = 'confirmado' THEN now() ELSE NULL END
    WHERE partida_id = p_partida_id AND jogador_id = p_jogador_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION confirmar_presenca(bigint, bigint, text) TO anon, authenticated;

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
  v_closes_at      timestamptz;
  v_ocupadas       bigint;
  v_existe         boolean;
BEGIN
  SELECT p.status, p.confirmacao_closes_at
    INTO v_status_partida, v_closes_at
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
      AND (
        pp.status_confirmacao = 'confirmado'
        OR (pp.status_confirmacao = 'pendente' AND now() < COALESCE(v_closes_at, now()))
      );
  IF v_ocupadas >= 14 THEN
    RETURN false;
  END IF;

  INSERT INTO partidas_participantes (partida_id, jogador_id, posicao, status_confirmacao)
    SELECT p_partida_id, j.id, j.posicao, 'confirmado'
    FROM jogadores j
    WHERE j.id = p_jogador_id;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION adicionar_participante(bigint, bigint) TO anon, authenticated;

CREATE OR REPLACE FUNCTION abrir_partida(p_partida_id bigint)
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
  SELECT status INTO v_status
  FROM partidas
  WHERE id = p_partida_id;

  IF v_status IS NULL OR v_status <> 'draft' THEN
    RETURN false;
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE time = 'a'),
    COUNT(*) FILTER (WHERE time = 'b'),
    COUNT(*) FILTER (WHERE time = 'a' AND posicao = 'goleiro'),
    COUNT(*) FILTER (WHERE time = 'b' AND posicao = 'goleiro')
  INTO v_time_a, v_time_b, v_gk_a, v_gk_b
  FROM partidas_participantes
  WHERE partida_id = p_partida_id
    AND status_confirmacao = 'confirmado';

  IF v_time_a <> 7 OR v_time_b <> 7 THEN
    RETURN false;
  END IF;

  IF v_gk_a > 1 OR v_gk_b > 1 THEN
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

GRANT EXECUTE ON FUNCTION abrir_partida(bigint) TO anon, authenticated;

-- 081_fix_cron_partida_semanal_fallback_draft.sql
-- Correção no cron `agendar-partida-semanal` com fallback para draft existente da semana.

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

-- 083_seguranca_goleiros_e_admin_gates.sql

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


