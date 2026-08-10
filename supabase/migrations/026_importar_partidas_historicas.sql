-- 026_importar_partidas_historicas.sql
-- Importa os 28 jogos historicos de docs/placares.txt.
-- Formato dos jogadores: username:gols:gols_contra.
-- Gols e assistencias nao informadas ficam em zero.

DO $$
DECLARE
  v_criado_por bigint;
BEGIN
  CREATE TEMP TABLE _historico_partidas (
    data_jogo timestamptz NOT NULL,
    time_id char(1) NOT NULL,
    username text NOT NULL,
    gols integer NOT NULL DEFAULT 0,
    gols_contra integer NOT NULL DEFAULT 0
  ) ON COMMIT DROP;

  INSERT INTO _historico_partidas (data_jogo, time_id, username, gols, gols_contra)
  SELECT
    r.data_jogo::timestamptz,
    r.time_id::char(1),
    split_part(jogador, ':', 1),
    COALESCE(NULLIF(split_part(jogador, ':', 2), '')::integer, 0),
    COALESCE(NULLIF(split_part(jogador, ':', 3), '')::integer, 0)
  FROM (VALUES
    ('2026-07-30 20:00:00-03', 'a', 'vitor,ed,hees,marcelinho,natal:2,hugo,gualberto'),
    ('2026-07-30 20:00:00-03', 'b', 'tadeu,dico,jp:3,andret:1,guilherme,danilo:2,fil:4'),
    ('2026-07-23 20:00:00-03', 'a', 'natal:1,cadinho:2,gualberto:1,dudu:1,dico,thiagao:2'),
    ('2026-07-23 20:00:00-03', 'b', 'danilo:1,hugo,bill:1,vitor:1,ed,jp'),
    ('2026-07-16 20:00:00-03', 'a', 'fil:2,cadinho:1,dico,hugo,jp,vitor,thiago'),
    ('2026-07-16 20:00:00-03', 'b', 'gualberto:2,danilo:1,natal:1,bill:1,tadeu:2,ed:1'),
    ('2026-07-09 20:00:00-03', 'a', 'vitor:2,dico:2:1,hees,marcelinho,andret:0:1,gualberto,dudu:2'),
    ('2026-07-09 20:00:00-03', 'b', 'tadeu,thiagao,ed,jp,hugo,danilo,fil'),
    ('2026-07-02 20:00:00-03', 'a', 'tadeu:1,thiago,ed,natal:1,danilo,jp,fil'),
    ('2026-07-02 20:00:00-03', 'b', 'vitor,dico:1,dudu:0:1,andret:2,caio:1,marcelinho,gualberto:1'),
    ('2026-06-25 20:00:00-03', 'a', 'vitor,gian,jp,natal:1,marcelinho,danilo,fil:3'),
    ('2026-06-25 20:00:00-03', 'b', 'tadeu:1:1,hees:1,dico,gualberto,andret:2,hugo:2,cadinho:4'),
    ('2026-06-18 20:00:00-03', 'a', 'geilson,tadeu,dico:1,thiago,hugo:3,gustavo,danilo:3,vitor:1'),
    ('2026-06-18 20:00:00-03', 'b', 'rodrigo,vitor,ed:1:1,hees:3,natal,cadinho:2,gualberto:2,fil:3'),
    ('2026-06-11 20:00:00-03', 'a', 'tadeu:2,gian,hees:1,hugo,andret:2,marcelinho:0:1,fil:3'),
    ('2026-06-11 20:00:00-03', 'b', 'vitor,ed,dico,natal:3,danilo:2,gualberto:1,victor:3'),
    ('2026-05-28 20:00:00-03', 'a', 'lucas,gustavo:1,ed,andret:1,giovanni:5,luis,fil'),
    ('2026-05-28 20:00:00-03', 'b', 'vitor,dico:1,gian:1,gualberto,natal:1,hugo:2,danilo:1'),
    ('2026-05-21 20:00:00-03', 'a', 'natal:3,andret:4,gustavo:2,tadeu:1,fil:3,jp:1,hees'),
    ('2026-05-21 20:00:00-03', 'b', 'hugo,danilo:2,vitor:1,gabriel:2,gualberto:1,dico,ed:2'),
    ('2026-05-14 20:00:00-03', 'a', 'hugo,cadinho:1,gustavo:2,tadeu,thiagao,ed,thiago'),
    ('2026-05-14 20:00:00-03', 'b', 'natal:1,andret:1,vitor,gualberto:1,jp:1,dico:2,rodrigo'),
    ('2026-05-07 20:00:00-03', 'a', 'hugo:1,luizinho:5,gualberto:1,marcelinho,victorguimaraes,ed'),
    ('2026-05-07 20:00:00-03', 'b', 'natal:3,andret,jp,hees,gian,navas:2'),
    ('2026-04-30 20:00:00-03', 'a', 'tadeu,ed,hees:1,natal:2,coala,gualberto,fil:2'),
    ('2026-04-30 20:00:00-03', 'b', 'vitor,gian:1,dico:1,andret:1,danilo:1,cafuba,victor'),
    ('2026-04-23 20:00:00-03', 'a', 'tadeu:1,dico,thiago,natal:2,gualberto:1,fil:1'),
    ('2026-04-23 20:00:00-03', 'b', 'jp:0:1,joaofelipe,rod,danilo:1,marcelinho,victor,navas:1'),
    ('2026-04-16 20:00:00-03', 'a', 'gualberto,natal:1,andret,bill,vitor:1,thiagao,dico:2'),
    ('2026-04-16 20:00:00-03', 'b', 'tadeu:1,danilo:1,cadinho,fil,victor,jp,ed'),
    ('2026-04-09 20:00:00-03', 'a', 'bill:1,thiagao,tadeu:1,danilo:2,natal:1,gualberto,vitor'),
    ('2026-04-09 20:00:00-03', 'b', 'vitor,ed,dico:1,jp,hugo,andret,fil:3'),
    ('2026-04-02 20:00:00-03', 'a', 'vitor,gian:1,tadeu:2,gualberto:1,natal,jp,navas:2'),
    ('2026-04-02 20:00:00-03', 'b', 'marcelinho:1,dico:1,ed,danilo:1,hugo:3,fil:2,victor'),
    ('2026-03-26 20:00:00-03', 'a', 'thiago,vitor:1,tadeu:1,danilo:1,gualberto:2,andret:1,fil:2'),
    ('2026-03-26 20:00:00-03', 'b', 'thacio,bill,dico,hugo:1,natal:4,jp,victor,ed'),
    ('2026-03-19 20:00:00-03', 'a', 'jp,dico:1,victorguimaraes,gualberto:2,gustavo:2,guilherme,fil:3'),
    ('2026-03-19 20:00:00-03', 'b', 'bill,tadeu:1,ed:2,danilo:7,hugo:1,marcelinho,victor:1'),
    ('2026-03-12 20:00:00-03', 'a', 'andret,ed,dico:1,gualberto,danilo:3,natal:1,victor:1'),
    ('2026-03-12 20:00:00-03', 'b', 'vitor:2,wilner,luizguilherme:1,hugo:1,marcelinho,jp,fil:2'),
    ('2026-03-05 20:00:00-03', 'a', 'bill,gian,dico,danilo:4,gustavo,hugo,victor:2'),
    ('2026-03-05 20:00:00-03', 'b', 'vitor,ed,tadeu,jp:1,natal:1,gualberto,fil:3'),
    ('2026-02-26 20:00:00-03', 'a', 'bill:1,joel,vitor,fil:3,danilo,natal,victor:1'),
    ('2026-02-26 20:00:00-03', 'b', 'jp,gian:1,ed,hugo:1,marcelinho,gustavo:1,gualberto:1'),
    ('2026-02-19 20:00:00-03', 'a', 'andret,victorguimaraes,thiagao,cadinho:1,guto:1,jp,gustavo:2'),
    ('2026-02-19 20:00:00-03', 'b', 'vitor,dico,ed,natal:3,danilo:2,marcelinho,fil:2'),
    ('2026-02-12 20:00:00-03', 'a', 'bill,marcelinho:1,gian,poeys:1,danilo,hugo:2,fil:2'),
    ('2026-02-12 20:00:00-03', 'b', 'ramon,dico,vitor,dude,gustavo,guto:1,gualberto:1'),
    ('2026-02-05 20:00:00-03', 'a', 'vitor:1,fil:2,ed,guto,tadeu:1,danilo:1,cadinho:1'),
    ('2026-02-05 20:00:00-03', 'b', 'bill,dico,thiagao,jp,natal:1,hugo:2,gualberto:2'),
    ('2026-01-29 20:00:00-03', 'a', 'vitor:1,ed,gian,andret,natal:1,gustavo:1,victor:1'),
    ('2026-01-29 20:00:00-03', 'b', 'fil:2,dico:1,jp,hugo:2,danilo:1,gualberto:1,azeita'),
    ('2026-01-22 20:00:00-03', 'a', 'bill,dico,jp:2,fil:3,hugo,danilo:1,gustavo:2'),
    ('2026-01-22 20:00:00-03', 'b', 'vitor,ed,tadeu,natal,gualberto,guto:1,azeita:2'),
    ('2026-01-15 20:00:00-03', 'a', 'fil,ed,jp,hugo:1,jorge:1,gualberto,victor'),
    ('2026-01-15 20:00:00-03', 'b', 'andret:1,dico:2,tadeu,natal,gustavo:3,marcelinho,azeita'),
    ('2026-01-08 20:00:00-03', 'a', 'vitor,tadeu:1,thiagao:1,hugo:1,gustavo,marcelinho,danilo'),
    ('2026-01-08 20:00:00-03', 'b', 'fil:2,ed,guto:1,natal:1,gualberto,azeita,dico:0:1')
  ) AS r(data_jogo, time_id, jogadores)
  CROSS JOIN LATERAL regexp_split_to_table(r.jogadores, ',') AS jogador;

  IF EXISTS (
    SELECT 1
    FROM _historico_partidas h
    LEFT JOIN jogadores j ON j.username = h.username
    WHERE j.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Historico possui username sem jogador cadastrado';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM _historico_partidas
    GROUP BY data_jogo, username
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Historico possui jogador repetido na mesma partida';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM partidas p
    JOIN (SELECT DISTINCT data_jogo FROM _historico_partidas) h
      ON p.data_jogo = h.data_jogo
  ) THEN
    RAISE EXCEPTION 'Uma ou mais partidas historicas ja existem';
  END IF;

  SELECT id INTO v_criado_por FROM jogadores WHERE username = 'dico';

  INSERT INTO partidas (data_jogo, status, voting_closes_at, criado_por)
  SELECT DISTINCT data_jogo, 'closed', data_jogo + interval '24 hours', v_criado_por
  FROM _historico_partidas;

  INSERT INTO partidas_participantes
    (partida_id, jogador_id, time, posicao, gols, assistencias, gols_contra)
  SELECT
    p.id,
    j.id,
    h.time_id,
    j.posicao,
    h.gols,
    0,
    h.gols_contra
  FROM _historico_partidas h
  JOIN partidas p ON p.data_jogo = h.data_jogo
  JOIN jogadores j ON j.username = h.username;
END;
$$;
