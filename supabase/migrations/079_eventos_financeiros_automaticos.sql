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
