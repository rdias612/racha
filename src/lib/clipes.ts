// Camada de serviço dos clipes do Filma Eu (RF04/RF05 — breakdown SDD 35, Fase 7).
// Padrão das demais libs (partidas.ts): função exportada, supabase.from(),
// throw de erro, retorno tipado. A escrita em `clipes` é exclusiva da Action
// (service key) — aqui só há leitura (grants da Fase 1, fase-1-tasks.md:88).

import { supabase } from './supabase';
import type { Database } from './database.types';

/** Campos de `clipes` usados na UI (types gerados pela Fase 1 — database.types.ts). */
export type Clipe = Pick<
  Database['public']['Tables']['clipes']['Row'],
  'id' | 'caminho' | 'ordem' | 'size_bytes'
>;

/** Clipe pronto para render: linha da tabela + URL pública do vídeo (P4, bucket público). */
export interface ClipeComUrl extends Clipe {
  url: string;
}

/**
 * URL pública de download/streaming do clipe (P4). `getPublicUrl` do SDK produz
 * exatamente `${SUPABASE_URL}/storage/v1/object/public/clipes/${caminho}` — o
 * padrão registrado na Fase 3 (fase-3-tasks.md:308-313) sem re-ler a env var
 * (src/lib/supabase.ts não exporta a URL).
 */
export function urlPublicaDoClipe(caminho: string): string {
  return supabase.storage.from('clipes').getPublicUrl(caminho).data.publicUrl;
}

/** Clipes da partida, na ordem do slot (ordem 1-based da Fase 3; null por último). */
export async function carregarClipesDaPartida(partidaId: number): Promise<ClipeComUrl[]> {
  const { data, error } = await supabase
    .from('clipes')
    .select('id, caminho, ordem, size_bytes')
    .eq('partida_id', partidaId)
    .order('ordem', { ascending: true, nullsFirst: false })
    .order('id', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({ ...row, url: urlPublicaDoClipe(row.caminho) }));
}

/** Última partida com clipes segundo P7: status IN ('published','closed'). */
export interface UltimaPartidaComClipes {
  partidaId: number;
  dataJogo: string;
  totalClipes: number;
}

/**
 * A partida mais recente publicada/encerrada (P7) que tenha clipes — alimenta o
 * link do Resumo (RF05, P9). Join com `partidas!inner` filtra o status em 1
 * round-trip; `data_jogo` denormalizada em `clipes` (Fase 1) ordena sem join extra.
 * null = nenhuma partida com clipes (card some).
 */
export async function obterUltimaPartidaComClipes(): Promise<UltimaPartidaComClipes | null> {
  const { data, error } = await supabase
    .from('clipes')
    .select('partida_id, data_jogo, partidas!inner(status)')
    .in('partidas.status', ['published', 'closed'])
    .order('data_jogo', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  // Contagem da partida achada (head count: sem transferir linhas).
  const { count, error: erroContagem } = await supabase
    .from('clipes')
    .select('id', { count: 'exact', head: true })
    .eq('partida_id', data.partida_id);
  if (erroContagem) throw erroContagem;

  return { partidaId: data.partida_id, dataJogo: data.data_jogo, totalClipes: count ?? 0 };
}

/** Linha do ledger `clipes_importacoes` (Fase 1, fase-1-tasks.md:65-83) para o painel admin. */
export interface ImportacaoClipes {
  id: number;
  partida_id: number | null;
  data_referencia: string; // date do Postgres → 'YYYY-MM-DD'
  origem: 'automatico' | 'manual';
  status: 'iniciado' | 'concluido' | 'sem_clipes' | 'falha' | 'limpeza';
  sucesso: boolean;
  quantidade_clipes: number | null;
  bytes_total: number | null;
  detalhe: string | null;
  erro: string | null;
  criado_em: string;
  atualizado_em: string;
}

/** RF03: dispara a importação de uma data específica (AAAA-MM-DD; RPC da Fase 6
 *  rejeita data futura e fixa o horário 19:00 — nada disso é decisão da UI). */
export async function dispararImportacaoClipes(adminId: number, data: string): Promise<void> {
  const { error } = await supabase.rpc('disparar_importacao_clipes', {
    p_admin_id: adminId,
    p_data: data,
  });
  if (error) throw error;
}

/** RF08: histórico de importações e limpezas, mais recente primeiro. */
export async function obterImportacoesClipes(
  adminId: number,
  limite = 50
): Promise<ImportacaoClipes[]> {
  const { data, error } = await supabase.rpc('obter_importacoes_clipes', {
    p_admin_id: adminId,
    p_limite: limite,
  });
  if (error) throw error;
  // Cast de narrowing intencional: RETURNS TABLE gera colunas imprecisas no gerado
  // (padrão obterPainelEntregasPush, notificacoes.ts:149-151).
  return (data ?? []) as unknown as ImportacaoClipes[];
}

/** RF07: falhas ('falha' + 'sem_clipes') da janela de horas (default 48h). */
export async function obterFalhasRecentesClipes(
  adminId: number,
  horas = 48
): Promise<ImportacaoClipes[]> {
  const { data, error } = await supabase.rpc('obter_falhas_recentes_clipes', {
    p_admin_id: adminId,
    p_horas: horas,
  });
  if (error) throw error;
  return (data ?? []) as unknown as ImportacaoClipes[];
}
