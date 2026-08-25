-- 075_dividas_natureza_despesa.sql
-- Controle financeiro: diferencia receita (racha a receber) de despesa
-- (racha a pagar) e amplia os tipos de lançamento.
--
-- Novos tipos: goleiro | campo | eventos (além de mensalidade | avulso | outro).
-- Natureza: receita (default, compatível com dados existentes) | despesa.
-- jogador_id fica opcional em despesas (ex.: aluguel de campo sem atleta).

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
  j.nome          AS nome,
  j.username      AS username,
  j.is_mensalista AS is_mensalista,
  COALESCE(
    SUM(d.valor) FILTER (WHERE d.paga = false AND d.natureza = 'receita'),
    0
  )::numeric AS total_devido,
  COUNT(d.id) FILTER (WHERE d.paga = false AND d.natureza = 'receita')::bigint AS qtd_dividas
FROM jogadores j
LEFT JOIN dividas d ON d.jogador_id = j.id
GROUP BY j.id, j.nome, j.username, j.is_mensalista;

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
