-- Adiciona gols contra como contador por participante.
ALTER TABLE partidas_participantes
  ADD COLUMN IF NOT EXISTS gols_contra integer NOT NULL DEFAULT 0 CHECK (gols_contra >= 0);

CREATE OR REPLACE VIEW partida_placar AS
SELECT
  p.id AS partida_id,
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
    ) THEN 'a'
    WHEN (
      COALESCE(SUM(CASE WHEN pp.time = 'a' THEN pp.gols ELSE 0 END), 0)
      + COALESCE(SUM(CASE WHEN pp.time = 'b' THEN pp.gols_contra ELSE 0 END), 0)
    ) < (
      COALESCE(SUM(CASE WHEN pp.time = 'b' THEN pp.gols ELSE 0 END), 0)
      + COALESCE(SUM(CASE WHEN pp.time = 'a' THEN pp.gols_contra ELSE 0 END), 0)
    ) THEN 'b'
    ELSE 'empate'
  END AS vencedor
FROM partidas p
LEFT JOIN partidas_participantes pp ON pp.partida_id = p.id
GROUP BY p.id;

CREATE OR REPLACE VIEW ranking AS
SELECT
  pp.jogador_id,
  j.nome,
  (
    COUNT(*) FILTER (WHERE pl.vencedor = pp.time) * 3
    + COUNT(*) FILTER (WHERE pl.vencedor = 'empate')
  ) AS pontos,
  COUNT(*) FILTER (WHERE pl.vencedor = pp.time) AS vitorias,
  COUNT(*) FILTER (WHERE pl.vencedor = 'empate') AS empates,
  COUNT(*) FILTER (
    WHERE pl.vencedor <> pp.time AND pl.vencedor <> 'empate'
  ) AS derrotas,
  COUNT(*) AS partidas,
  COALESCE(SUM(pp.gols), 0) AS gols,
  COALESCE(SUM(pp.assistencias), 0) AS assistencias,
  COALESCE(SUM(pp.gols_contra), 0) AS gols_contra
FROM partidas_participantes pp
JOIN partidas p ON p.id = pp.partida_id
JOIN partida_placar pl ON pl.partida_id = pp.partida_id
JOIN jogadores j ON j.id = pp.jogador_id
WHERE p.status IN ('published', 'closed')
GROUP BY pp.jogador_id, j.nome;

CREATE OR REPLACE VIEW stats_jogador AS
SELECT
  pp.jogador_id,
  COUNT(*) AS partidas,
  COALESCE(SUM(pp.gols), 0) AS gols,
  COALESCE(SUM(pp.assistencias), 0) AS assistencias,
  COUNT(*) FILTER (WHERE pl.vencedor = pp.time) AS vitorias,
  COALESCE(SUM(pp.gols_contra), 0) AS gols_contra
FROM partidas_participantes pp
JOIN partidas p ON p.id = pp.partida_id
JOIN partida_placar pl ON pl.partida_id = pp.partida_id
WHERE p.status IN ('published', 'closed')
GROUP BY pp.jogador_id;

CREATE OR REPLACE FUNCTION criar_partida(
  p_data_jogo timestamptz,
  p_criado_por bigint,
  p_participantes jsonb
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partida_id bigint;
  elem jsonb;
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
