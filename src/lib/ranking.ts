import { supabase } from './supabase';
import type { PosicaoId } from './times';

/** Linha da view `ranking`. */
export interface LinhaRanking {
  jogador_id: number;
  username: string;
  posicao: PosicaoId;
  pontos: number;
  vitorias: number;
  empates: number;
  derrotas: number;
  partidas: number;
  gols: number;
  assistencias: number;
  gols_contra: number;
}

/** Ranking da temporada pela view `ranking`, filtrado por posição. */
export async function carregarRanking(filtro: PosicaoId | 'todas'): Promise<LinhaRanking[]> {
  let query = supabase
    .from('ranking')
    .select(
      'jogador_id, username, posicao, pontos, vitorias, empates, derrotas, partidas, gols, assistencias, gols_contra'
    )
    .order('pontos', { ascending: false })
    .order('vitorias', { ascending: false })
    .order('partidas', { ascending: false })
    .order('gols', { ascending: false })
    .order('assistencias', { ascending: false })
    .order('username', { ascending: true });

  if (filtro !== 'todas') {
    query = query.eq('posicao', filtro);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? [])
    .filter((r) => r.jogador_id != null && r.username != null)
    .map((r) => ({
      jogador_id: r.jogador_id!,
      username: r.username!,
      posicao: (r.posicao as PosicaoId) ?? 'random',
      pontos: r.pontos ?? 0,
      vitorias: r.vitorias ?? 0,
      empates: r.empates ?? 0,
      derrotas: r.derrotas ?? 0,
      partidas: r.partidas ?? 0,
      gols: r.gols ?? 0,
      assistencias: r.assistencias ?? 0,
      gols_contra: r.gols_contra ?? 0,
    }));
}
