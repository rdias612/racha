import { supabase } from './supabase'
import type { TimeId, PosicaoId } from './times'

export type StatusPartida = 'draft' | 'published' | 'closed'

export interface Partida {
  id: number
  data_jogo: string
  status: StatusPartida
  voting_closes_at: string | null
  criado_por: number
}

export interface Placar {
  partida_id: number
  gols_time_a: number
  gols_time_b: number
  vencedor: 'a' | 'b' | 'empate'
}

export interface Participante {
  partida_id: number
  jogador_id: number
  time: TimeId
  posicao: PosicaoId
  gols: number
  assistencias: number
  gols_contra: number
  // join com jogadores:
  nome?: string
  username?: string
}

export interface NotaPartida {
  partida_id: number
  target_id: number
  nome: string
  avg_rating: number
  vote_count: number
  is_craque: boolean
}

export async function carregarPartida(id: number) {
  const { data, error } = await supabase
    .from('partidas')
    .select('id, data_jogo, status, voting_closes_at, criado_por')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data as Partida | null
}

export async function carregarPlacar(partidaId: number) {
  const { data, error } = await supabase
    .from('partida_placar')
    .select('partida_id, gols_time_a, gols_time_b, vencedor')
    .eq('partida_id', partidaId)
    .maybeSingle()
  if (error) throw error
  return data as Placar | null
}

export async function carregarParticipantes(partidaId: number) {
  const { data, error } = await supabase
    .from('partidas_participantes')
    .select(
      'partida_id, jogador_id, time, posicao, gols, assistencias, gols_contra, jogadores(nome, username)',
    )
    .eq('partida_id', partidaId)
  if (error) throw error
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
  })) as Participante[]
}

export async function carregarNotas(partidaId: number) {
  const { data, error } = await supabase
    .from('partida_notas')
    .select('partida_id, target_id, nome, avg_rating, vote_count, is_craque')
    .eq('partida_id', partidaId)
  if (error) throw error
  return (data ?? []) as NotaPartida[]
}
