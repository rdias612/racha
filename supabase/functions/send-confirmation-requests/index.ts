// Edge Function: send-confirmation-requests
//
// Disparada pelo pg_cron semanal (migration 060) logo após a criação automática
// da partida. Envia um push pedindo que cada mensalista PENDENTE confirme
// presença. Idempotente via push_reminder_deliveries (reminder_key='confirmacao'):
// re-execuções não reenviam o push para o mesmo (partida, jogador).
//
// Body esperado: { "partida_id": 123 }. Header obrigatório: x-push-cron-secret.
//
// Espelha o esqueleto de send-voting-reminders (mesmo web-push, mesmas env vars).

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

type Target = {
  partida_id: number;
  jogador_id: number;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null) return JSON.stringify(error);
  return String(error);
}

// Mensalistas PENDENTES da partida, ativos, e com inscrição push ativa.
async function findTargets(partidaId: number): Promise<Target[]> {
  const { data: partida, error: pErr } = await supabase
    .from('partidas')
    .select('id, status')
    .eq('id', partidaId)
    .maybeSingle();
  if (pErr) throw pErr;
  if (!partida || partida.status !== 'draft') return [];

  const { data: pendentes, error: ppErr } = await supabase
    .from('partidas_participantes')
    .select('jogador_id')
    .eq('partida_id', partidaId)
    .eq('status_confirmacao', 'pendente');
  if (ppErr) throw ppErr;

  const ids = (pendentes ?? []).map((p) => p.jogador_id);
  if (ids.length === 0) return [];

  const { data: ativos, error: jErr } = await supabase
    .from('jogadores')
    .select('id')
    .in('id', ids)
    .eq('is_ativo', true);
  if (jErr) throw jErr;
  const ativoIds = new Set((ativos ?? []).map((j) => j.id));

  const { data: subs, error: sErr } = await supabase
    .from('push_subscriptions')
    .select('jogador_id')
    .in('jogador_id', ids);
  if (sErr) throw sErr;
  const subIds = new Set((subs ?? []).map((s) => s.jogador_id));

  return ids
    .filter((id) => ativoIds.has(id) && subIds.has(id))
    .map((id) => ({ partida_id: partidaId, jogador_id: id }));
}

// Idempotência: insert-or-nothing em (partida_id, jogador_id, 'confirmacao').
async function claim(t: Target): Promise<boolean> {
  const { data, error } = await supabase
    .from('push_reminder_deliveries')
    .insert({
      partida_id: t.partida_id,
      jogador_id: t.jogador_id,
      reminder_key: 'confirmacao',
    })
    .select('partida_id')
    .maybeSingle();
  if (error && error.code !== '23505') throw error;
  return Boolean(data);
}

async function send(t: Target) {
  const { data: subscriptions, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('jogador_id', t.jogador_id);
  if (error) throw error;

  const payload = JSON.stringify({
    title: 'Confirme sua presença',
    body: 'Tem racha quinta 19h! Reserve sua vaga até quarta 16h.',
    url: `/partida/${t.partida_id}`,
    partida_id: t.partida_id,
    tag: `confirmacao-${t.partida_id}`,
  });

  let lastError: string | null = null;
  for (const subscription of subscriptions ?? []) {
    const pushSubscription = {
      endpoint: subscription.endpoint,
      keys: { p256dh: subscription.p256dh, auth: subscription.auth },
    };
    try {
      await webpush.sendNotification(pushSubscription, payload);
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint);
      }
    }
  }

  await supabase
    .from('push_reminder_deliveries')
    .update({ sent_at: new Date().toISOString(), error_message: lastError })
    .eq('partida_id', t.partida_id)
    .eq('jogador_id', t.jogador_id)
    .eq('reminder_key', 'confirmacao');
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (request.headers.get('x-push-cron-secret') !== cronSecret) {
    return json({ error: 'Unauthorized' }, 401);
  }

  let partidaId: number | null = null;
  try {
    const body = await request.json().catch(() => ({}));
    const raw = (body as { partida_id?: unknown })?.partida_id;
    if (typeof raw === 'number') partidaId = raw;
    else if (typeof raw === 'string' && raw.trim() !== '') partidaId = Number(raw);
  } catch {
    /* body vazio */
  }
  if (partidaId === null || !Number.isFinite(partidaId)) {
    return json({ error: 'partida_id ausente ou inválido' }, 400);
  }

  try {
    const targets = await findTargets(partidaId);
    let claimed = 0;
    for (const target of targets) {
      if (await claim(target)) {
        claimed++;
        await send(target);
      }
    }
    return json({ partida_id: partidaId, targets: targets.length, claimed });
  } catch (error) {
    console.error(error);
    return json({ error: errorMessage(error) }, 500);
  }
});
