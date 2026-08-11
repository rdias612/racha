-- 051_create_dividas.sql
-- Controle financeiro: tabela `dividas`. Cada linha = UMA dívida individual
-- de um jogador (uma mensalidade esquecida, um avulso não pago, etc.).
-- O total devido por jogador = SUM(valor) WHERE paga = false (computado no app).
--
-- Modelo "uma linha por evento": permite destrinchar o total de cada jogador
-- nos eventos que o formam, com tipo e data. Não há geração automática ainda
-- (mensalidade por mês / avulso por partida); o admin lança cada dívida manualmente.
--
-- Colunas:
--   tipo         : mensalidade | avulso | outro
--   referencia   : ex. '2026-08' (mês/competência da mensalidade)
--   partida_id   : avulso vinculado a um jogo (opcional; NULL nos demais)
--   data_divida  : "quando" a dívida ocorreu (default hoje)
--   paga/data_pagamento : controle de quitação
--
-- Segurança relaxada (Regra 6): gate de admin só no app (UI esconde a tela).
-- As RPCs confiam no caller, coerente com criar_jogador etc.

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

-- Evita cobrar 2x a mesma mensalidade do mesmo mês para o mesmo jogador.
-- (Avulsos podem repetir referencia NULL, por isso o filtro parcial.)
CREATE UNIQUE INDEX uq_dividas_mensalidade_mes
  ON dividas (jogador_id, referencia)
  WHERE tipo = 'mensalidade' AND referencia IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON dividas TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE dividas_id_seq TO anon, authenticated;

-- Lança uma nova dívida. Retorna o id criado.
-- (data_divida NULL cai para current_date dentro da função.)
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

-- Marca UMA dívida como paga.
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

-- Marca TODAS as dívidas em aberto de um jogador como pagas (conveniência).
CREATE OR REPLACE FUNCTION quitar_dividas_jogador(p_jogador_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE dividas
     SET paga = true, data_pagamento = current_date
   WHERE jogador_id = p_jogador_id AND paga = false;
END;
$$;

GRANT EXECUTE ON FUNCTION quitar_dividas_jogador(bigint) TO anon, authenticated;
