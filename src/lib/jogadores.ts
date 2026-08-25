import { supabase } from './supabase';
import type { PosicaoId } from './times';

// Detecta jogadores "random" (placeholders): username com prefixo 'random'
// e sufixo opcional de dígitos (casa 'random', 'random1'...'random6', 'random99').
// Case-insensitive para equivaler ao .toLowerCase().startsWith("random").
export function isRandomUsername(username?: string | null): boolean {
  return !!username && /^random\d*$/i.test(username.trim());
}

export function validarFormatoUsername(username: string): string | null {
  const limpo = username.trim().toLowerCase();
  if (!limpo || limpo.length < 2) return 'O usuário deve ter ao menos 2 caracteres.';
  if (limpo.length > 30) return 'O usuário deve ter no máximo 30 caracteres.';
  if (!/^[a-z0-9._-]+$/.test(limpo)) {
    return 'Use apenas letras minúsculas, números, ponto, hífen ou sublinhado.';
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
}

export const SUPERADMINS = ['dico', 'tadeu', 'natal'];
export const MAX_MENSALISTAS = 14;

export function isSuperAdmin(username?: string | null): boolean {
  if (!username) return false;
  return SUPERADMINS.includes(username.trim().toLowerCase());
}

export async function listarUsernames(): Promise<string[]> {
  const { data, error } = await supabase.from('jogadores').select('username').order('username');

  if (error) throw error;
  return (data ?? [])
    .map((jogador) => jogador.username)
    .filter((username) => !isRandomUsername(username));
}

export async function listarJogadoresAtivos(): Promise<JogadorLista[]> {
  const { data, error } = await supabase
    .from('jogadores')
    .select(
      'id, username, posicao, is_admin, is_ativo, is_mensalista, posicao_b, chave_pix, telefone'
    )
    .eq('is_ativo', true)
    .order('username');

  if (error) throw error;
  return (data ?? []).map((j) => ({
    ...j,
    is_admin: j.is_admin || isSuperAdmin(j.username),
  }));
}

export async function listarTodosJogadores(): Promise<JogadorLista[]> {
  const { data, error } = await supabase
    .from('jogadores')
    .select(
      'id, username, posicao, is_admin, is_ativo, is_mensalista, posicao_b, chave_pix, telefone'
    )
    .order('username');

  if (error) throw error;
  return (data ?? [])
    .filter((j) => !isRandomUsername(j.username))
    .map((j) => ({
      ...j,
      is_admin: j.is_admin || isSuperAdmin(j.username),
    }));
}

export async function atualizarCaracteristicasJogador(
  id: number,
  username: string,
  dados: { is_mensalista?: boolean; is_admin?: boolean }
): Promise<void> {
  const payload: { is_mensalista?: boolean; is_admin?: boolean } = { ...dados };

  if (isSuperAdmin(username)) {
    // Superadmins sempre mantêm is_admin e is_mensalista como true
    payload.is_admin = true;
    payload.is_mensalista = true;
  } else {
    // Regra: se o status de mensalista for removido, remove também o status de admin
    if (payload.is_mensalista === false) {
      payload.is_admin = false;
    }
    // Regra: não permite ativar is_admin se for não-mensalista
    if (payload.is_admin === true && payload.is_mensalista === false) {
      throw new Error('Apenas jogadores mensalistas podem ser administradores.');
    }
  }

  // Validação do limite de mensalistas se estiver ativando mensalista
  if (payload.is_mensalista === true) {
    const { data: jogadorAtual } = await supabase
      .from('jogadores')
      .select('posicao, is_mensalista')
      .eq('id', id)
      .maybeSingle();

    if (jogadorAtual?.posicao === 'goleiro') {
      throw new Error('Goleiros não pagam para jogar e não podem ser mensalistas.');
    }

    if (jogadorAtual && !jogadorAtual.is_mensalista) {
      const { count, error: countErr } = await supabase
        .from('jogadores')
        .select('id', { count: 'exact', head: true })
        .eq('is_mensalista', true);

      if (countErr) throw countErr;
      if ((count ?? 0) >= MAX_MENSALISTAS) {
        throw new Error(
          `Limite máximo de ${MAX_MENSALISTAS} mensalistas atingido. Remova o status de mensalista de outro jogador antes de adicionar.`
        );
      }
    }
  }

  const { error } = await supabase.from('jogadores').update(payload).eq('id', id);

  if (error) throw error;
}

export async function atualizarUsernameJogador(id: number, novoUsername: string): Promise<void> {
  const { data, error } = await supabase.rpc('alterar_username', {
    p_jogador_id: id,
    p_novo_username: novoUsername.trim().toLowerCase(),
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

export async function criarGoleiroRapido(dados: {
  nome: string;
  telefone?: string | null;
  chave_pix?: string | null;
}): Promise<number> {
  const { data, error } = await supabase.rpc('criar_goleiro_rapido', {
    p_nome: dados.nome.trim(),
    p_telefone: dados.telefone?.trim() || null,
    p_chave_pix: dados.chave_pix?.trim() || null,
  });

  if (error) throw error;
  return Number(data);
}

export async function atualizarDadosPixTelefone(
  id: number,
  dados: { chave_pix?: string | null; telefone?: string | null }
): Promise<void> {
  const payload: { chave_pix?: string | null; telefone?: string | null } = {};
  if (dados.chave_pix !== undefined)
    payload.chave_pix = dados.chave_pix ? dados.chave_pix.trim() : null;
  if (dados.telefone !== undefined)
    payload.telefone = dados.telefone ? dados.telefone.trim() : null;

  const { error } = await supabase.from('jogadores').update(payload).eq('id', id);
  if (error) throw error;
}

export async function listarGoleiros(): Promise<JogadorLista[]> {
  const { data, error } = await supabase
    .from('jogadores')
    .select(
      'id, username, posicao, is_admin, is_ativo, is_mensalista, posicao_b, chave_pix, telefone'
    )
    .or('posicao.eq.goleiro,posicao_b.eq.goleiro')
    .order('is_ativo', { ascending: false })
    .order('username');

  if (error) throw error;
  return (data ?? []).map((j) => ({
    ...j,
    is_admin: j.is_admin || isSuperAdmin(j.username),
  }));
}
