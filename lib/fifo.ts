/**
 * lib/fifo.ts
 * Task: T3.1 - Promocao FIFO de avulsos (waiting_list -> confirmed) + UI admin.
 *
 * Principios:
 *   - Funcao PURA no topo (testavel sem IO): friendlyFifoError.
 *   - Acoes IO (Supabase RPC) abaixo: listPendingApprovals, promoteNextCasual,
 *     rejectPending. Chamam functions SECURITY DEFINER versionadas em
 *     supabase/migrations/00000000000009_fifo.sql.
 *   - Erros sao traduzidos por friendlyFifoError (mesma convencao de lib/rsvp.ts).
 *
 * Contratos RPC (Supabase .rpc):
 *   - promote_next_casual(p_match_id uuid) -> uuid (user_id) | null.
 *   - reject_pending_presence(p_presence_id uuid) -> uuid | null.
 *
 * Restricoes:
 *   - Nao valida FK/RLS explicitamente: depende das functions SECURITY DEFINER
 *     (gate interno is_admin()) e das policies T1.7 (admin muta linha qualquer).
 *   - Listagem usa filtro status='pending_approval' (avulso aguardando admin).
 */

import type { MatchPresenceRow, ProfileRow } from '@/types/database.types';

/** Helper interno: carrega cliente supabase via import dinamico (evita carregar react-native em testes tsx). */
async function getSupabase() {
  const { supabase } = await import('@/lib/supabase');
  return supabase;
}

/** Helper interno: FIXED_GROUP_ID do seed T1.3b (carregado tardiamente p/ evitar cycle em tsx). */
async function getFixedGroupId() {
  const { FIXED_GROUP_ID } = await import('@/lib/matches');
  return FIXED_GROUP_ID;
}

/** Erro com codigo Postgres (Supabase PostgrestError / similar). */
interface DbLikeError {
  code?: string;
  message?: string;
}

/** Resultado enriquecido p/ UI admin: presence + profile do jogador. */
export interface PendingWithProfile extends MatchPresenceRow {
  profile: Pick<ProfileRow, 'full_name' | 'user_type' | 'avatar_url'>;
}

/**
 * Traduz erro Supabase/Postgres em mensagem PT-BR para toast.
 * Reutiliza codigos canonicos (23505/23503/42501/P0002) e fallback generico.
 */
export function friendlyFifoError(err: DbLikeError | null | undefined): string {
  if (!err || (!err.code && !err.message)) {
    return 'Erro ao processar promocao. Tente novamente.';
  }
  switch (err.code) {
    case '23505':
      return 'Jogador ja possui registro nesta partida.';
    case '23503':
      return 'Partida ou jogador invalido.';
    case '42501':
      return 'Voce nao tem permissao para esta acao (apenas admin).';
    case 'P0002':
      return 'Registro de presenca nao encontrado.';
    default:
      return err.message || 'Erro ao processar promocao. Tente novamente.';
  }
}

/**
 * Lista avulsos pendentes (status='pending_approval') do proximo MATCH
 * do grupo fixo. Ordena por created_at ASC (mais antigo primeiro - FIFO para
 * exibicao; promocao via RPC segue mesma ordem).
 *
 * Estrategia: busca MATCH mais proximo (status=scheduled, future) e filtra
 * presences pendentes; se nenhum match futuro, retorna [].
 */
export async function listPendingApprovals(): Promise<PendingWithProfile[]> {
  const supabase = await getSupabase();
  const fixedGroupId = await getFixedGroupId();
  // Match alvo: proxima partida agendada do grupo (mais antiga futura).
  const { data: matchData, error: matchErr } = await supabase
    .from('matches')
    .select('id')
    .eq('group_id', fixedGroupId)
    .eq('status', 'scheduled')
    .order('date_time', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (matchErr) throw new Error(friendlyFifoError(matchErr));
  if (!matchData || Array.isArray(matchData)) return [];

  const matchId = (matchData as { id: string }).id;

  const { data, error } = await supabase
    .from('match_presences')
    .select('*, profile:profiles(full_name, user_type, avatar_url)')
    .eq('match_id', matchId)
    .eq('status', 'pending_approval')
    .order('created_at', { ascending: true });
  if (error) throw new Error(friendlyFifoError(error));
  return (data ?? []) as unknown as PendingWithProfile[];
}

/**
 * Promove o proximo avulso em waiting_list do match informado para confirmed.
 * Usa RPC promote_next_casual (SECURITY DEFINER, FOR UPDATE SKIP LOCKED).
 *
 * Retorna user_id promovido ou null se fila vazia (sem erro).
 *
 * Obs.: A UI tipicamente promove pendentes (pending_approval -> confirmed).
 * A function SQL aceita_waiting_list no caso de administrador promove avulsos
 * ja em fila (waiting_list), mas o cenario principal do admin e aprovar
 * pendentes manualmente - estes devem ser promovidostambem via esta RPC.
 * Para converter pending_approval em confirmed via admin, use approvePending.
 */
export async function promoteNextCasual(matchId: string): Promise<string | null> {
  const supabase = await getSupabase();
  const { data, error } = await supabase.rpc('promote_next_casual', {
    p_match_id: matchId,
  });
  if (error) throw new Error(friendlyFifoError(error));
  return (data as string | null) ?? null;
}

/**
 * Aprova um pendente (pending_approval -> confirmed) diretamente.
 * Equivalente a UPDATE status='confirmed' na presence; aproveita a policy
 * match_presences_update_policy (admin muta linha qualquer).
 *
 * Mantida como acesso direto (sem RPC) por ser trivial; a function FIFO e
 * responsabilidade de promote_next_casual.
 */
export async function approvePending(presenceId: string): Promise<void> {
  const supabase = await getSupabase();
  const stamp = new Date().toISOString();
  const { error } = await supabase
    .from('match_presences')
    .update({
      status: 'confirmed',
      confirmed_at: stamp,
      updated_at: stamp,
    } as never)
    .eq('id', presenceId);
  if (error) throw new Error(friendlyFifoError(error));
}

/**
 * Rejeita um pendente (pending_approval -> declined) e dispara promocao FIFO.
 * Usa RPC reject_pending_presence (SECURITY DEFINER), que internamente aciona
 * promote_next_casual no match_id correspondente. Retorna user_id promovido
 * (ou null se fila vazia).
 */
export async function rejectPending(presenceId: string): Promise<string | null> {
  const supabase = await getSupabase();
  const { data, error } = await supabase.rpc('reject_pending_presence', {
    p_presence_id: presenceId,
  });
  if (error) throw new Error(friendlyFifoError(error));
  return (data as string | null) ?? null;
}
