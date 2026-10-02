// Camada de serviço dos clipes do Filma Eu (RF04/RF05 — breakdown SDD 35, Fase 7).
// Padrão das demais libs (partidas.ts): função exportada, supabase.from(),
// throw de erro, retorno tipado. A escrita em `clipes` é exclusiva da Action
// (service key) — aqui só há leitura (grants da Fase 1, fase-1-tasks.md:88).

import { supabase } from './supabase';
import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from '@supabase/supabase-js';
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

/** Partida que tem clipes, para o seletor da aba Repositório (Plano 36, Passo 3). */
export interface PartidaComClipes {
  partidaId: number;
  dataJogo: string;
  status: string;
}

/**
 * Partidas que possuem ao menos um clipe, mais recente primeiro — alimenta o
 * seletor da aba Repositório (Passo 3). Diferente de obterUltimaPartidaComClipes,
 * SEM filtro de status: painel de admin enxerga tudo — se a partida tem clipe,
 * aparece (as cláusulas de status das demais funções servem à visão do jogador).
 * `status` vem de partidas por ser o único campo dela útil ao label (não há
 * adversário/nome em partidas; a data já é denormalizada em `clipes`).
 */
export async function obterPartidasComClipes(): Promise<PartidaComClipes[]> {
  // Tabela pequena: busca tudo e deduplica por partida_id em JS (mesma
  // justificativa KISS de retencao.mjs:34-37 — sem RPC de agregação).
  const { data, error } = await supabase
    .from('clipes')
    .select('partida_id, data_jogo, partidas!inner(status)')
    .order('data_jogo', { ascending: false })
    .order('partida_id', { ascending: false });
  if (error) throw error;

  // Primeira ocorrência de cada partida_id já é a mais recente (ordem acima).
  const vistas = new Set<number>();
  const partidas: PartidaComClipes[] = [];
  for (const row of data ?? []) {
    if (vistas.has(row.partida_id)) continue;
    vistas.add(row.partida_id);
    partidas.push({
      partidaId: row.partida_id,
      dataJogo: row.data_jogo,
      status: row.partidas.status,
    });
  }
  return partidas;
}

/** Corpo de sucesso da edge function admin-excluir-clipes (Plano 36, Passo 1). */
export interface ResultadoExclusaoClipes {
  excluidos: number;
  bytes_liberados: number;
}

/**
 * Exclusão MANUAL de clipes selecionados (linhas + objetos do bucket + ledger)
 * a pedido de um admin, via edge function admin-excluir-clipes (Passo 1 do
 * Plano 36). Primeira chamada client-side de Edge Function do app: deploy com
 * --no-verify-jwt (o app não usa JWT do Supabase; o gate de admin é o admin_id
 * do corpo, validado server-side).
 */
export async function excluirClipes(
  adminId: number,
  ids: number[]
): Promise<ResultadoExclusaoClipes> {
  const { data, error } = await supabase.functions.invoke<ResultadoExclusaoClipes>(
    'admin-excluir-clipes',
    { body: { admin_id: adminId, clipes_ids: ids } }
  );

  if (error) {
    // Não-2xx: o SDK devolve FunctionsHttpError cujo `context` é a Response —
    // extrair o `erro` do body para o snackbar mostrar a mensagem real da
    // função (ex.: 'Acesso restrito a administradores.') em vez do texto
    // genérico do SDK ('Edge Function returned a non-2xx status code').
    if (error instanceof FunctionsHttpError) {
      let mensagem = 'Não foi possível excluir os clipes. Tente novamente.';
      try {
        const body = (await error.context.json()) as { erro?: unknown };
        if (typeof body.erro === 'string' && body.erro.trim() !== '') {
          mensagem = body.erro;
        }
      } catch {
        /* body não-JSON (ex.: resposta de gateway) — mantém a mensagem genérica */
      }
      throw new Error(mensagem);
    }
    // Falha de rede/relay (FunctionsFetchError/FunctionsRelayError — sem resposta HTTP):
    // a mensagem do SDK é técnica em inglês e formatarMensagemErro NÃO a traduz
    // (erros.ts:21-23 não casa) — lança pt-BR direto para o snackbar no caso offline.
    if (error instanceof FunctionsFetchError || error instanceof FunctionsRelayError) {
      throw new Error(
        'Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.'
      );
    }
    // Demais falhas: segue o padrão do arquivo (throw cru para formatarMensagemErro).
    throw error;
  }

  // Cast documentado (padrão dos casts de RPC acima): redundante via genérico, mas explícito pós-guarda.
  return data as ResultadoExclusaoClipes;
}
