-- ============================================================================
-- 114 — Correção da auditoria (A1 da Fase 5, breakdown SDD 35): admin que
--       jogou a partida é destinatário do push de clipes (RF06).
-- ============================================================================
-- A migration 113 excluía admins da branch de participantes
-- (`j.is_admin = false AND EXISTS (...)`), então um admin que jogou a partida
-- não recebia o push 'clipes-prontos' — contradiz o RF06 ("os participantes
-- da partida recebem um push") e a justificativa da divergência 8.1 da spec
-- ("quem está em partidas_participantes daquela partida é destinatário").
-- Correção: remove o `j.is_admin = false` da branch de participantes. O modo
-- admins continua restrito pela cláusula CASE (`j.is_admin = true`), que não
-- muda. Restante idêntico à 113 (byte a byte), grants repetidos idempotentes.

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
        EXISTS (
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
