/**
 * lib/teams.ts
 * Task: T6.1 - Sorteio aleatorio puro via RPC draw_teams(match_id) + helpers puros.
 *
 * Principios:
 *   - Funcoes PURAS no topo (testaveis sem IO/Supabase): splitTeams7x7,
 *     countGkPairForOpposingTeams, annotateTeamGroup, friendlyError.
 *   - Acoes de IO (Supabase) abaixo: drawTeams (RPC), fetchTeamsByMatch,
 *     activateMatch. Mutam MATCH_PARTICIPANTS / MATCHES via RPC respeitando
 *     RLS (admin via is_admin()).
 *
 * PRD regra 4 - sorteio aleatorio puro:
 *   - 16 confirmados (14 mensalistas/avulsos + 2 goleiro_pago).
 *   - GoLEIRO_PAGO: 1 em team_group=1 e outro em team_group=2 (is_goalkeeper=true).
 *   - 14 jogadores divididos 7/7 via NTILE(2) sobre ORDER BY random() no SQL.
 *
 * Idempotencia: o RPC draw_teams DELETE match_participants WHERE match_id antes
 * de re-INSERT (re-sortear e' seguro).
 *
 * Restricoes:
 *   - Nao valida FK match_id/player_id explicitamente: depende do gate T1.3a
 *     (FK violada vira Postgres 23503 -> friendlyError PT-BR).
 *   - activateMatch so seta status='scheduled' -> 'active' se ainda scheduled
 *     (c-mudancas finished/cancelled sao bloqueadas upstream pela UI).
 */

import type { MatchParticipantRow, MatchUpdate, ProfileRow } from '@/types/database.types';

// ----- Types ----------------------------------------------------------------

/** Linha de retorno da RPC draw_teams (mirror da RETURNS TABLE do SQL). */
export interface DrawTeamsRpcRow {
  player_id: string;
  team_group: number;
  is_goalkeeper: boolean;
}

/** Sorteio agrupado em 2 times (consumo pela UI). */
export interface DrawnTeams {
  team1: (ProfileRow & { is_goalkeeper: boolean })[];
  team2: (ProfileRow & { is_goalkeeper: boolean })[];
}

/** Amigo JS p/ joining ProfileRow com info de team/GK. */
export interface AnnotatedParticipant {
  player_id: string;
  team_group: number;
  is_goalkeeper: boolean;
}

/** Erro com codigo Postgres (Supabase PostgrestError / similar). */
interface DbLikeError {
  code?: string;
  message?: string;
}

// ----- Pure logic (testavel sem IO) ----------------------------------------

/**
 * Distribui uma lista de jogadores em 2 times de tamanho mais proximo
 * possivel (ceiling/floor). Replica a logica NTILE(2) do SQL para validar
 * em memoria o layout do sorteio sem consumir IO.
 *
 * - team1 recebe CEIL(n/2) (sempre o maior quando impar).
 * - team2 recebe FLOOR(n/2).
 * - Estabilidade: usa PRNG sementeado (mulberry32) para garantir
 *   reprodutibilidade em testes. Em producao o SQL usa ORDER BY random().
 */
export function splitTeams7x7(
  playerIds: string[],
  seed: number,
): {
  team1: string[];
  team2: string[];
} {
  if (playerIds.length === 0) return { team1: [], team2: [] };

  // PRNG mulberry32: deterministico por seed.
  const shuffled = [...playerIds];
  const rng = makeRng(seed);
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    if (i !== j) {
      const a = shuffled[i];
      const b = shuffled[j];
      if (a !== undefined && b !== undefined) {
        shuffled[i] = b;
        shuffled[j] = a;
      }
    }
  }

  const half = Math.ceil(shuffled.length / 2);
  return {
    team1: shuffled.slice(0, half),
    team2: shuffled.slice(half),
  };
}

/**
 * Atribui goleiros em times opostos: primeiro GK em team 1, segundo em team 2.
 * Como gate de defesa: aceita apenas os 2 primeiros goleiros (se vier 3+).
 * Mantem align com a constraint SQL de exatamente 2 GK por partida.
 */
export function countGkPairForOpposingTeams(goalkeeperIds: string[]): {
  gkTeam1: string[];
  gkTeam2: string[];
} {
  const first = goalkeeperIds[0];
  const second = goalkeeperIds[1];
  return {
    gkTeam1: first !== undefined ? [first] : [],
    gkTeam2: second !== undefined ? [second] : [],
  };
}

/**
 * Combina players (split 7/7) e goleiros (1+1 opostos) em lista anotada
 * pronta para validac ao ou INSERT manual. GoLEIROs sobrescrevem o team do
 * jogador correspondente (se coincidir id) - mas em geral sao grupos disjuntos.
 */
export function annotateTeamGroup(
  split: { team1: string[]; team2: string[] },
  gks: { gkTeam1: string[]; gkTeam2: string[] },
): AnnotatedParticipant[] {
  const fromTeam1: AnnotatedParticipant[] = split.team1.map((player_id) => ({
    player_id,
    team_group: 1,
    is_goalkeeper: false,
  }));
  const fromTeam2: AnnotatedParticipant[] = split.team2.map((player_id) => ({
    player_id,
    team_group: 2,
    is_goalkeeper: false,
  }));
  const gks1: AnnotatedParticipant[] = gks.gkTeam1.map((player_id) => ({
    player_id,
    team_group: 1,
    is_goalkeeper: true,
  }));
  const gks2: AnnotatedParticipant[] = gks.gkTeam2.map((player_id) => ({
    player_id,
    team_group: 2,
    is_goalkeeper: true,
  }));
  return [...fromTeam1, ...fromTeam2, ...gks1, ...gks2];
}

/**
 * Traduz um erro Supabase/Postgres em mensagem PT-BR amigavel para toast.
 * Fallback: retorna a mensagem original (ou texto generico se ausente).
 */
export function friendlyError(err: DbLikeError | null | undefined): string {
  if (!err || (!err.code && !err.message)) {
    return 'Erro ao sortear times. Tente novamente.';
  }
  switch (err.code) {
    case '23503':
      return 'Partida ou jogador invalido.';
    case '42501':
      return 'Voce nao tem permissao para sortear os times.';
    case 'P0002':
      return 'Partida ou lista de confirmados nao encontrada.';
    case '42883':
      return 'Versao da function incompativel (atualize o app).';
    default:
      return 'Erro ao sortear times. Tente novamente.';
  }
}

// ----- IO (Supabase) --------------------------------------------------------

/**
 * Chama a RPC `draw_teams(match_id)` (SQL SECURITY DEFINER) que:
 *   1. Valida gate admin e entradas.
 *   2. DELETE idempotente de match_participants do match.
 *   3. Seta MATCHES.status='active' (congela lista confirmada).
 *   4. Distribui 2 goleiro_pago em times opostos (is_goalkeeper=true).
 *   5. Distribui 14 jogadores confirmados em 7/7 (NTILE(2) sobre random()).
 *   6. INSERT match_participants.
 *
 * Retorna as linhas atribuidas (player_id, team_group, is_goalkeeper).
 * Lanca Error com mensagem PT-BR (friendlyError) em qualquer falha.
 */
/** Helper interno: carrega cliente supabase via import dinamico (evita RN esbuild error em tsx). */
async function getSupabase() {
  const { supabase } = await import('@/lib/supabase');
  return supabase;
}

export async function drawTeams(matchId: string): Promise<DrawTeamsRpcRow[]> {
  const supabase = await getSupabase();
  const { data, error } = await supabase.rpc('draw_teams', {
    p_match_id: matchId,
  } as never);
  if (error) throw new Error(friendlyError(error));
  return (data ?? []) as unknown as DrawTeamsRpcRow[];
}

/**
 * Carrega MATCH_PARTICIPANTS + JOIN profiles para exibir o sorteio salvo.
 * RLS: membros do grupo da partida leem (T1.7 select_policy).
 *
 * Retorna vazio se ainda nao houve sorteio (match scheduled/waiting).
 */
export async function fetchTeamsByMatch(matchId: string): Promise<DrawnTeams> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('match_participants')
    .select(
      `
      id,
      match_id,
      player_id,
      team_group,
      is_goalkeeper,
      goals_scored,
      goals_assisted,
      own_goals,
      created_at,
      updated_at,
      profile:profiles!match_participants_player_id_fkey (
        id,
        group_id,
        username,
        phone_whatsapp,
        user_type,
        is_admin,
        avatar_url,
        created_at,
        updated_at
      )
    `,
    )
    .eq('match_id', matchId)
    .order('team_group', { ascending: true })
    .order('is_goalkeeper', { ascending: false });

  if (error) throw new Error(friendlyError(error));

  const rows = (data ?? []) as unknown as Array<MatchParticipantRow & { profile: ProfileRow }>;

  const team1 = rows
    .filter((r) => r.team_group === 1)
    .map((r) => ({ ...r.profile, is_goalkeeper: r.is_goalkeeper }));
  const team2 = rows
    .filter((r) => r.team_group === 2)
    .map((r) => ({ ...r.profile, is_goalkeeper: r.is_goalkeeper }));

  return { team1, team2 };
}

/**
 * Seta MATCHES.status='active' (independente do sorteio). Em geral o proprio
 * RPC draw_teams ja faz isso, mas expomos como helper p/ casos onde o admin
 * quer ativar a partida sem re-sortear.
 */
export async function activateMatch(matchId: string): Promise<void> {
  const supabase = await getSupabase();
  const payload: MatchUpdate = {
    status: 'active',
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase
    .from('matches')
    .update(payload as never)
    .eq('id', matchId);
  if (error) throw new Error(friendlyError(error));
}

// ----- Helpers privados -----------------------------------------------------

/** PRNG mulberry32: sementeado, deterministico, rapido. Usado pelos pure tests. */
function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
