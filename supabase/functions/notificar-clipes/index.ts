// Edge Function: notificar-clipes (Fase 5 — RF06/RF07, breakdown SDD 35).
//
// Chamada pela GitHub Action ao fim de cada importação (body único, sem modos):
//   { "partida_id": X, "resultado": "concluido" | "sem_clipes" | "falha" }
// - concluido   → push a CADA participante inscrito da partida (claim
//                 'clipes-prontos' — reexecução não reenvia).
// - sem_clipes  → push aos ADMINIS (claim 'clipes-sem-clipes').
// - falha       → push aos ADMINIS (claim 'clipes-falha').
// O desfecho já está no ledger clipes_importacoes (gravado pela Action nas
// Fases 2–4) — o painel da Fase 8 lê de lá (P2: aviso = push + ledger, ambos).
// data_jogo e contagem são lidos do BANCO (fonte da verdade), não do payload.

import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

// Bloco de segredos idêntico a send-confirmation-requests/index.ts:18-28
// (mesmas envs de projeto — nenhuma variável nova):
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

// Não é tempo-crítico (contrário do lembrete de confirmação, :39): o clipe
// continua lá. 3 dias cobre quem só abre o app no fim de semana.
const TTL_CLIPES_SEGUNDOS = 3 * 24 * 60 * 60;

type SubscriptionData = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

type Destinatario = {
  jogador_id: number;
  subscriptions: SubscriptionData[];
};

type Resultado = 'concluido' | 'sem_clipes' | 'falha';

type ReminderKeyClipes = 'clipes-prontos' | 'clipes-sem-clipes' | 'clipes-falha';

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

function formatarDataJogo(dataStr: string): string {
  try {
    const d = new Date(dataStr);
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(d);
  } catch {
    return 'quinta-feira';
  }
}

// Idempotência no ledger de entregas — idêntico a
// send-confirmation-requests:144-156 (claim + 23505), com o reminderKey
// vindo do resultado:
async function claim(
  partidaId: number,
  jogadorId: number,
  reminderKey: ReminderKeyClipes
): Promise<boolean> {
  const { data, error } = await supabase
    .from('push_reminder_deliveries')
    .insert({
      partida_id: partidaId,
      jogador_id: jogadorId,
      reminder_key: reminderKey,
    })
    .select('partida_id')
    .maybeSingle();
  if (error && error.code !== '23505') throw error;
  return Boolean(data);
}

// Idêntico a send-confirmation-requests:158-201, sem templates de config:
async function enviarPara(
  destinatarios: Destinatario[],
  payload: { title: string; body: string; url: string; partida_id: number; tag: string },
  reminderKey: ReminderKeyClipes
) {
  const corpo = JSON.stringify(payload);

  for (const destinatario of destinatarios) {
    let lastError: string | null = null;
    for (const subscription of destinatario.subscriptions) {
      const pushSubscription = {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      };
      try {
        await webpush.sendNotification(pushSubscription, corpo, {
          TTL: TTL_CLIPES_SEGUNDOS,
          urgency: 'normal',
        });
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('endpoint', subscription.endpoint);
        }
      }
    }

    await supabase
      .from('push_reminder_deliveries')
      .update({ sent_at: new Date().toISOString(), error_message: lastError })
      .eq('partida_id', payload.partida_id)
      .eq('jogador_id', destinatario.jogador_id)
      .eq('reminder_key', reminderKey);
  }
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (request.headers.get('x-push-cron-secret') !== cronSecret) {
    return json({ error: 'Unauthorized' }, 401);
  }

  let bodyData: { partida_id?: unknown; resultado?: unknown } = {};
  try {
    bodyData = await request.json().catch(() => ({}));
  } catch {
    /* body vazio */
  }

  // Validação do payload (único modo — sem os 3 modos da irmã):
  const rawId = bodyData.partida_id;
  const partidaId =
    typeof rawId === 'number' ? rawId
    : typeof rawId === 'string' && rawId.trim() !== '' ? Number(rawId) : null;
  const resultado = bodyData.resultado;
  const resultadosValidos: Resultado[] = ['concluido', 'sem_clipes', 'falha'];
  if (
    partidaId === null || !Number.isInteger(partidaId) || partidaId <= 0 ||
    typeof resultado !== 'string' || !resultadosValidos.includes(resultado as Resultado)
  ) {
    return json({ error: 'Payload inválido: partida_id e resultado são obrigatórios' }, 400);
  }

  try {
    // Partida + contagem do BANCO (fonte da verdade — o payload não traz contagem):
    const { data: partida, error: pErr } = await supabase
      .from('partidas')
      .select('id, data_jogo')
      .eq('id', partidaId)
      .maybeSingle();
    if (pErr) throw pErr;
    if (!partida) {
      return json({ error: 'Partida não encontrada' }, 400);
    }

    const dia = formatarDataJogo(String(partida.data_jogo));
    const reminderKey: ReminderKeyClipes =
      resultado === 'concluido' ? 'clipes-prontos'
      : resultado === 'sem_clipes' ? 'clipes-sem-clipes'
      : 'clipes-falha';

    let titulo: string;
    let mensagem: string;
    if (resultado === 'concluido') {
      const { count, error: cErr } = await supabase
        .from('clipes')
        .select('caminho', { count: 'exact', head: true })
        .eq('partida_id', partidaId);
      if (cErr) throw cErr;
      const quantidade = count ?? 0;
      titulo = '⚽ Clipes da partida disponíveis';
      mensagem =
        quantidade > 0
          ? `Os ${quantidade} clipes da partida de ${dia} já estão no app.`
          : `Os clipes da partida de ${dia} já estão no app.`;
    } else {
      titulo = '⚠️ Falha na importação de clipes';
      mensagem =
        resultado === 'sem_clipes'
          ? `A importação da partida de ${dia} concluiu sem encontrar clipes no Filma Eu.`
          : `A importação de clipes da partida de ${dia} falhou. Veja o detalhe no painel e reexecute.`;
    }

    const ehParaParticipantes = resultado === 'concluido';
    const { data: destinatarios, error: dErr } = await supabase.rpc(
      'listar_destinatarios_clipes',
      { p_partida_id: partidaId, p_apenas_admins: !ehParaParticipantes }
    );
    if (dErr) throw dErr;

    const alvos = (destinatarios ?? []).map(
      (row: { jogador_id: number | string; subscriptions: SubscriptionData[] }) => ({
        jogador_id: Number(row.jogador_id),
        subscriptions: Array.isArray(row.subscriptions) ? row.subscriptions : [],
      })
    );

    const payload = {
      title: titulo,
      body: mensagem,
      url: `/partida/${partidaId}`, // mesma rota da irmã, :168
      partida_id: partidaId,
      tag: `clipes-${partidaId}`, // substitui pushes antigos da mesma partida
    };

    // claim → envio na mesma ordem do loop confirmacao_semanal (:317-322):
    let claimed = 0;
    const claimedIds: number[] = [];
    for (const alvo of alvos) {
      if (await claim(partidaId, alvo.jogador_id, reminderKey)) {
        claimed++;
        claimedIds.push(alvo.jogador_id);
      }
    }
    if (claimed > 0) {
      await enviarPara(
        alvos.filter((alvo) => claimedIds.includes(alvo.jogador_id)),
        payload,
        reminderKey
      );
    }

    return json({
      modo: 'clipes',
      partida_id: partidaId,
      resultado,
      targets: alvos.length,
      claimed,
    });
  } catch (error) {
    console.error(error);
    return json({ error: errorMessage(error) }, 500);
  }
});
