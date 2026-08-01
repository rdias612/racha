/**
 * lib/rsvp.ts
 * Task: T2.3 - Logica RSVP (confirmar/desistir) + cutoff + rebate FIFO M4.
 *
 * Principios:
 *   - Funcoes PURAS no topo (testaveis sem IO/Supabase): rsvpStatusForUserType,
 *     shouldRebateFifo, friendlyError.
 *   - Acoes de IO (Supabase) abaixo: fetchPresencesForMatch, confirmPresence,
 *     confirmPresenceWithRebate, declinePresence. Mutam MATCH_PRESENCES
 *     respeitando RLS (self-service em propria linha; admin via policies).
 *     Lancam Error com mensagem PT-BR (passada por friendlyError).
 *
 * PRD regra 4 - status RSVP por user_type no INSERT inicial:
 *   - mensalista     -> 'confirmed'        (slot garantido pelo mes)
 *   - goleiro_pago   -> 'confirmed'        (slot garantido/pago)
 *   - avulso         -> 'pending_approval' (admin aprova)
 *
 * Rebate FIFO M4 (apos cutoff terca 19h BRT):
 *   - Mensalista desistente (status=declined) que re-confirma recebe
 *     UPDATE para status='waiting_list' com created_at=now(), indo para o
 *     final da fila FIFO (ordenado por created_at ASC). Perde slot ate a
 *     proxima partida.
 *   - Avulso desistente nunca rebate (sem slot para perder).
 *
 * Restricoes:
 *   - cutoff derivado de lib/timezone.ts (T2.1). Nao recalcula aqui.
 *   - Nao valida FK match_id/user_id explicitamente: depende do gate T2.0
 *     (FK violada vira Postgres 23503 -> friendlyError PT-BR).
 */

import { isCutoffPassed } from '@/lib/timezone';
import type { MatchPresenceRow, ProfileRow, RsvpStatus, UserType } from '@/types/database.types';

// ----- Types ----------------------------------------------------------------

/**
 * Resultado enriquecido de presenca para a UI: linha bruta do DB combinada
 * com o profile. Seletor da store entrega isso para app/(tabs)/index.tsx
 * montar PresenceItem sem JOIN manual.
 */
export interface PresenceWithProfile extends MatchPresenceRow {
  profile: Pick<ProfileRow, 'username' | 'user_type' | 'avatar_url'>;
}

/** Erro com codigo Postgres (Supabase PostgrestError / similar). */
interface DbLikeError {
  code?: string;
  message?: string;
}

// ----- Pure logic (testavel sem IO) ----------------------------------------

/**
 * Retorna o status RSVP inicial conforme PRD regra 4:
 *   - mensalista/goleiro_pago -> confirmed
 *   - avulso                  -> pending_approval
 */
export function rsvpStatusForUserType(userType: UserType): RsvpStatus {
  if (userType === 'avulso') return 'pending_approval';
  return 'confirmed';
}

/**
 * Decide se o reensino de presenca deve "rebaixar" o mensalista desistente
 * para o final da fila FIFO (M4 rebate).
 *
 * Regras:
 *   1. user_type deve ser 'mensalista' (goleiro_pago/avulso nunca rebate).
 *   2. status atual deve ser 'declined' (desistente explicito).
 *   3. cutoff da partida ja passou (terca 19h BRT da semana do jogo).
 *
 * `match` null/sem date_time -> false (safe default; UI deve bloquear acao
 * upstream quando nao ha match corrente).
 */
export function shouldRebateFifo(
  currentStatus: RsvpStatus,
  userType: UserType,
  match: { date_time: string } | null,
): boolean {
  if (userType !== 'mensalista') return false;
  if (currentStatus !== 'declined') return false;
  return isCutoffPassed(match);
}

/**
 * Traduz um erro Supabase/Postgres em mensagem PT-BR amigavel para toast.
 * Fallback: retorna a mensagem original (ou texto generico se ausente).
 */
export function friendlyError(err: DbLikeError | null | undefined): string {
  if (!err || (!err.code && !err.message)) {
    return 'Erro ao atualizar presenca. Tente novamente.';
  }
  switch (err.code) {
    case '23505':
      return 'Voce ja confirmou presenca nesta partida.';
    case '23503':
      return 'Partida ou jogador invalido.';
    case '42501':
      return 'Voce nao tem permissao para esta acao.';
    default:
      return err.message || 'Erro ao atualizar presenca. Tente novamente.';
  }
}

// ----- IO actions (Supabase) ----------------------------------------------

const nowIso = (): string => new Date().toISOString();

/** Helper interno: carrega cliente supabase via import dinamico. */
async function getSupabase() {
  const { supabase } = await import('@/lib/supabase');
  return supabase;
}

/**
 * Busca presencas do match enriquecidas com profile (username, user_type).
 * Ordena por status (waiting_list primeiro por ordem alfabetica) e created_at
 * ASC dentro de cada status para FIFO estavel. Usado pelo seletor da tela.
 */
export async function fetchPresencesForMatch(matchId: string): Promise<PresenceWithProfile[]> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('match_presences')
    .select('*, profile:profiles(username, user_type, avatar_url)')
    .eq('match_id', matchId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(friendlyError(error));
  return (data ?? []) as unknown as PresenceWithProfile[];
}

export interface ConfirmPresenceInput {
  match_id: string;
  user_id: string;
  user_type: UserType;
  /** Linha atual (se existir). Usado para decidir rebate FIFO. */
  current?: MatchPresenceRow | null;
}

/**
 * Confirma presenca do usuario no match (versao simples - sem rebate).
 *
 * Fluxo (PRD regra 4):
 *   - Com row anterior: UPDATE status=rsvpStatusForUserType(userType).
 *   - Sem row anterior:  INSERT com rsvpStatusForUserType(userType).
 * Avulso -> pending_approval; mensalista/goleiro_pago -> confirmed.
 *
 * Para suportar rebate FIFO M4 use `confirmPresenceWithRebate`.
 */
export async function confirmPresence(input: ConfirmPresenceInput): Promise<MatchPresenceRow> {
  const { match_id, user_id, user_type, current } = input;
  const supabase = await getSupabase();
  const status = rsvpStatusForUserType(user_type);
  const stamp = nowIso();

  if (current?.id) {
    const { data, error } = await supabase
      .from('match_presences')
      .update({
        status,
        confirmed_at: stamp,
        updated_at: stamp,
      } as never)
      .eq('id', current.id)
      .select()
      .single();
    if (error) throw new Error(friendlyError(error));
    return data as MatchPresenceRow;
  }

  const { data, error } = await supabase
    .from('match_presences')
    .insert({
      match_id,
      user_id,
      status,
      confirmed_at: stamp,
    } as never)
    .select()
    .single();
  if (error) throw new Error(friendlyError(error));
  return data as MatchPresenceRow;
}

/**
 * Variante estendida de confirmPresence com contexto completo do match
 * (date_time). Habilita rebate FIFO M4 real.
 *
 * Quando `shouldRebateFifo` retorna true (mensalista declined pos-cutoff),
 * a linha existente e atualizada para status='waiting_list' com created_at
 * redefinido para now(), caindo no final da fila FIFO.
 */
export async function confirmPresenceWithRebate(
  input: ConfirmPresenceInput & {
    match: { date_time: string } | null;
  },
): Promise<MatchPresenceRow> {
  const { match_id, user_id, user_type, current, match } = input;

  if (current && shouldRebateFifo(current.status, user_type, match)) {
    const supabase = await getSupabase();
    const stamp = nowIso();
    const { data, error } = await supabase
      .from('match_presences')
      .update({
        status: 'waiting_list',
        confirmed_at: null,
        updated_at: stamp,
        created_at: stamp,
      } as never)
      .eq('id', current.id)
      .select()
      .single();
    if (error) throw new Error(friendlyError(error));
    return data as MatchPresenceRow;
  }

  return confirmPresence({ match_id, user_id, user_type, current });
}

/**
 * Recusa presenca - UPDATE/INSERT com status='declined'.
 * Nao reseta created_at (mantem ordem historica da tentativa original).
 */
export async function declinePresence(input: ConfirmPresenceInput): Promise<MatchPresenceRow> {
  const { match_id, user_id, user_type, current } = input;
  // user_type nao afeta declined; assinatura simetrica a confirm.
  void user_type;
  const supabase = await getSupabase();
  const stamp = nowIso();

  if (current?.id) {
    const { data, error } = await supabase
      .from('match_presences')
      .update({
        status: 'declined',
        confirmed_at: null,
        updated_at: stamp,
      } as never)
      .eq('id', current.id)
      .select()
      .single();
    if (error) throw new Error(friendlyError(error));
    return data as MatchPresenceRow;
  }

  const { data, error } = await supabase
    .from('match_presences')
    .insert({
      match_id,
      user_id,
      status: 'declined',
      confirmed_at: null,
    } as never)
    .select()
    .single();
  if (error) throw new Error(friendlyError(error));
  return data as MatchPresenceRow;
}
