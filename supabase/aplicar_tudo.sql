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
  nome           text,
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
    v_jogador.nome,
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
  nome             text,
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
      j.nome,
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
    GROUP BY outp.jogador_id, j.nome
    HAVING COUNT(*) >= p_min_partidas
  ),
  adversarios AS (
    SELECT
      'adversario'::text AS tipo,
      outp.jogador_id,
      j.nome,
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
    GROUP BY outp.jogador_id, j.nome
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
    nome,
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
    percentual DESC NULLS LAST,
    partidas DESC,
    vitorias DESC,
    nome ASC;
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
    ja.nome AS jogador_a_nome,
    jb.nome AS jogador_b_nome,
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
    pontos         DESC,
    partidas       DESC,
    vitorias       DESC,
    jogador_a_nome ASC,
    jogador_b_nome ASC;
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
    GROUP BY outp.jogador_id, j.nome
    HAVING COUNT(*) >= p_min_partidas
  )
  (SELECT 'mais_gols'::text   AS metrica,
          jogador_id          AS outro_jogador_id,
          nome,
          partidas,
          gols_usuario        AS valor
   FROM companheiros
   ORDER BY gols_usuario DESC NULLS LAST, partidas DESC, nome ASC
   LIMIT 1)
  UNION ALL
  (SELECT 'melhor_nota'::text AS metrica,
          jogador_id          AS outro_jogador_id,
          nome,
          partidas,
          nota_media_usuario  AS valor
   FROM companheiros
   WHERE nota_media_usuario IS NOT NULL
   ORDER BY nota_media_usuario DESC NULLS LAST, partidas DESC, nome ASC
   LIMIT 1)
  UNION ALL
  (SELECT 'pior_nota'::text   AS metrica,
          jogador_id          AS outro_jogador_id,
          nome,
          partidas,
          nota_media_usuario  AS valor
   FROM companheiros
   WHERE nota_media_usuario IS NOT NULL
   ORDER BY nota_media_usuario ASC NULLS LAST, partidas DESC, nome ASC
   LIMIT 1);
$$;

GRANT EXECUTE ON FUNCTION parcerias_destaque_jogador(bigint, integer) TO anon, authenticated;

-- 049_update_resumo_ano_sequencias_atuais.sql
-- Atualiza resumo_ano(p_ano) para calcular sequencias de vitorias e secas considerando o momento atual (sequencia ativa) em vez da maior sequencia historica do ano.

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
  ),
  jogador_primeira_derrota AS (
    SELECT
      jogador_id,
      nome,
      MIN(rn) FILTER (WHERE NOT venceu) AS first_loss_rn,
      MAX(rn) AS total_jogos
    FROM jogador_partidas
    GROUP BY jogador_id, nome
  ),
  sequencias_vitorias_atuais AS (
    SELECT
      jogador_id,
      nome,
      COALESCE(first_loss_rn - 1, total_jogos)::bigint AS tamanho
    FROM jogador_primeira_derrota
  ),
  jogador_primeira_vitoria AS (
    SELECT
      jogador_id,
      nome,
      MIN(rn) FILTER (WHERE venceu) AS first_win_rn,
      MAX(rn) AS total_jogos
    FROM jogador_partidas
    GROUP BY jogador_id, nome
  ),
  secas_vitorias_atuais AS (
    SELECT
      jogador_id,
      nome,
      COALESCE(first_win_rn - 1, total_jogos)::bigint AS tamanho
    FROM jogador_primeira_vitoria
  ),
  maior_sequencia_vitorias AS (
    SELECT sv.jogador_id, sv.nome, sv.tamanho
    FROM sequencias_vitorias_atuais sv
    JOIN stats s ON s.jogador_id = sv.jogador_id
    WHERE sv.tamanho > 0
    ORDER BY sv.tamanho DESC, s.partidas DESC, sv.nome ASC
    LIMIT 1
  ),
  maior_seca_vitorias AS (
    SELECT sv.jogador_id, sv.nome, sv.tamanho
    FROM secas_vitorias_atuais sv
    JOIN stats s ON s.jogador_id = sv.jogador_id
    WHERE sv.tamanho > 0
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
    END,
    sv.jogador_id,
    sv.nome,
    sv.tamanho,
    ss.jogador_id,
    ss.nome,
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
