// Função de teste: dispara notificação push imediata para um jogador.
// Ignora slot de 15min e qualquer critério da função de produção.
//
// Uso (via cron secret, igual à principal — evita criar auth nova só p/ teste):
//   POST /functions/v1/send-test-push
//   Headers: x-push-cron-secret: <seu segredo do cron>
//   Body (opcional): { "jogador_id": 1 }
//
// Default: jogador_id = 1 (dico).

import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey =
  Deno.env.get('PUSH_SUPABASE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const cronSecret = Deno.env.get('PUSH_CRON_SECRET');
const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com';
const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');

if (!supabaseUrl || !serviceRoleKey || !cronSecret || !vapidPublicKey || !vapidPrivateKey) {
  throw new Error('Missing notification function secrets.');
}

webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (request.headers.get('x-push-cron-secret') !== cronSecret) {
    return json({ error: 'Unauthorized' }, 401);
  }

  let jogadorId = 1; // default: dico
  try {
    const body = await request.json().catch(() => ({}));
    if (typeof body?.jogador_id === 'number') jogadorId = body.jogador_id;
  } catch {
    // body vazio é ok — usa default
  }

  try {
    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('jogador_id', jogadorId);
    if (error) throw error;

    if (!subscriptions || subscriptions.length === 0) {
      return json({ ok: false, erro: `Sem inscrições push para jogador_id=${jogadorId}` }, 404);
    }

    const payload = JSON.stringify({
      title: '🔔 Teste de notificação',
      body: `Push direto para jogador ${jogadorId} às ${new Date().toISOString()}`,
      url: '/',
    });

    const resultados = [];
    let ultimoErro: string | null = null;

    for (const subscription of subscriptions) {
      const pushSubscription = {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      };
      try {
        // Teste é diagnóstico do agora: TTL curto para não ficar retido e
        // chegar minutos depois como se tudo estivesse bem.
        await webpush.sendNotification(pushSubscription, payload, {
          TTL: 5 * 60,
          urgency: 'high',
        });
        resultados.push({ endpoint: subscription.endpoint.slice(-12), ok: true });
      } catch (error) {
        ultimoErro = error instanceof Error ? error.message : String(error);
        const statusCode = (error as { statusCode?: number }).statusCode;
        // 404/410 = endpoint expirado: limpa para não insistir.
        if (statusCode === 404 || statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint);
        }
        resultados.push({
          endpoint: subscription.endpoint.slice(-12),
          ok: false,
          erro: ultimoErro,
          statusCode,
        });
      }
    }

    return json({
      ok: resultados.every((r) => r.ok),
      jogador_id: jogadorId,
      inscricoes: subscriptions.length,
      resultados,
      ultimo_erro: ultimoErro,
    });
  } catch (error) {
    return json({ ok: false, erro: error instanceof Error ? error.message : String(error) }, 500);
  }
});
