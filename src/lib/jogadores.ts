import { supabase } from './supabase';
import type { PosicaoId } from './times';

// Detecta jogadores "random" (placeholders): username com prefixo 'random'
// e sufixo opcional de dígitos (casa 'random', 'random1'...'random6', 'random99').
// Case-insensitive para equivaler ao .toLowerCase().startsWith("random").
export function isRandomUsername(username?: string | null): boolean {
  return !!username && /^random\d*$/i.test(username.trim());
}

export function validarFormatoUsername(username: string): string | null {
  // Aceita letras (com acentos: ç, ã, é...), números e sublinhado.
  // Maiúsculas e minúsculas são preservadas.
  const limpo = username.trim();
  if (limpo.length < 2) return 'O usuário deve ter ao menos 2 caracteres.';
  if (limpo.length > 30) return 'O usuário deve ter no máximo 30 caracteres.';
  if (!/^[a-zA-ZÀ-ÖØ-öø-ÿ_]+$/.test(limpo)) {
    return 'Use apenas letras, números e sublinhado (_).';
  }
  if (isRandomUsername(limpo)) {
    return 'O prefixo "random" é reservado para convidados temporários.';
  }
  return null;
}

export interface JogadorLista {
  id: number;
  username: string;
  posicao: PosicaoId;
  is_admin: boolean;
  is_ativo: boolean;
  is_mensalista: boolean;
  posicao_b: PosicaoId | null;
  chave_pix?: string | null;
  telefone?: string | null;
  media_nota?: number;
  partidas_ultimos_2_meses?: number;
}

export const COLUNAS_JOGADOR_LISTA =
  'id, username, posicao, is_admin, is_ativo, is_mensalista, posicao_b, chave_pix, telefone';

export const SUPERADMINS = ['dico', 'tadeu', 'natal'];
export const MAX_MENSALISTAS = 14;

export function isSuperAdmin(username?: string | null): boolean {
  if (!username) return false;
  return SUPERADMINS.includes(username.trim().toLowerCase());
}

/**
 * Goleiros são isentos de mensalidade e taxa de avulso.
 * Usado para bloquear os checkboxes de mensalista/admin em formulários.
 */
export function isentoMensalidade(j: { posicao: string }): boolean {
  return j.posicao === 'goleiro';
}

/**
 * Apenas jogadores mensalistas não-goleiros podem ser administradores.
 * Superadmins são imutáveis — esta função não se aplica a eles.
 */
export function podeSerAdmin(j: { posicao: string; is_mensalista: boolean }): boolean {
  return !isentoMensalidade(j) && j.is_mensalista;
}

/**
 * Garante que jogadores com usernames configurados em `SUPERADMINS` sempre
 * recebam `is_admin: true` no cliente, mesmo se o banco ainda não refletir.
 */
export function aplicarSuperAdmin<T extends { username: string; is_admin: boolean }>(
  jogador: T
): T {
  return {
    ...jogador,
    is_admin: Boolean(jogador.is_admin || isSuperAdmin(jogador.username)),
  };
}

/**
 * Mapeia uma linha bruta da tabela `jogadores` para a interface canônica `JogadorLista`,
 * normalizando tipos de posição e aplicando privilégios de superadmin.
 */
export function mapearJogadorLista(j: {
  id: number;
  username: string;
  posicao: string;
  is_admin: boolean;
  is_ativo: boolean;
  is_mensalista: boolean;
  posicao_b?: string | null;
  chave_pix?: string | null;
  telefone?: string | null;
  media_nota?: number;
  partidas_ultimos_2_meses?: number;
}): JogadorLista {
  return aplicarSuperAdmin({
    ...j,
    posicao: j.posicao as PosicaoId,
    posicao_b: (j.posicao_b as PosicaoId | null) ?? null,
  });
}

export async function listarUsernames(): Promise<string[]> {
  const { data, error } = await supabase.from('jogadores').select('username').order('username');

  if (error) throw error;
  return (data ?? [])
    .map((jogador) => jogador.username)
    .filter((username) => !isRandomUsername(username));
}

/**
 * Lista todos os jogadores ativos no sistema.
 *
 * NOTA DE DESIGN: Esta listagem INCLUI intencionalmente jogadores temporários "random"
 * (placeholders de convidados como random1, random2), pois são slots ativos selecionáveis
 * para escalação, confirmação e edição de partidas em tempo real.
 */
export async function listarJogadoresAtivos(): Promise<JogadorLista[]> {
  const { data, error } = await supabase
    .from('jogadores')
    .select(COLUNAS_JOGADOR_LISTA)
    .eq('is_ativo', true)
    .order('username');

  if (error) throw error;
  return (data ?? []).map(mapearJogadorLista);
}

/**
 * Lista todos os jogadores cadastrados no sistema (ativos e inativos).
 *
 * NOTA DE DESIGN: Esta listagem FILTRA intencionalmente jogadores "random" (placeholders),
 * pois é utilizada para telas administrativas de gestão de atletas, catálogo geral
 * e controle de mensalistas, onde apenas usuários humanos reais devem ser exibidos.
 */
export async function listarTodosJogadores(): Promise<JogadorLista[]> {
  const { data, error } = await supabase
    .from('jogadores')
    .select(COLUNAS_JOGADOR_LISTA)
    .order('username');

  if (error) throw error;
  return (data ?? []).filter((j) => !isRandomUsername(j.username)).map(mapearJogadorLista);
}

// Salva um lote de alterações de mensalista/admin numa única RPC transacional
// (AGENTS 7.4): falha no meio não deixa metade dos jogadores alterada, e o
// teto de mensalistas é validado no servidor sobre o estado final do lote.
export async function salvarCaracteristicasJogadores(
  adminId: number,
  alteracoes: Array<{ id: number; is_mensalista: boolean; is_admin: boolean }>
): Promise<void> {
  const { data, error } = await supabase.rpc('salvar_caracteristicas_jogadores', {
    p_admin_id: adminId,
    p_jogadores: alteracoes,
  });

  if (error) throw error;
  if (data !== true) {
    throw new Error('Não foi possível salvar as alterações dos jogadores.');
  }
}

export async function atualizarUsernameJogador(id: number, novoUsername: string): Promise<void> {
  const { data, error } = await supabase.rpc('alterar_username', {
    p_jogador_id: id,
    p_novo_username: novoUsername.trim(),
  });

  if (error) throw error;
  if (data !== true) throw new Error('Não foi possível atualizar o usuário.');
}

// Redefine a senha do jogador para o padrão "123" (RPC resetar_senha).
export async function resetarSenhaJogador(id: number): Promise<void> {
  const { data, error } = await supabase.rpc('resetar_senha', {
    p_jogador_id: id,
  });

  if (error) throw error;
  if (data !== true) throw new Error('Jogador não encontrado.');
}

export async function obterMediasNotasJogadores(): Promise<Record<number, number>> {
  // 1) Tenta obter médias já agregadas no servidor via RPC
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('obter_medias_notas_jogadores');
    if (!rpcError && Array.isArray(rpcData)) {
      const mapa: Record<number, number> = {};
      for (const item of rpcData) {
        if (item.jogador_id && item.media_nota != null) {
          mapa[Number(item.jogador_id)] = Number(item.media_nota);
        }
      }
      return mapa;
    }
  } catch {
    // Continua para fallback caso a RPC ainda não esteja instalada
  }

  // 2) Fallback para cálculo direto
  const { data, error } = await supabase.from('votes').select('target_id, rating');

  if (error || !data) return {};

  const acumulado: Record<number, number[]> = {};
  for (const v of data) {
    const tid = Number(v.target_id);
    const rat = Number(v.rating);
    if (!isNaN(tid) && !isNaN(rat)) {
      if (!acumulado[tid]) {
        acumulado[tid] = [];
      }
      acumulado[tid].push(rat);
    }
  }

  const medias: Record<number, number> = {};
  for (const id in acumulado) {
    const idNum = Number(id);
    const notas = acumulado[idNum];
    if (notas && notas.length >= 3) {
      const soma = notas.reduce((acc, r) => acc + r, 0);
      const min = Math.min(...notas);
      const max = Math.max(...notas);
      const somaAjustada = soma - min - max;
      const qtdAjustada = notas.length - 2;
      medias[idNum] = Number((somaAjustada / qtdAjustada).toFixed(2));
    } else if (notas && notas.length > 0) {
      const soma = notas.reduce((acc, r) => acc + r, 0);
      medias[idNum] = Number((soma / notas.length).toFixed(2));
    }
  }
  return medias;
}

export async function obterPartidasRecentesJogadores(meses = 2): Promise<Record<number, number>> {
  // 1) Tenta obter agregação direta do servidor via RPC
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      'obter_partidas_recentes_jogadores',
      {
        p_meses: meses,
      }
    );
    if (!rpcError && Array.isArray(rpcData)) {
      const mapa: Record<number, number> = {};
      for (const item of rpcData) {
        if (item.jogador_id && item.partidas_recentes != null) {
          mapa[Number(item.jogador_id)] = Number(item.partidas_recentes);
        }
      }
      return mapa;
    }
  } catch {
    // Continua para fallback caso a RPC ainda não esteja instalada
  }

  // 2) Fallback para cálculo direto com base no histórico de partidas
  try {
    const limiteData = new Date();
    limiteData.setMonth(limiteData.getMonth() - meses);
    const { data, error } = await supabase
      .from('partidas_participantes')
      .select('jogador_id, time, partidas!inner(status, data_jogo)')
      .in('partidas.status', ['live', 'published', 'closed'])
      .gte('partidas.data_jogo', limiteData.toISOString())
      .not('time', 'is', null);

    if (error || !data) return {};

    const mapa: Record<number, number> = {};
    for (const row of (data ?? []) as { jogador_id: number }[]) {
      const jid = Number(row.jogador_id);
      if (!isNaN(jid)) {
        mapa[jid] = (mapa[jid] || 0) + 1;
      }
    }
    return mapa;
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// Confronto direto (comparador cara-a-cara)
// ---------------------------------------------------------------------------

// Linha crua da RPC confronto_direto: numéricos do Postgres (bigint/numeric)
// podem chegar como string dependendo do driver, por isso o union com string.
interface LinhaConfrontoRow {
  lado: string;
  bloco: string;
  partidas: number | string;
  gols: number | string;
  assistencias: number | string;
  gols_contra: number | string;
  vitorias: number | string;
  empates: number | string;
  derrotas: number | string;
  media_nota: number | string | null;
}

// Agregado do confronto: produção e retrospecto de um atleta ('a' ou 'b') num
// contexto — 'juntos' (mesmo time) ou 'adversos' (times opostos).
// O consumer indexa por (lado, bloco), nunca pela ordem das linhas.
export interface LinhaConfronto {
  lado: 'a' | 'b';
  bloco: 'juntos' | 'adversos';
  partidas: number;
  gols: number;
  assistencias: number;
  gols_contra: number;
  vitorias: number;
  empates: number;
  derrotas: number;
  media_nota: number | null;
}

interface PartidaConfrontoRow {
  partida_id: number | string;
  data_jogo: string;
  relacao: string;
  time_a: string;
  gols_time_a: number | string;
  gols_time_b: number | string;
  vencedor: string;
}

// Uma partida compartilhada pelos dois atletas: placar sob a ótica do lado A
// (time_a = time do jogador A naquela partida; vencedor 'a' | 'b' | 'empate').
export interface PartidaConfronto {
  partida_id: number;
  data_jogo: string;
  relacao: 'juntos' | 'adversos';
  time_a: string;
  gols_time_a: number;
  gols_time_b: number;
  vencedor: string;
}

// Retorno consolidado do comparador: agregados por contexto + histórico.
export interface ComparativoConfronto {
  linhas: LinhaConfronto[];
  partidas: PartidaConfronto[];
}

// Comparação cara-a-cara entre dois atletas: agregados juntos/adversos via RPC
// confronto_direto e últimas partidas compartilhadas via RPC confronto_direto_partidas
// (agregação 100% no PostgreSQL, em duas chamadas paralelas).
// Função pura de leitura: apenas consulta e lança erro (nunca seta estado —
// requisito do useCache, AGENTS.md 5.5).
export async function compararJogadores(
  a: number,
  b: number,
  limite = 10
): Promise<ComparativoConfronto> {
  const [resLinhas, resPartidas] = await Promise.all([
    supabase.rpc('confronto_direto', { p_jogador_a: a, p_jogador_b: b }),
    supabase.rpc('confronto_direto_partidas', {
      p_jogador_a: a,
      p_jogador_b: b,
      p_limite: limite,
    }),
  ]);

  // Mensagens das RPCs já vêm em pt-BR; a rota aplica formatarMensagemErro.
  if (resLinhas.error) throw resLinhas.error;
  if (resPartidas.error) throw resPartidas.error;

  const linhas: LinhaConfronto[] = ((resLinhas.data ?? []) as LinhaConfrontoRow[]).map((l) => ({
    lado: l.lado as 'a' | 'b',
    bloco: l.bloco as 'juntos' | 'adversos',
    partidas: Number(l.partidas),
    gols: Number(l.gols),
    assistencias: Number(l.assistencias),
    gols_contra: Number(l.gols_contra),
    vitorias: Number(l.vitorias),
    empates: Number(l.empates),
    derrotas: Number(l.derrotas),
    // numeric do Postgres pode vir como string; normaliza e arredonda p/ 2 casas
    media_nota: l.media_nota == null ? null : Number(Number(l.media_nota).toFixed(2)),
  }));

  // A RPC já ordena por data_jogo DESC — mantém a ordem recebida.
  const partidas: PartidaConfronto[] = ((resPartidas.data ?? []) as PartidaConfrontoRow[]).map(
    (p) => ({
      partida_id: Number(p.partida_id),
      data_jogo: p.data_jogo,
      relacao: p.relacao as 'juntos' | 'adversos',
      time_a: p.time_a,
      gols_time_a: Number(p.gols_time_a),
      gols_time_b: Number(p.gols_time_b),
      vencedor: p.vencedor,
    })
  );

  return { linhas, partidas };
}

export async function criarGoleiroRapido(
  dados: {
    nome: string;
    telefone?: string | null;
    chave_pix?: string | null;
  },
  adminId: number
): Promise<number> {
  const { data, error } = await supabase.rpc('criar_goleiro_rapido', {
    p_nome: dados.nome.trim(),
    p_telefone: dados.telefone?.trim() || undefined,
    p_chave_pix: dados.chave_pix?.trim() || undefined,
    p_admin_id: adminId,
  });

  if (error) throw error;
  return Number(data);
}

export async function atualizarDadosPixTelefone(
  jogadorId: number,
  dados: { chave_pix?: string | null; telefone?: string | null },
  operadorId: number
): Promise<void> {
  const { error } = await supabase.rpc('atualizar_dados_pix_telefone', {
    p_jogador_id: jogadorId,
    p_chave_pix: dados.chave_pix ? dados.chave_pix.trim() : '',
    p_telefone: dados.telefone ? dados.telefone.trim() : '',
    p_operador_id: operadorId,
  });

  if (error) throw error;
}

export async function alternarStatusAtivoJogador(
  jogadorId: number,
  isAtivo: boolean,
  adminId: number
): Promise<void> {
  const { error } = await supabase.rpc('alternar_status_ativo_jogador', {
    p_jogador_id: jogadorId,
    p_is_ativo: isAtivo,
    p_admin_id: adminId,
  });

  if (error) throw error;
}

/**
 * Lista todos os goleiros (ativos e inativos), ordenados primeiro por status ativo e depois por username.
 */
export async function listarGoleiros(): Promise<JogadorLista[]> {
  const { data, error } = await supabase
    .from('jogadores')
    .select(COLUNAS_JOGADOR_LISTA)
    .or('posicao.eq.goleiro,posicao_b.eq.goleiro')
    .order('is_ativo', { ascending: false })
    .order('username');

  if (error) throw error;
  return (data ?? []).map(mapearJogadorLista);
}

export interface StatsJogador {
  jogador_id: number;
  partidas: number;
  gols: number;
  assistencias: number;
  gols_contra: number;
  vitorias: number;
}

/**
 * Consulta os números gerais da temporada a partir da view `stats_jogador`.
 * Suporta consulta individual (retorna StatsJogador ou null) ou em lote (retorna StatsJogador[]).
 */
export async function carregarStatsJogador(jogadorId: number): Promise<StatsJogador | null>;
export async function carregarStatsJogador(jogadorIds: number[]): Promise<StatsJogador[]>;
export async function carregarStatsJogador(
  idOuIds: number | number[]
): Promise<StatsJogador | null | StatsJogador[]> {
  if (Array.isArray(idOuIds)) {
    if (idOuIds.length === 0) return [];
    const { data, error } = await supabase
      .from('stats_jogador')
      .select('jogador_id, partidas, gols, assistencias, gols_contra, vitorias')
      .in('jogador_id', idOuIds);

    if (error) throw error;
    return (data ?? []).map((row) => ({
      jogador_id: row.jogador_id ?? 0,
      partidas: row.partidas ?? 0,
      gols: row.gols ?? 0,
      assistencias: row.assistencias ?? 0,
      gols_contra: row.gols_contra ?? 0,
      vitorias: row.vitorias ?? 0,
    }));
  }

  const { data, error } = await supabase
    .from('stats_jogador')
    .select('jogador_id, partidas, gols, assistencias, gols_contra, vitorias')
    .eq('jogador_id', idOuIds)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    jogador_id: data.jogador_id ?? idOuIds,
    partidas: data.partidas ?? 0,
    gols: data.gols ?? 0,
    assistencias: data.assistencias ?? 0,
    gols_contra: data.gols_contra ?? 0,
    vitorias: data.vitorias ?? 0,
  };
}
