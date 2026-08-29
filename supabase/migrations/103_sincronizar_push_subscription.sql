-- P1 da análise de push (docs/analise-notificacoes-push.md): recuperação
-- automática de subscrição morta. O handler `pushsubscriptionchange` do sw.js
-- re-inscreve o aparelho, mas não conhece o jogador_id — a sincronização casa
-- pela linha do endpoint antigo já conhecida pelo banco. Sem casamento (linha
-- já limpa por 404/410), o boot do app recupera pelo re-check silencioso.

CREATE OR REPLACE FUNCTION sincronizar_push_subscription(
  p_endpoint_antigo text,
  p_endpoint_novo text,
  p_p256dh text,
  p_auth text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(p_endpoint_novo, '') = ''
     OR COALESCE(p_p256dh, '') = ''
     OR COALESCE(p_auth, '') = ''
     OR COALESCE(p_endpoint_antigo, '') = '' THEN
    RETURN false;
  END IF;

  UPDATE push_subscriptions
     SET endpoint = p_endpoint_novo,
         p256dh = p_p256dh,
         auth = p_auth,
         updated_at = now()
   WHERE endpoint = p_endpoint_antigo
     AND endpoint <> p_endpoint_novo;

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION sincronizar_push_subscription(text, text, text, text)
  TO anon, authenticated;
