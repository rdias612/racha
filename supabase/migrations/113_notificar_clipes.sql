-- ============================================================================
-- 113 — Fase 5 (RF06/RF07) do breakdown SDD 35: push de resultado das
--       importações de clipes (docs/planos-implementacao/35-fases/fase-5-tasks.md)
-- ============================================================================
-- 1. Ledger push_reminder_deliveries aceita as 3 chaves novas da feature
--    Clipes (mesmo mecanismo das relaxas 045/057/077/107 — a 107 é o
--    precedente imediato).
-- 2. RPC listar_destinatarios_clipes: destinatários do push em 1 round-trip
--    (padrão listar_pendentes_votacao_abertura, 107:42-86), com modo
--    participantes (RF06) ou admins (RF07). Grant só à service_role: nenhuma
--    superfície do frontend chama esta RPC (divergência 8.2 da fase 5).

-- ----------------------------------------------------------------------------
-- 1. Ledger aceita as chaves da feature Clipes
-- ----------------------------------------------------------------------------
ALTER TABLE push_reminder_deliveries
  DROP CONSTRAINT IF EXISTS push_reminder_deliveries_reminder_key_check;

ALTER TABLE push_reminder_deliveries
  ADD CONSTRAINT push_reminder_deliveries_reminder_key_check
  CHECK (
    reminder_key IN ('6h','3h','1h','30m','confirmacao','reforco','votacao-aberta',
                     'clipes-prontos','clipes-sem-clipes','clipes-falha')
    OR reminder_key ~ '^([01][0-9]|2[0-3]):(00|15|30|45)$'
  );

-- ----------------------------------------------------------------------------
-- 2. RPC de destinatários — irmã de listar_pendentes_votacao_abertura (107:42-86)
--    p_apenas_admins = false → participantes da partida com inscrição push (RF06;
--    goleiros INCLUÍDOS — participaram da partida e querem ver os clipes;
--    status_confirmacao NÃO filtra: quem está em partidas_participantes é destinatário)
--    p_apenas_admins = true  → admins ativos com inscrição push (RF07)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION listar_destinatarios_clipes(
  p_partida_id    bigint,
  p_apenas_admins boolean DEFAULT false
)
RETURNS TABLE (
  jogador_id    bigint,
  subscriptions jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    j.id   AS jogador_id,
    jsonb_agg(
      jsonb_build_object(
        'endpoint', ps.endpoint,
        'p256dh', ps.p256dh,
        'auth', ps.auth
      )
    )      AS subscriptions
  FROM push_subscriptions ps
  JOIN jogadores j ON j.id = ps.jogador_id
  WHERE j.is_ativo = true
    AND (
      p_apenas_admins
      OR (
        j.is_admin = false
        AND EXISTS (
          SELECT 1 FROM partidas_participantes pp
          WHERE pp.partida_id = p_partida_id
            AND pp.jogador_id = j.id
        )
      )
    )
    AND CASE WHEN p_apenas_admins THEN j.is_admin = true ELSE true END
  GROUP BY j.id;
$$;

-- Executável EXCLUSIVAMENTE pela service_role (só a Edge Function chama):
REVOKE ALL ON FUNCTION listar_destinatarios_clipes(bigint, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION listar_destinatarios_clipes(bigint, boolean)
  FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION listar_destinatarios_clipes(bigint, boolean)
  TO service_role;
