import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("PUSH_SUPABASE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const cronSecret = Deno.env.get("PUSH_CRON_SECRET");
const vapidSubject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com";
const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");

if (!supabaseUrl || !serviceRoleKey || !cronSecret || !vapidPublicKey || !vapidPrivateKey) {
  throw new Error("Missing notification function secrets.");
}

webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

// 4 buckets fixos: últimos 6h, 3h, 1h e 30min antes de fechar a votação.
// Cada bucket tem janela de 10 min para ser capturado pelo cron (1 min).
const reminders = [
  { key: "6h", offsetMs: 6 * 60 * 60 * 1000, label: "6 horas" },
  { key: "3h", offsetMs: 3 * 60 * 60 * 1000, label: "3 horas" },
  { key: "1h", offsetMs: 60 * 60 * 1000, label: "1 hora" },
  { key: "30m", offsetMs: 30 * 60 * 1000, label: "30 minutos" },
] as const;

const reminderWindowMs = 10 * 60 * 1000;

type Candidate = {
  partida_id: number;
  jogador_id: number;
  voting_closes_at: string;
  reminder_key: (typeof reminders)[number]["key"];
  label: string;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null) return JSON.stringify(error);
  return String(error);
}

async function findCandidates(): Promise<Candidate[]> {
  const now = Date.now();
  // Partidas publicadas cuja votação ainda está aberta e dentro dos próximos 6h
  // (janela máxima coberta pelos buckets 6h/3h/1h/30m).
  const { data: partidas, error } = await supabase
    .from("partidas")
    .select("id, voting_closes_at")
    .eq("status", "published")
    .gt("voting_closes_at", new Date(now).toISOString())
    .lte(
      "voting_closes_at",
      new Date(now + 6 * 60 * 60 * 1000 + reminderWindowMs).toISOString(),
    );

  if (error) throw error;

  const candidates: Candidate[] = [];
  for (const partida of partidas ?? []) {
    const remaining = new Date(partida.voting_closes_at).getTime() - now;
    const reminder = reminders.find(
      (item) => remaining <= item.offsetMs && remaining > item.offsetMs - reminderWindowMs,
    );
    if (!reminder) continue;

    const { data: participants, error: participantsError } = await supabase
      .from("partidas_participantes")
      .select("jogador_id")
      .eq("partida_id", partida.id);
    if (participantsError) throw participantsError;

    const participantIds = (participants ?? []).map((item) => item.jogador_id);
    if (participantIds.length === 0) continue;

    const { data: activePlayers, error: playersError } = await supabase
      .from("jogadores")
      .select("id")
      .in("id", participantIds)
      .eq("is_ativo", true);
    if (playersError) throw playersError;

    const { data: votes, error: votesError } = await supabase
      .from("votes")
      .select("voter_id")
      .eq("partida_id", partida.id)
      .in("voter_id", (activePlayers ?? []).map((player) => player.id));
    if (votesError) throw votesError;

    // Só notifica quem (a) ainda não votou, (b) tem inscrição push ativa.
    const votedIds = new Set((votes ?? []).map((vote) => vote.voter_id));
    const pendingPlayerIds = (activePlayers ?? [])
      .filter((player) => !votedIds.has(player.id))
      .map((player) => player.id);
    if (pendingPlayerIds.length === 0) continue;

    const { data: subscribed, error: subError } = await supabase
      .from("push_subscriptions")
      .select("jogador_id")
      .in("jogador_id", pendingPlayerIds);
    if (subError) throw subError;

    const subscribedIds = new Set((subscribed ?? []).map((s) => s.jogador_id));
    for (const playerId of pendingPlayerIds) {
      if (subscribedIds.has(playerId)) {
        candidates.push({
          partida_id: partida.id,
          jogador_id: playerId,
          voting_closes_at: partida.voting_closes_at,
          reminder_key: reminder.key,
          label: reminder.label,
        });
      }
    }
  }
  return candidates;
}

async function claim(candidate: Candidate) {
  const { data, error } = await supabase
    .from("push_reminder_deliveries")
    .insert({
      partida_id: candidate.partida_id,
      jogador_id: candidate.jogador_id,
      reminder_key: candidate.reminder_key,
    })
    .select("partida_id")
    .maybeSingle();
  if (error && error.code !== "23505") throw error;
  return Boolean(data);
}

const notificationTemplates: Record<
  (typeof reminders)[number]["key"],
  { title: string; body: string }
> = {
  "6h": {
    title: "Faltam 6 horas para fechar a votação!",
    body: "Avalie a partida de ontem e deixe suas notas para o ranking.",
  },
  "3h": {
    title: "Vote, ou então não reclama depois que a divisão tá ruim!",
    body: "Faltam apenas 3 horas para fechar a súmula da partida de ontem.",
  },
  "1h": {
    title: "Os analfabetos da bola já votaram, e você?",
    body: "Acesse a partida de ontem antes que o tempo de votação esgote.",
  },
  "30m": {
    title: "Ainda não votou, vai deixar Tchuca avacalhar as notas!?",
    body: "Últimos 30 minutos para registrar seu voto na partida de ontem!",
  },
};

async function send(candidate: Candidate) {
  const { data: subscriptions, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("jogador_id", candidate.jogador_id);
  if (error) throw error;

  const template = notificationTemplates[candidate.reminder_key];
  const payload = JSON.stringify({
    title: template.title,
    body: template.body,
    url: `/partida/${candidate.partida_id}/votar`,
    partida_id: candidate.partida_id,
    tag: `votar-partida-${candidate.partida_id}`,
  });
  let lastError: string | null = null;

  for (const subscription of subscriptions ?? []) {
    // web-push espera o formato { endpoint, keys: { p256dh, auth } }.
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
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("endpoint", subscription.endpoint);
      }
    }
  }

  await supabase
    .from("push_reminder_deliveries")
    .update({ sent_at: new Date().toISOString(), error_message: lastError })
    .eq("partida_id", candidate.partida_id)
    .eq("jogador_id", candidate.jogador_id)
    .eq("reminder_key", candidate.reminder_key);
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (request.headers.get("x-push-cron-secret") !== cronSecret) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    const candidates = await findCandidates();
    let claimed = 0;
    for (const candidate of candidates) {
      if (await claim(candidate)) {
        claimed++;
        await send(candidate);
      }
    }
    return json({ candidates: candidates.length, claimed });
  } catch (error) {
    console.error(error);
    return json({ error: errorMessage(error) }, 500);
  }
});