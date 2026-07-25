/**
 * lib/sumula.ts
 * Task: T6.2 - Sumula pos-jogo (placar + estatisticas por jogador + finalizar).
 *
 * Principios:
 *   - Pure helpers no topo (testaveis sem IO): incrementStat, decrementStat,
 *     clampStat, parseTeamScores, buildTeamScoresJson, friendlyError,
 *     makeEmptyStats, applyStatDelta, summarizeParticipants.
 *   - Acoes IO (Supabase) abaixo: fetchMatchSumula, updateTeamScores,
 *     updateParticipantStats, addWalkInParticipant, finishMatch. Mutam
 *     MATCHES.team_scores / MATCH_PARTICIPANTS / MATCHES.status respeitando
 *     RLS (so admin UPDATE - T1.7).
 *
 * Schema validado (T1.3a):
 *   - MATCHES.team_scores jsonb DEFAULT '{}' (ex.: {"1": 8, "2": 6}).
 *   - MATCH_PARTICIPANTS: goals_scored int DEFAULT 0 CHECK >=0,
 *                         goals_assisted int DEFAULT 0 CHECK >=0,
 *                         own_goals int DEFAULT 0 CHECK >=0.
 *   - MATCH_PARTICIPANTS.team_group int CHECK >= 1.
 *   - MATCHES.status enum (scheduled|active|finished|cancelled).
 *
 * PRD regra 4 - "add avulso in-game": quando um avulso NAO confirmado
 * comparece fisicamente em campo, o admin pode adicionar como presence
 * confirmed + INSERT em match_participants para capturar suas stats.
 *
 * Restricoes:
 *   - updateParticipantStats NAO valida FK explicita; depende do gate T1.7
 *     (RLS 42501 PT-BR em caso de falta de permissao).
 *   - finishMatch so seta status='active' -> 'finished'; canceled/finished
 *     sao bloqueados upstream pela UI (botao so aparece em status active).
 */

import type {
  Json,
  MatchParticipantRow,
  MatchParticipantUpdate,
  MatchRow,
  MatchStatus,
  MatchUpdate,
} from '@/types/database.types';

// ----- Types ----------------------------------------------------------------

/** Idioma das chaves de team_scores no JSON: {"1": X, "2": Y}. Strings (JSONB). */
export type TeamScoresMap = Record<string, number>;

/** Estatisticas editaveis por participante (3 contadores). */
export type PlayerStatField = 'goals_scored' | 'goals_assisted' | 'own_goals';

/** Snapshot de um participante enriquecido para a UI sumula. */
export interface SumulaParticipant extends MatchParticipantRow {
  full_name: string;
  user_type: 'mensalista' | 'avulso' | 'goleiro_pago';
}

/** Erro com codigo Postgres (Supabase PostgrestError / similar). */
interface DbLikeError {
  code?: string;
  message?: string;
}

/** Constante: stat fields e valores validos. */
export const STAT_FIELDS: readonly PlayerStatField[] = [
  'goals_scored',
  'goals_assisted',
  'own_goals',
] as const;

/** Limite defensivo (YAGNI): 99 gols por jogador e suficiente p/ qualquer pelada. */
export const STAT_MAX = 99;

// ----- Pure logic (testavel sem IO) ----------------------------------------

/**
 * Garante valor entre [0, STAT_MAX]. Same semantics do CHECK do SQL,
 * aplicado antes de mutar UI p/ evitar resposta pre-rejeicao.
 */
export function clampStat(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const rounded = Math.trunc(value);
  if (rounded < 0) return 0;
  if (rounded > STAT_MAX) return STAT_MAX;
  return rounded;
}

/**
 * Aplica delta (+1/-1) numa stat e devolve novo valor clampado.
 * Usado pelos botoes +/- da UI.
 */
export function applyStatDelta(current: number, delta: number): number {
  return clampStat(current + delta);
}

/**
 * Stats zeradas (snapshot inicial p/ um novo match ou reset).
 */
export function makeEmptyStats(): Record<PlayerStatField, number> {
  return { goals_scored: 0, goals_assisted: 0, own_goals: 0 };
}

/**
 * Faz cast seguro do jsonb team_scores para TeamScoresMap.
 * - null/objeto vazio -> {} (match novo ainda sem placar).
 * - chaves inteiras viram strings (JSONB normaliza keys).
 * - valores invalidos/negativos -> 0.
 */
export function parseTeamScores(raw: Json | null | undefined): TeamScoresMap {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }
  const obj = raw as { [key: string]: unknown };
  const out: TeamScoresMap = {};
  for (const [key, value] of Object.entries(obj)) {
    const num = typeof value === 'number' ? value : Number(value);
    if (Number.isFinite(num) && num >= 0) {
      out[String(key)] = clampStat(num);
    }
  }
  return out;
}

/**
 * Converte TeamScoresMap de volta para o formato jsonb aceito pelo update.
 * Sempre devolve Record<string, number> (jsonb valido).
 */
export function buildTeamScoresJson(map: TeamScoresMap): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(map)) {
    if (Number.isFinite(value) && value >= 0) {
      out[String(key)] = clampStat(value);
    }
  }
  return out;
}

/**
 * Atualiza placar de um time dentro do map (retorna NOVO map imutavel).
 * clampStat garante range [0, STAT_MAX].
 */
export function setTeamScore(map: TeamScoresMap, teamGroup: number, score: number): TeamScoresMap {
  if (!Number.isFinite(teamGroup) || teamGroup < 1) return map;
  return { ...map, [String(teamGroup)]: clampStat(score) };
}

/**
 * Soma agregada por time: total de goals_scored dos participantes.
 * Usado pelo cabecalho da sumula p/ sugestao de placar (nao auto-salva).
 */
export function summarizeParticipants(participants: SumulaParticipant[]): {
  totalGoals: TeamScoresMap;
  totalAssists: TeamScoresMap;
  totalOwnGoals: TeamScoresMap;
} {
  const totalGoals: TeamScoresMap = {};
  const totalAssists: TeamScoresMap = {};
  const totalOwnGoals: TeamScoresMap = {};
  for (const p of participants) {
    const key = String(p.team_group);
    totalGoals[key] = (totalGoals[key] ?? 0) + clampStat(p.goals_scored);
    totalAssists[key] = (totalAssists[key] ?? 0) + clampStat(p.goals_assisted);
    totalOwnGoals[key] = (totalOwnGoals[key] ?? 0) + clampStat(p.own_goals);
  }
  return { totalGoals, totalAssists, totalOwnGoals };
}

/**
 * Traduz erro Supabase/Postgres em mensagem PT-BR para toast/Alert.
 * Fallback generico para erros sem codigo reconhecido.
 */
export function friendlyError(err: DbLikeError | null | undefined): string {
  if (!err || (!err.code && !err.message)) {
    return 'Erro ao atualizar a sumula. Tente novamente.';
  }
  switch (err.code) {
    case '23503':
      return 'Partida ou jogador invalido.';
    case '42501':
      return 'Voce nao tem permissao de administrador para editar a sumula.';
    case 'P0002':
      return 'Partida nao encontrada.';
    case '23514':
      return 'Valor invalido para estatistica (use numeros positivos).';
    default:
      return 'Erro ao atualizar a sumula. Tente novamente.';
  }
}

/**
 * Checa se o match pode ser movido para 'finished'. Apenas ativo.
 * Scheduled/finished/cancelled sao bloqueados (UI ja regateja por visibilidade
 * do botao).
 */
export function canFinishMatch(status: MatchStatus | null | undefined): boolean {
  return status === 'active';
}

// ----- IO (Supabase) --------------------------------------------------------

/** Helper interno: carrega cliente supabase via import dinamico (evita RN esbuild error em tsx). */
async function getSupabase() {
  const { supabase } = await import('@/lib/supabase');
  return supabase;
}

/**
 * Carrega a sumula completa do match: MATCHES + MATCH_PARTICIPANTS com JOIN
 * profiles. RLS: membros! do grupo leem (select_policy T1.7).
 *
 * - team_scores: parseado via parseTeamScores p/ uso imediato.
 * - participants: zero ou mais linhas, ordenadas por team_group asc + GK primeiro.
 *
 * Retorna null se o match nao existir; lanca Error PT-BR em outros casos.
 */
export async function fetchMatchSumula(matchId: string): Promise<{
  match: MatchRow;
  teamScores: TeamScoresMap;
  participants: SumulaParticipant[];
} | null> {
  const supabase = await getSupabase();

  const [matchResp, participantsResp] = await Promise.all([
    supabase.from('matches').select('*').eq('id', matchId).maybeSingle(),
    supabase
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
          full_name,
          user_type
        )
        `,
      )
      .eq('match_id', matchId)
      .order('team_group', { ascending: true })
      .order('is_goalkeeper', { ascending: false }),
  ]);

  if (matchResp.error) throw new Error(friendlyError(matchResp.error as DbLikeError));
  if (participantsResp.error) throw new Error(friendlyError(participantsResp.error as DbLikeError));

  const match = matchResp.data as MatchRow | null;
  if (!match) return null;

  const rawParticipants = (participantsResp.data ?? []) as unknown as Array<
    MatchParticipantRow & {
      profile: { full_name: string; user_type: SumulaParticipant['user_type'] } | null;
    }
  >;

  const participants: SumulaParticipant[] = rawParticipants.map((r) => ({
    id: r.id,
    match_id: r.match_id,
    player_id: r.player_id,
    team_group: r.team_group,
    is_goalkeeper: r.is_goalkeeper,
    goals_scored: r.goals_scored,
    goals_assisted: r.goals_assisted,
    own_goals: r.own_goals,
    created_at: r.created_at,
    updated_at: r.updated_at,
    full_name: r.profile?.full_name ?? 'Jogador',
    user_type: r.profile?.user_type ?? 'avulso',
  }));

  return {
    match,
    teamScores: parseTeamScores(match.team_scores),
    participants,
  };
}

/**
 * Atualiza o placar (MATCHES.team_scores jsonb). RLS: so admin (T1.7).
 *
 * Substitui o jsonb inteiro pelo map fornecido (buildTeamScoresJson garante
 * formato valido e filtrado).
 */
export async function updateTeamScores(matchId: string, teamScores: TeamScoresMap): Promise<void> {
  const supabase = await getSupabase();
  const payload: MatchUpdate = { team_scores: buildTeamScoresJson(teamScores) as Json };
  const { error } = await supabase
    .from('matches')
    .update(payload as never)
    .eq('id', matchId);
  if (error) throw new Error(friendlyError(error as DbLikeError));
}

/**
 * Atualiza uma stat (goals_scored/assisted/own_goals) de um participante.
 * RLS: so admin (T1.7). clampStat garante CHECK >= 0 no client.
 *
 * Estrategia: optimistic single-column update (apenas o campo afetado).
 */
export async function updateParticipantStat(
  participantId: string,
  field: PlayerStatField,
  value: number,
): Promise<void> {
  const supabase = await getSupabase();
  const clamped = clampStat(value);
  const payload: MatchParticipantUpdate = { [field]: clamped };
  const { error } = await supabase
    .from('match_participants')
    .update(payload as never)
    .eq('id', participantId);
  if (error) throw new Error(friendlyError(error as DbLikeError));
}

/** Add avulso via RPC atomica SECURITY DEFINER, preservando stats no upsert. */
export async function addWalkInParticipant(input: {
  matchId: string;
  playerId: string;
  teamGroup: number;
}): Promise<MatchParticipantRow> {
  const supabase = await getSupabase();
  const { matchId, playerId, teamGroup } = input;
  const safeTeam = Number.isFinite(teamGroup) && teamGroup >= 1 ? Math.trunc(teamGroup) : 1;
  const { data, error } = await supabase.rpc('add_walk_in_participant', {
    match_id: matchId,
    player_id: playerId,
    team_group: safeTeam,
  } as never);

  if (error) throw new Error(friendlyError(error as DbLikeError));
  const participant = data?.[0];
  if (!participant) throw new Error('Participante nao retornado pela RPC.');
  return participant as MatchParticipantRow;
}

/**
 * Seta MATCHES.status='finished'. RLS: so admin (T1.7).
 * O reminder de goleiros dispara automaticamente via Realtime no device admin
 * (T4.3 lib/realtime.ts -> subscribeMatchesForReminder) - este IO nao chama
 * explicitamente o reminder.
 *
 * Valida: canFinishMatch(status). Se nao, lanca Error PT-BR.
 */
export async function finishMatch(
  matchId: string,
  currentStatus: MatchStatus | null | undefined,
): Promise<void> {
  if (!canFinishMatch(currentStatus)) {
    throw new Error('So e possivel finalizar uma partida em andamento (status=active).');
  }
  const supabase = await getSupabase();
  const payload: MatchUpdate = {
    status: 'finished' as MatchStatus,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase
    .from('matches')
    .update(payload as never)
    .eq('id', matchId);
  if (error) throw new Error(friendlyError(error as DbLikeError));
}
