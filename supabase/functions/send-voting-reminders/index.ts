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

// 4 buckets fixos: últimos 6h, 3h, 1h e 30min antes de fechar a votação.
// Cada bucket tem janela de 10 min para ser capturado pelo cron (1 min).
const allReminders = [
  { key: '6h', offsetMs: 6 * 60 * 60 * 1000, label: '6 horas' },
  { key: '3h', offsetMs: 3 * 60 * 60 * 1000, label: '3 horas' },
  { key: '1h', offsetMs: 60 * 60 * 1000, label: '1 hora' },
  { key: '30m', offsetMs: 30 * 60 * 1000, label: '30 minutos' },
] as const;

const reminderWindowMs = 10 * 60 * 1000;

type ReminderKey = (typeof allReminders)[number]['key'];

type SubscriptionData = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

type Candidate = {
  partida_id: number;
  jogador_id: number;
  voting_closes_at: string;
  reminder_key: ReminderKey;
  label: string;
  subscriptions: SubscriptionData[];
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

async function findCandidates(activeReminders: typeof allReminders): Promise<Candidate[]> {
  if (activeReminders.length === 0) return [];

  const now = Date.now();
  // Janela máxima coberta pelos buckets ativos
  const maxOffset = Math.max(...activeReminders.map((r) => r.offsetMs));
  const maxOffsetMinutes = Math.ceil((maxOffset + reminderWindowMs) / (60 * 1000));
  const intervalParam = `${maxOffsetMinutes} minutes`;

  const { data, error } = await supabase.rpc('listar_pendentes_votacao', {
    p_janela_maxima_interval: intervalParam,
  });

  if (error) throw error;

  const candidates: Candidate[] = [];
  for (const item of data ?? []) {
    const remaining = new Date(item.voting_closes_at).getTime() - now;
    const reminder = activeReminders.find(
      (r) => remaining <= r.offsetMs && remaining > r.offsetMs - reminderWindowMs
    );
    if (!reminder) continue;

    const subscriptions: SubscriptionData[] = Array.isArray(item.subscriptions)
      ? item.subscriptions
      : [];
    if (subscriptions.length === 0) continue;

    candidates.push({
      partida_id: item.partida_id,
      jogador_id: item.jogador_id,
      voting_closes_at: item.voting_closes_at,
      reminder_key: reminder.key,
      label: reminder.label,
      subscriptions,
    });
  }
  return candidates;
}

async function claim(candidate: Candidate) {
  const { data, error } = await supabase
    .from('push_reminder_deliveries')
    .insert({
      partida_id: candidate.partida_id,
      jogador_id: candidate.jogador_id,
      reminder_key: candidate.reminder_key,
    })
    .select('partida_id')
    .maybeSingle();
  if (error && error.code !== '23505') throw error;
  return Boolean(data);
}

async function send(
  candidate: Candidate,
  templates: Record<ReminderKey, { title: string; body: string }>
) {
  const template = templates[candidate.reminder_key];
  const payload = JSON.stringify({
    title: template.title,
    body: template.body,
    url: `/partida/${candidate.partida_id}/votar`,
    partida_id: candidate.partida_id,
    tag: `votar-partida-${candidate.partida_id}`,
  });
  let lastError: string | null = null;

  for (const subscription of candidate.subscriptions) {
    const pushSubscription = {
      endpoint: subscription.endpoint,
      keys: { p256dh: subscription.p256dh, auth: subscription.auth },
    };
    try {
      await webpush.sendNotification(pushSubscription, payload);
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint);
      }
    }
  }

  await supabase
    .from('push_reminder_deliveries')
    .update({ sent_at: new Date().toISOString(), error_message: lastError })
    .eq('partida_id', candidate.partida_id)
    .eq('jogador_id', candidate.jogador_id)
    .eq('reminder_key', candidate.reminder_key);
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (request.headers.get('x-push-cron-secret') !== cronSecret) {
    return json({ error: 'Unauthorized' }, 401);
  }

  // 1. Lê configurações de notificações
  const { data: config, error: cfgErr } = await supabase
    .from('notificacoes_config')
    .select('*')
    .eq('id', 1)
    .maybeSingle();

  if (cfgErr) {
    console.error('Erro ao ler notificacoes_config:', cfgErr);
  }

  if (config?.votacao_ativo === false) {
    return json({ ok: true, skipped: true, motivo: 'votacao_ativo=false' }, 200);
  }

  // 2. Filtra buckets ativos
  const activeReminders = allReminders.filter((r) => {
    if (r.key === '6h') return config?.votacao_bucket_6h ?? true;
    if (r.key === '3h') return config?.votacao_bucket_3h ?? true;
    if (r.key === '1h') return config?.votacao_bucket_1h ?? true;
    if (r.key === '30m') return config?.votacao_bucket_30m ?? true;
    return true;
  });

  if (activeReminders.length === 0) {
    return json({ ok: true, skipped: true, motivo: 'nenhum bucket ativo' }, 200);
  }

  // 3. Monta templates por bucket
  const templates: Record<ReminderKey, { title: string; body: string }> = {
    '6h': {
      title: config?.votacao_template_6h_titulo?.trim() || 'Faltam 6 horas para fechar a votação!',
      body:
        config?.votacao_template_6h_msg?.trim() ||
        'Avalie a partida de ontem e deixe suas notas para o ranking.',
    },
    '3h': {
      title:
        config?.votacao_template_3h_titulo?.trim() ||
        'Vote, ou então não reclama depois que a divisão tá ruim!',
      body:
        config?.votacao_template_3h_msg?.trim() ||
        'Faltam apenas 3 horas para fechar a súmula da partida de ontem.',
    },
    '1h': {
      title:
        config?.votacao_template_1h_titulo?.trim() || 'Os analfabetos da bola já votaram, e você?',
      body:
        config?.votacao_template_1h_msg?.trim() ||
        'Acesse a partida de ontem antes que o tempo de votação esgote.',
    },
    '30m': {
      title:
        config?.votacao_template_30m_titulo?.trim() ||
        'Ainda não votou, vai deixar Tchuca avacalhar as notas!?',
      body:
        config?.votacao_template_30m_msg?.trim() ||
        'Últimos 30 minutos para registrar seu voto na partida de ontem!',
    },
  };

  try {
    const candidates = await findCandidates(activeReminders);
    let claimed = 0;
    for (const candidate of candidates) {
      if (await claim(candidate)) {
        claimed++;
        await send(candidate, templates);
      }
    }
    return json({ candidates: candidates.length, claimed });
  } catch (error) {
    console.error(error);
    return json({ error: errorMessage(error) }, 500);
  }
});
