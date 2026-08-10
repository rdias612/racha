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
  nome        text        NOT NULL,
  posicao     text        NOT NULL CHECK (posicao IN ('goleiro','zagueiro','lateral','meia','atacante')),
  is_admin    boolean     NOT NULL DEFAULT false,
  is_ativo    boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
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
  id        bigint,
  username  text,
  nome      text,
  posicao   text,
  is_admin  boolean,
  is_ativo  boolean
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
    v_jogador.nome,
    v_jogador.posicao,
    v_jogador.is_admin,
    v_jogador.is_ativo;
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
                              CHECK (status IN ('draft','published','closed')),
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
  posicao       text    NOT NULL CHECK (posicao IN ('goleiro','zagueiro','lateral','meia','atacante')),
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
--       avg_rating = AVG(rating), vote_count = COUNT(*).
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
WITH agg AS (
  SELECT
    v.partida_id,
    v.target_id,
    j.nome,
    AVG(v.rating)::numeric                                     AS avg_rating,
    COUNT(*)::bigint                                           AS vote_count,
    RANK() OVER (
      PARTITION BY v.partida_id
      ORDER BY AVG(v.rating) DESC, COUNT(*) DESC, j.nome ASC
    )                                                          AS rk
  FROM votes v
  JOIN jogadores j ON j.id = v.target_id
  GROUP BY v.partida_id, v.target_id, j.nome
)
SELECT
  partida_id,
  target_id,
  nome,
  avg_rating,
  vote_count,
  (rk = 1) AS is_craque
FROM agg;
-- 009_view_ranking.sql
-- View `ranking` por jogador com colunas:
--   jogador_id, nome, pontos, vitorias, empates, derrotas, partidas, gols, assistencias.
--
-- Regras:
--   - Considera apenas partidas com status IN ('published','closed'). Drafts nao
--     contam (o admin ainda esta montando).
--   - Para cada participante, determina o resultado (vitoria/empate/derrota)
--     comparando o time dele ('a'/'b') com o `vencedor` da view partida_placar:
--       vitoria  = (time_do_jogador = vencedor)
--       empate   = (vencedor = 'empate')
--       derrota  = caso contrario.
--   - pontos = vitorias*3 + empates*1.
--   - Soma gols e assistencias de todas as participacoes do jogador.
--   - Agrupa por (jogador_id, nome).
--
-- Ordenacao final da query do app (NAO na view - views nao garantem ordem):
--   ORDER BY pontos DESC, vitorias DESC, partidas DESC, gols DESC,
--            assistencias DESC, nome ASC
-- A view inclui todas as colunas necessarias para esse ORDER BY.

CREATE OR REPLACE VIEW ranking AS
SELECT
  pp.jogador_id,
  j.nome,
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
  COALESCE(SUM(pp.gols_contra), 0)                          AS gols_contra
FROM partidas_participantes pp
JOIN partidas      p  ON p.id  = pp.partida_id
JOIN partida_placar pl ON pl.partida_id = pp.partida_id
JOIN jogadores     j  ON j.id  = pp.jogador_id
WHERE p.status IN ('published','closed')
GROUP BY pp.jogador_id, j.nome;
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
  p_username text,
  p_nome     text,
  p_posicao  text,
  p_is_admin boolean
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id bigint;
BEGIN
  INSERT INTO jogadores (username, senha_hash, nome, posicao, is_admin, is_ativo)
  VALUES (p_username, '123', p_nome, p_posicao, p_is_admin, true)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION criar_jogador(text, text, text, boolean) TO anon, authenticated;
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

  -- (2) Validacao previa: nenhum self-vote. Iteramos antes de gravar para
  --     garantir atomicidade (ou grava tudo, ou nada).
  FOR elem IN SELECT * FROM jsonb_array_elements(p_votos)
  LOOP
    v_target_id := (elem->>'target_id')::bigint;
    IF v_target_id = p_voter_id THEN
      RETURN false;
    END IF;
  END LOOP;

  -- (3) UPSERT de cada voto em transacao.
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
