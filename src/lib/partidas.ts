import { supabase } from "./supabase";
import type { TimeId, PosicaoId } from "./times";

export type StatusPartida = "draft" | "live" | "published" | "closed";
export type TipoEvento = "gol" | "gol_contra";

export const STATUS_LABEL: Record<StatusPartida, string> = {
  draft: "Agendada",
  live: "Em andamento",
  published: "Votação aberta",
  closed: "Encerrada",
};

export const STATUS_COR: Record<StatusPartida, string> = {
  draft: "text-neutral-500",
  live: "text-amber-600 dark:text-amber-400",
  published: "text-[var(--cor-destaque)]",
  closed: "text-green-600 dark:text-green-400",
};

export interface Partida {
  id: number;
  data_jogo: string;
  status: StatusPartida;
  voting_closes_at: string | null;
  criado_por: number;
}

export interface Placar {
  partida_id: number;
  gols_time_a: number;
  gols_time_b: number;
  vencedor: "a" | "b" | "empate";
}

export interface Participante {
  partida_id: number;
  jogador_id: number;
  time: TimeId;
  posicao: PosicaoId;
  gols: number;
  assistencias: number;
  gols_contra: number;
  // join com jogadores:
  nome?: string;
  username?: string;
}

export interface NotaPartida {
  partida_id: number;
  target_id: number;
  nome: string;
  avg_rating: number;
  vote_count: number;
  is_craque: boolean;
}

export interface EventoPartida {
  id: number;
  partida_id: number;
  tipo: TipoEvento;
  jogador_id: number;
  assistencia_jogador_id: number | null;
  created_at: string;
}

export async function carregarPartida(id: number) {
  const { data, error } = await supabase
    .from("partidas")
    .select("id, data_jogo, status, voting_closes_at, criado_por")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as Partida | null;
}

export async function carregarPlacar(partidaId: number) {
  const { data, error } = await supabase
    .from("partida_placar")
    .select("partida_id, gols_time_a, gols_time_b, vencedor")
    .eq("partida_id", partidaId)
    .maybeSingle();
  if (error) throw error;
  return data as Placar | null;
}

export async function carregarParticipantes(partidaId: number) {
  const { data, error } = await supabase
    .from("partidas_participantes")
    .select(
      "partida_id, jogador_id, time, posicao, gols, assistencias, gols_contra, jogadores(nome, username)",
    )
    .eq("partida_id", partidaId);
  if (error) throw error;
  // achata o join
  return (data ?? []).map((p: any) => ({
    partida_id: p.partida_id,
    jogador_id: p.jogador_id,
    time: p.time,
    posicao: p.posicao,
    gols: p.gols,
    assistencias: p.assistencias,
    gols_contra: p.gols_contra,
    nome: p.jogadores?.nome,
    username: p.jogadores?.username,
  })) as Participante[];
}

export async function carregarNotas(partidaId: number) {
  const { data, error } = await supabase
    .from("partida_notas")
    .select("partida_id, target_id, nome, avg_rating, vote_count, is_craque")
    .eq("partida_id", partidaId);
  if (error) throw error;
  return (data ?? []) as NotaPartida[];
}

export interface ParRacha {
  jogador_a_id: number;
  jogador_b_id: number;
  jogador_a_nome: string;
  jogador_b_nome: string;
  partidas: number;
  vitorias: number;
  empates: number;
  derrotas: number;
  pontos: number;
  percentual: number | null;
}

export async function carregarParesRacha(minPartidas: number = 5) {
  const { data, error } = await supabase.rpc("pares_racha", {
    p_min_partidas: minPartidas,
  });
  if (error) throw error;
  return (data ?? []) as ParRacha[];
}

// Apaga TODOS os votos do jogador logado numa partida (descartar p/ refazer).
// Retorna true se o servidor aceitou (votacao aberta); false caso contrario.
export async function descartarVotos(partidaId: number, voterId: number) {
  const { data, error } = await supabase.rpc("descartar_votos", {
    p_partida_id: partidaId,
    p_voter_id: voterId,
  });
  if (error) throw error;
  return data as boolean;
}

export async function carregarEventos(partidaId: number) {
  const { data, error } = await supabase
    .from("partida_eventos")
    .select(
      "id, partida_id, tipo, jogador_id, assistencia_jogador_id, created_at",
    )
    .eq("partida_id", partidaId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as EventoPartida[];
}

export function placarDeEventos(
  eventos: EventoPartida[],
  participantes: Participante[],
): { gols_time_a: number; gols_time_b: number } {
  const timePorJogador = new Map(
    participantes.map((p) => [p.jogador_id, p.time]),
  );
  let gols_time_a = 0;
  let gols_time_b = 0;
  for (const evento of eventos) {
    const time = timePorJogador.get(evento.jogador_id);
    if (!time) continue;
    const somaNoAdversario = evento.tipo === "gol_contra";
    const timeQueRecebe =
      somaNoAdversario ? (time === "a" ? "b" : "a") : time;
    if (timeQueRecebe === "a") gols_time_a += 1;
    else gols_time_b += 1;
  }
  return { gols_time_a, gols_time_b };
}

export async function abrirPartida(partidaId: number) {
  const { data, error } = await supabase.rpc("abrir_partida", {
    p_partida_id: partidaId,
  });
  if (error) throw error;
  return data as boolean;
}

export async function registrarEvento(
  partidaId: number,
  tipo: TipoEvento,
  jogadorId: number,
  assistenciaJogadorId: number | null = null,
) {
  const { data, error } = await supabase.rpc("registrar_evento", {
    p_partida_id: partidaId,
    p_tipo: tipo,
    p_jogador_id: jogadorId,
    p_assistencia_jogador_id: assistenciaJogadorId,
  });
  if (error) throw error;
  return data as number | null;
}

export async function removerEvento(eventoId: number) {
  const { data, error } = await supabase.rpc("remover_evento", {
    p_evento_id: eventoId,
  });
  if (error) throw error;
  return data as boolean;
}

export async function editarEvento(
  eventoId: number,
  tipo: TipoEvento,
  jogadorId: number,
  assistenciaJogadorId: number | null = null,
) {
  const { data, error } = await supabase.rpc("editar_evento", {
    p_evento_id: eventoId,
    p_tipo: tipo,
    p_jogador_id: jogadorId,
    p_assistencia_jogador_id: assistenciaJogadorId,
  });
  if (error) throw error;
  return data as boolean;
}

export async function finalizarPartida(partidaId: number) {
  const { data, error } = await supabase.rpc("finalizar_partida", {
    p_partida_id: partidaId,
  });
  if (error) throw error;
  return data as boolean;
}
