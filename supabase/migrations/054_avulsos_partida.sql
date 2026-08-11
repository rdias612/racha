-- 054_avulsos_partida.sql
-- Geração automática de avulsos (R$20) para os participantes NÃO-mensalistas ao
-- finalizar uma partida. É chamada tanto por finalizar_partida (live->published)
-- quanto por publicar_partida (draft->published, caminho legado do PartidaEditar).
--
-- Dedup: o índice único abaixo impede cobrar 2x o mesmo jogador na mesma partida,
-- tornando gerar_avulsos_partida idempotente (re-runs seguros via ON CONFLICT).

CREATE UNIQUE INDEX uq_dividas_avulso_partida
  ON dividas (partida_id, jogador_id)
  WHERE tipo = 'avulso' AND partida_id IS NOT NULL;

-- Insere um avulso de R$20 para cada participante NÃO-mensalista da partida.
-- data_divida = dia da partida (BRT); referencia = mês da partida (p/ agrupar).
-- Idempotente via ON CONFLICT DO NOTHING.
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
  ON CONFLICT DO NOTHING;
END;
$$;
GRANT EXECUTE ON FUNCTION gerar_avulsos_partida(bigint) TO anon, authenticated;

-- Caminho legado (PartidaEditar: draft -> published). Centraliza a transição e
-- também gera os avulsos, substituindo o UPDATE direto que havia no frontend.
-- Retorna false se a partida não existir ou não estiver em 'draft'.
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

  UPDATE partidas
     SET status = 'published',
         voting_closes_at = now() + interval '24 hours'
   WHERE id = p_partida_id;
  RETURN true;
END;
$$;
GRANT EXECUTE ON FUNCTION publicar_partida(bigint) TO anon, authenticated;

-- Redefine finalizar_partida (live -> published) acrescentando a geração de avulsos.
-- Corpo original da migration 047 + PERFORM gerar_avulsos_partida.
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

  UPDATE partidas
     SET status = 'published',
         voting_closes_at = now() + interval '24 hours'
   WHERE id = p_partida_id;
  RETURN true;
END;
$$;
GRANT EXECUTE ON FUNCTION finalizar_partida(bigint) TO anon, authenticated;
