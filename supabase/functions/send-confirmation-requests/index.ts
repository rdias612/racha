// Edge Function: send-confirmation-requests
//
// Suporta 3 modos:
// 1. { "partida_id": X } -> Disparo semanal automático (cron semanal).
//    Idempotente via push_reminder_deliveries (reminder_key='confirmacao').
//    Se confirmacao_ativo = false, aborta com 200 sem enviar.
// 2. { } -> Modo reforço automático (cron 1min).
//    Localiza a partida draft com maior id e prazo NOT NULL.
//    Se now estiver na janela [prazo - horas_reforco, prazo), envia aos pendentes.
//    Idempotente via push_reminder_deliveries (reminder_key='reforco').
//    Se reforco_ativo = false, aborta com 200 sem enviar.
// 3. { "partida_id": X, "reenviar": true } -> Reenvio manual do admin.
//    Ação explícita do admin: sempre liberada, não consulta nem escreve no ledger.

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

type PartidaInfo = {
  id: number;
  data_jogo: string;
  confirmacao_closes_at: string | null;
  status: string;
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

function formatarDataJogo(dataStr: string): { dia: string; hora: string } {
  try {
    const d = new Date(dataStr);
    const dia = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(d);
    const hora = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);
    return { dia, hora: `${hora}h` };
  } catch {
    return { dia: 'quinta-feira', hora: '19h' };
  }
}

function formatarPrazo(prazoStr: string | null): string {
  if (!prazoStr) return 'quarta às 16h';
  try {
    const d = new Date(prazoStr);
    const diaSemana = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      weekday: 'long',
    }).format(d);
    const hora = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);
    return `${diaSemana} às ${hora}h`;
  } catch {
    return 'quarta às 16h';
  }
}

function interpolar(
  template: string,
  vars: { dia_jogo: string; hora_jogo: string; prazo: string }
): string {
  return template
    .replace(/{dia_jogo}/g, vars.dia_jogo)
    .replace(/{hora_jogo}/g, vars.hora_jogo)
    .replace(/{prazo}/g, vars.prazo);
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

// Idempotência no ledger de entregas
async function claim(t: Target, reminderKey: 'confirmacao' | 'reforco'): Promise<boolean> {
  const { data, error } = await supabase
    .from('push_reminder_deliveries')
    .insert({
      partida_id: t.partida_id,
      jogador_id: t.jogador_id,
      reminder_key: reminderKey,
    })
    .select('partida_id')
    .maybeSingle();
  if (error && error.code !== '23505') throw error;
  return Boolean(data);
}

async function sendNotification(
  t: Target,
  titulo: string,
  mensagem: string,
  reminderKey?: 'confirmacao' | 'reforco'
) {
  const { data: subscriptions, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('jogador_id', t.jogador_id);
  if (error) throw error;

  const payload = JSON.stringify({
    title: titulo,
    body: mensagem,
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
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint);
      }
    }
  }

  if (reminderKey) {
    await supabase
      .from('push_reminder_deliveries')
      .update({ sent_at: new Date().toISOString(), error_message: lastError })
      .eq('partida_id', t.partida_id)
      .eq('jogador_id', t.jogador_id)
      .eq('reminder_key', reminderKey);
  }
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (request.headers.get('x-push-cron-secret') !== cronSecret) {
    return json({ error: 'Unauthorized' }, 401);
  }

  // 1. Carrega configurações de notificações
  const { data: config, error: cfgErr } = await supabase
    .from('notificacoes_config')
    .select('*')
    .eq('id', 1)
    .maybeSingle();

  if (cfgErr) {
    console.error('Erro ao ler notificacoes_config:', cfgErr);
  }

  let bodyData: { partida_id?: unknown; reenviar?: boolean } = {};
  try {
    bodyData = await request.json().catch(() => ({}));
  } catch {
    /* body vazio */
  }

  let partidaId: number | null = null;
  const rawId = bodyData.partida_id;
  if (typeof rawId === 'number') partidaId = rawId;
  else if (typeof rawId === 'string' && rawId.trim() !== '') partidaId = Number(rawId);

  const isReenvioManual = Boolean(bodyData.reenviar) && partidaId !== null;

  try {
    // MODO 3: Reenvio manual do admin
    if (isReenvioManual && partidaId !== null) {
      const { data: partida, error: pErr } = await supabase
        .from('partidas')
        .select('id, data_jogo, confirmacao_closes_at, status')
        .eq('id', partidaId)
        .maybeSingle();
      if (pErr) throw pErr;
      if (!partida || partida.status !== 'draft') {
        return json({ error: 'Partida não encontrada ou não está em draft' }, 400);
      }

      const { dia, hora } = formatarDataJogo(partida.data_jogo);
      const prazo = formatarPrazo(partida.confirmacao_closes_at);
      const vars = { dia_jogo: dia, hora_jogo: hora, prazo };

      const tituloTemplate = config?.confirmacao_titulo?.trim() || 'Confirme sua presença';
      const msgTemplate =
        config?.confirmacao_mensagem?.trim() ||
        'Tem racha {dia_jogo} {hora_jogo}! Reserve sua vaga até {prazo}.';

      const titulo = interpolar(tituloTemplate, vars);
      const mensagem = interpolar(msgTemplate, vars);

      const targets = await findTargets(partidaId);
      for (const target of targets) {
        await sendNotification(target, titulo, mensagem);
      }
      return json({
        modo: 'reenvio_manual',
        partida_id: partidaId,
        targets: targets.length,
        sent: targets.length,
      });
    }

    // MODO 1: Disparo semanal automático para partida específica
    if (partidaId !== null) {
      if (config?.confirmacao_ativo === false) {
        return json({ ok: true, skipped: true, motivo: 'confirmacao_ativo=false' }, 200);
      }

      const { data: partida, error: pErr } = await supabase
        .from('partidas')
        .select('id, data_jogo, confirmacao_closes_at, status')
        .eq('id', partidaId)
        .maybeSingle();
      if (pErr) throw pErr;
      if (!partida || partida.status !== 'draft') {
        return json({ error: 'Partida não encontrada ou não está em draft' }, 400);
      }

      const { dia, hora } = formatarDataJogo(partida.data_jogo);
      const prazo = formatarPrazo(partida.confirmacao_closes_at);
      const vars = { dia_jogo: dia, hora_jogo: hora, prazo };

      const tituloTemplate = config?.confirmacao_titulo?.trim() || 'Confirme sua presença';
      const msgTemplate =
        config?.confirmacao_mensagem?.trim() ||
        'Tem racha {dia_jogo} {hora_jogo}! Reserve sua vaga até {prazo}.';

      const titulo = interpolar(tituloTemplate, vars);
      const mensagem = interpolar(msgTemplate, vars);

      const targets = await findTargets(partidaId);
      let claimed = 0;
      for (const target of targets) {
        if (await claim(target, 'confirmacao')) {
          claimed++;
          await sendNotification(target, titulo, mensagem, 'confirmacao');
        }
      }
      return json({
        modo: 'confirmacao_semanal',
        partida_id: partidaId,
        targets: targets.length,
        claimed,
      });
    }

    // MODO 2: Modo reforço automático (cron 1min)
    if (config?.reforco_ativo === false) {
      return json({ ok: true, skipped: true, motivo: 'reforco_ativo=false' }, 200);
    }

    // Busca o draft atual com maior ID e prazo NOT NULL
    const { data: draft, error: dErr } = await supabase
      .from('partidas')
      .select('id, data_jogo, confirmacao_closes_at, status')
      .eq('status', 'draft')
      .not('confirmacao_closes_at', 'is', null)
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (dErr) throw dErr;
    if (!draft || !draft.confirmacao_closes_at) {
      return json({ ok: true, targets: 0, motivo: 'sem draft ativo com prazo' }, 200);
    }

    const agora = Date.now();
    const prazoMs = new Date(draft.confirmacao_closes_at).getTime();
    const horasAntes = config?.reforco_horas_antes_prazo ?? 4;
    const janelaInicioMs = prazoMs - horasAntes * 3600 * 1000;

    // Está dentro da janela [prazo - horas, prazo)?
    if (agora < janelaInicioMs || agora >= prazoMs) {
      return json({ ok: true, targets: 0, motivo: 'fora da janela de reforco' }, 200);
    }

    const { dia, hora } = formatarDataJogo(draft.data_jogo);
    const prazo = formatarPrazo(draft.confirmacao_closes_at);
    const vars = { dia_jogo: dia, hora_jogo: hora, prazo };

    const tituloTemplate =
      config?.reforco_titulo?.trim() || 'Últimas horas para confirmar presença';
    const msgTemplate =
      config?.reforco_mensagem?.trim() ||
      'O prazo para confirmação encerra em {prazo}. Garanta sua vaga no racha!';

    const titulo = interpolar(tituloTemplate, vars);
    const mensagem = interpolar(msgTemplate, vars);

    const targets = await findTargets(draft.id);
    let claimed = 0;
    for (const target of targets) {
      if (await claim(target, 'reforco')) {
        claimed++;
        await sendNotification(target, titulo, mensagem, 'reforco');
      }
    }

    return json({
      modo: 'reforco_automatico',
      partida_id: draft.id,
      targets: targets.length,
      claimed,
    });
  } catch (error) {
    console.error(error);
    return json({ error: errorMessage(error) }, 500);
  }
});
