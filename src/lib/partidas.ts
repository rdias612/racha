import { supabase } from './supabase';
import type { TimeId, PosicaoId } from './times';

export type StatusPartida = 'draft' | 'live' | 'published' | 'closed';
export type StatusConfirmacao = 'pendente' | 'confirmado' | 'recusado';
export type TipoEvento = 'gol' | 'gol_contra';

export const STATUS_CONFIRMACAO_LABEL: Record<StatusConfirmacao, string> = {
  pendente: 'Pendente',
  confirmado: 'Confirmado',
  recusado: 'Não vai',
};

export const STATUS_LABEL: Record<StatusPartida, string> = {
  draft: 'Agendada',
  live: 'Em andamento',
  published: 'Votação aberta',
  closed: 'Encerrada',
};

export const STATUS_COR: Record<StatusPartida, string> = {
  draft: 'text-giz-fraco',
  live: 'text-destaque font-bold',
  published: 'text-destaque font-bold',
  closed: 'text-ok font-bold',
};

export interface Partida {
  id: number;
  data_jogo: string;
  status: StatusPartida;
  voting_closes_at: string | null;
  confirmacao_closes_at: string | null;
  criado_por: number;
}

export interface Placar {
  partida_id: number;
  gols_time_a: number;
  gols_time_b: number;
  vencedor: 'a' | 'b' | 'empate';
}

export interface Participante {
  partida_id: number;
  jogador_id: number;
  time: TimeId | null;
  posicao: PosicaoId;
  gols: number;
  assistencias: number;
  gols_contra: number;
  status_confirmacao: StatusConfirmacao;
  confirmado_em: string | null;
  // join com jogadores:
  username?: string;
}

export interface NotaPartida {
  partida_id: number;
  target_id: number;
  username: string;
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
    .from('partidas')
    .select('id, data_jogo, status, voting_closes_at, confirmacao_closes_at, criado_por')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as Partida | null;
}

export async function carregarPlacar(partidaId: number) {
  const { data, error } = await supabase
    .from('partida_placar')
    .select('partida_id, gols_time_a, gols_time_b, vencedor')
    .eq('partida_id', partidaId)
    .maybeSingle();
  if (error) throw error;
  return data as Placar | null;
}

interface ParticipanteJoinRow {
  partida_id: number;
  jogador_id: number;
  time: TimeId | null;
  posicao: PosicaoId | null;
  gols: number;
  assistencias: number;
  gols_contra: number;
  status_confirmacao: StatusConfirmacao;
  confirmado_em: string | null;
  jogadores: {
    username: string | null;
  } | null;
}

export async function carregarParticipantes(partidaId: number) {
  const { data, error } = await supabase
    .from('partidas_participantes')
    .select(
      'partida_id, jogador_id, time, posicao, gols, assistencias, gols_contra, status_confirmacao, confirmado_em, jogadores(username)'
    )
    .eq('partida_id', partidaId);
  if (error) throw error;
  // achata o join
  const rows = (data ?? []) as unknown as ParticipanteJoinRow[];
  return rows.map((p) => ({
    partida_id: p.partida_id,
    jogador_id: p.jogador_id,
    time: p.time,
    posicao: p.posicao,
    gols: p.gols,
    assistencias: p.assistencias,
    gols_contra: p.gols_contra,
    status_confirmacao: p.status_confirmacao,
    confirmado_em: p.confirmado_em,
    username: p.jogadores?.username,
  })) as Participante[];
}

export async function carregarNotas(partidaId: number) {
  const { data, error } = await supabase
    .from('partida_notas')
    .select('partida_id, target_id, username, avg_rating, vote_count, is_craque')
    .eq('partida_id', partidaId);
  if (error) throw error;
  return (data ?? []) as NotaPartida[];
}

export interface ParRacha {
  jogador_a_id: number;
  jogador_b_id: number;
  jogador_a_username: string;
  jogador_b_username: string;
  partidas: number;
  vitorias: number;
  empates: number;
  derrotas: number;
  pontos: number;
  percentual: number | null;
}

export async function carregarParesRacha(minPartidas: number = 5) {
  const { data, error } = await supabase.rpc('pares_racha', {
    p_min_partidas: minPartidas,
  });
  if (error) throw error;
  return (data ?? []) as ParRacha[];
}

export interface VotoEnviado {
  target_id: number;
  rating: number;
}

// Lê os votos já enviados pelo votante numa partida (para pré-popular a cédula
// em modo edição). A tabela `votes` referencia a partida por `partida_id`.
export async function carregarMeusVotos(partidaId: number, voterId: number) {
  const { data, error } = await supabase
    .from('votes')
    .select('target_id, rating')
    .eq('partida_id', partidaId)
    .eq('voter_id', voterId);
  if (error) throw error;
  return (data ?? []) as VotoEnviado[];
}

// Apaga TODOS os votos do jogador logado numa partida (descartar p/ refazer).
// Retorna true se o servidor aceitou (votacao aberta); false caso contrario.
export async function descartarVotos(partidaId: number, voterId: number) {
  const { data, error } = await supabase.rpc('descartar_votos', {
    p_partida_id: partidaId,
    p_voter_id: voterId,
  });
  if (error) throw error;
  return data as boolean;
}

export async function carregarEventos(partidaId: number) {
  const { data, error } = await supabase
    .from('partida_eventos')
    .select('id, partida_id, tipo, jogador_id, assistencia_jogador_id, created_at')
    .eq('partida_id', partidaId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as EventoPartida[];
}

export function placarDeEventos(
  eventos: EventoPartida[],
  participantes: Participante[]
): { gols_time_a: number; gols_time_b: number } {
  const timePorJogador = new Map(participantes.map((p) => [p.jogador_id, p.time]));
  let gols_time_a = 0;
  let gols_time_b = 0;
  for (const evento of eventos) {
    const time = timePorJogador.get(evento.jogador_id);
    if (!time) continue;
    const timeQueRecebe = evento.tipo === 'gol_contra' ? (time === 'a' ? 'b' : 'a') : time;
    if (timeQueRecebe === 'a') gols_time_a += 1;
    else gols_time_b += 1;
  }
  return { gols_time_a, gols_time_b };
}

export async function abrirPartida(partidaId: number, adminId?: number | null) {
  const { data, error } = await supabase.rpc('abrir_partida', {
    p_partida_id: partidaId,
    p_admin_id: adminId ?? null,
  });
  if (error) throw error;
  return data as boolean;
}

export async function registrarEvento(
  partidaId: number,
  tipo: TipoEvento,
  jogadorId: number,
  assistenciaJogadorId: number | null = null
) {
  const { data, error } = await supabase.rpc('registrar_evento', {
    p_partida_id: partidaId,
    p_tipo: tipo,
    p_jogador_id: jogadorId,
    p_assistencia_jogador_id: assistenciaJogadorId,
  });
  if (error) throw error;
  return data as number | null;
}

export async function removerEvento(eventoId: number) {
  const { data, error } = await supabase.rpc('remover_evento', {
    p_evento_id: eventoId,
  });
  if (error) throw error;
  return data as boolean;
}

export async function editarEvento(
  eventoId: number,
  tipo: TipoEvento,
  jogadorId: number,
  assistenciaJogadorId: number | null = null
) {
  const { data, error } = await supabase.rpc('editar_evento', {
    p_evento_id: eventoId,
    p_tipo: tipo,
    p_jogador_id: jogadorId,
    p_assistencia_jogador_id: assistenciaJogadorId,
  });
  if (error) throw error;
  return data as boolean;
}

export async function finalizarPartida(partidaId: number) {
  const { data, error } = await supabase.rpc('finalizar_partida', {
    p_partida_id: partidaId,
  });
  if (error) throw error;
  return data as boolean;
}

// Caminho legado de draft -> published (PartidaEditar). Abre votação 24h e gera avulsos.
export async function publicarPartida(partidaId: number) {
  const { data, error } = await supabase.rpc('publicar_partida', {
    p_partida_id: partidaId,
  });
  if (error) throw error;
  return data as boolean;
}

// --- Confirmação de presença ---

export const CAPACIDADE_PARTIDA = 14;

// Regra de capacidade (espelha o RPC confirmar_presenca):
// Apenas 'confirmado' ocupa vaga preenchida. 'pendente' e 'recusado' não ocupam vaga.
export function vagaOcupada(
  status: StatusConfirmacao,
  _closesAt?: string | null,
  _agora?: Date
): boolean {
  return status === 'confirmado';
}

export function vagasOcupadas(
  participantes: Participante[],
  _closesAt?: string | null,
  _agora?: Date
): number {
  return participantes.filter((p) => p.status_confirmacao === 'confirmado').length;
}

// O jogador pode ir para o status `alvo`? Espelha a regra server-side:
// Se o alvo for 'confirmado', permite se a quantidade de outros confirmados for menor que CAPACIDADE_PARTIDA (14).
// Transição para 'pendente' ou 'recusado' é sempre permitida.
export function podeConfirmar(
  participante: Participante,
  alvo: StatusConfirmacao,
  participantes: Participante[],
  _closesAt?: string | null,
  _agora?: Date
): boolean {
  if (alvo !== 'confirmado') return true;
  const outrosConfirmados = participantes.filter(
    (p) => p.jogador_id !== participante.jogador_id && p.status_confirmacao === 'confirmado'
  ).length;
  return outrosConfirmados < CAPACIDADE_PARTIDA;
}

// O próprio jogador confirma/desconfirma/recusa.
export async function confirmarPresenca(
  partidaId: number,
  jogadorId: number,
  status: StatusConfirmacao
) {
  const { data, error } = await supabase.rpc('confirmar_presenca', {
    p_partida_id: partidaId,
    p_jogador_id: jogadorId,
    p_status: status,
  });
  if (error) throw error;
  return data as boolean;
}

// Admin altera o status de qualquer jogador.
export async function adminDefinirConfirmacao(
  partidaId: number,
  jogadorId: number,
  status: StatusConfirmacao,
  adminId: number
) {
  const { data, error } = await supabase.rpc('admin_definir_confirmacao', {
    p_partida_id: partidaId,
    p_jogador_id: jogadorId,
    p_status: status,
    p_admin_id: adminId,
  });
  if (error) throw error;
  return data as boolean;
}

// Admin exclui a partida do histórico, independente do status.
// Remove também dívidas vinculadas (pagas e não pagas); participantes, votos,
// eventos e push reminders caem por CASCADE. Ver migration 066.
export async function excluirPartida(partidaId: number, adminId: number) {
  const { data, error } = await supabase.rpc('excluir_partida', {
    p_partida_id: partidaId,
    p_admin_id: adminId,
  });
  if (error) throw error;
  return data as boolean;
}

// Admin adiciona um avulso (preenche vaga liberada após o prazo).
export async function adicionarParticipante(partidaId: number, jogadorId: number) {
  const { data, error } = await supabase.rpc('adicionar_participante', {
    p_partida_id: partidaId,
    p_jogador_id: jogadorId,
  });
  if (error) throw error;
  return data as boolean;
}

// Remove participante de uma partida em draft.
export async function removerParticipanteDraft(partidaId: number, jogadorId: number) {
  const { error } = await supabase
    .from('partidas_participantes')
    .delete()
    .eq('partida_id', partidaId)
    .eq('jogador_id', jogadorId);
  if (error) throw error;
  return true;
}

export interface ParticipanteEdicao {
  partida_id: number;
  jogador_id: number;
  time: TimeId | null;
  posicao: PosicaoId;
  gols: number;
  assistencias: number;
  gols_contra: number;
  status_confirmacao: StatusConfirmacao;
  username?: string;
}

// Salva adições, remoções, trocas de time e estatísticas de participantes de forma transacional.
export async function salvarEdicaoCompletaPartida(
  partidaId: number,
  participantesNovos: ParticipanteEdicao[],
  _participantesOriginais?: Participante[],
  _statusPartida?: StatusPartida,
  primeiraVezPublicacao: boolean = false
) {
  const payload = participantesNovos.map((p) => ({
    jogador_id: p.jogador_id,
    time: p.time,
    posicao: p.posicao,
    gols: p.gols ?? 0,
    assistencias: p.assistencias ?? 0,
    gols_contra: p.gols_contra ?? 0,
    status_confirmacao: p.status_confirmacao ?? 'confirmado',
  }));

  const { data, error } = await supabase.rpc('salvar_edicao_partida', {
    p_partida_id: partidaId,
    p_participantes: payload,
    p_primeira_vez: primeiraVezPublicacao,
  });

  if (error) throw error;
  if (data === false) {
    throw new Error('Não foi possível salvar a edição da partida.');
  }

  return true;
}
