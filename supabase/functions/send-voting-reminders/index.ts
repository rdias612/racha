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

// Janela total de votação (precisa bater com o set em `publish`).
const VOTING_WINDOW_MS = 24 * 60 * 60 * 1000;

// Tolerância para considerar o slot atual mesmo com atraso do cron.
const SLOT_TOLERANCE_MS = 90 * 1000;

type Candidate = {
  partida_id: number;
  jogador_id: number;
  voting_closes_at: string;
  reminder_key: string;
  remaining_label: string;
};

// Calcula qual slot de 15 min (HH:MM UTC) corresponde ao minuto atual.
// Retorna null se não estiver em um dos minutos 0/15/30/45.
function slotAtual(now = new Date()): string | null {
  const m = now.getUTCMinutes();
  const slot = [0, 15, 30, 45].find((s) => Math.abs(m - s) <= 1);
  if (slot === undefined) return null;
  const hh = String(now.getUTCHours()).padStart(2, "0");
  const mm = String(slot).padStart(2, "0");
  return `${hh}:${mm}`;
}

// Descrição legível de quanto falta para fechar a votação.
function rotuloTempoRestante(remainingMs: number): string {
  const totalMin = Math.max(1, Math.round(remainingMs / (60 * 1000)));
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hours >= 1 && mins > 0) return `${hours}h${String(mins).padStart(2, "0")}`;
  if (hours >= 1) return `${hours}h`;
  return `${mins}min`;
}

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
  const reminderKey = slotAtual();
  // Fora dos minutos 0/15/30/45 não há o que fazer (chamada manual fora do cron).
  if (!reminderKey) return [];

  // Partidas publicadas cuja votação ainda está aberta (janela de 24h).
  const { data: partidas, error } = await supabase
    .from("partidas")
    .select("id, voting_closes_at")
    .eq("status", "published")
    .gt("voting_closes_at", new Date(now - SLOT_TOLERANCE_MS).toISOString())
    .lte(
      "voting_closes_at",
      new Date(now + VOTING_WINDOW_MS).toISOString(),
    );

  if (error) throw error;

  const candidates: Candidate[] = [];
  for (const partida of partidas ?? []) {
    const remaining = new Date(partida.voting_closes_at).getTime() - now;
    if (remaining <= 0) continue; // votação acabou neste tick

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

    const remainingLabel = rotuloTempoRestante(remaining);
    const subscribedIds = new Set((subscribed ?? []).map((s) => s.jogador_id));
    for (const playerId of pendingPlayerIds) {
      if (subscribedIds.has(playerId)) {
        candidates.push({
          partida_id: partida.id,
          jogador_id: playerId,
          voting_closes_at: partida.voting_closes_at,
          reminder_key: reminderKey,
          remaining_label: remainingLabel,
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

async function send(candidate: Candidate) {
  const { data: subscriptions, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("jogador_id", candidate.jogador_id);
  if (error) throw error;

  const payload = JSON.stringify({
    title: "Votação pendente",
    body: `Faltam ${candidate.remaining_label} para avaliar a partida #${candidate.partida_id}.`,
    url: `/partida/${candidate.partida_id}/votar`,
  });
  let lastError: string | null = null;

  for (const subscription of subscriptions ?? []) {
    try {
      await webpush.sendNotification(subscription, payload);
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
    return json({
      slot: slotAtual(),
      candidates: candidates.length,
      claimed,
    });
  } catch (error) {
    console.error(error);
    return json({ error: errorMessage(error) }, 500);
  }
});