/**
 * lib/payments.ts
 * Task: T4.2 - Fluxo dupla confirmacao de pagamento (jogador marca -> admin aprova).
 *
 * Principios:
 *   - Funcoes PURAS no topo (testaveis sem IO/Supabase): deriveStatus,
 *     canUserMark, canUserApprove, friendlyPaymentError.
 *   - Acoes de IO (Supabase) abaixo: listPaymentsWithProfiles, markAsPaid,
 *     approvePayment. Mutam PAYMENTS respeitando RLS T1.7:
 *       * jogador marca propria linha (user_id = auth.uid()).
 *       * admin aprova qualquer linha (is_admin() bypass).
 *     Lancam Error com mensagem PT-BR (traduzida por friendlyPaymentError).
 *   - Errors propagados para UI exibir como toast.
 *
 * Schema (T1.3a / migration 00000000000001_schema.sql):
 *   - payment_status enum SO tem 'pending' | 'paid'.
 *   - 'marked' e estado DERIVADO (marked_paid_at != null && approved_at == null).
 *   - approved_at OU paid_at preenchido => 'paid'.
 *   - payment_type enum: 'monthly' | 'casual' (NAO ha 'goalkeeper' - goleiro
 *     e EXPENSE, nao PAYMENT). UI Caixa mapeia para PaymentRowType via map.
 *
 * Realtime (T2.1): _layout.tsx ja assina PAYMENTS por group_id. Updates
 * (jogador marca / admin aprova) refletem instantaneamente na store + UI.
 *
 * RLS (T1.7): payments_update_policy:
 *   using (user_id = auth.uid() or public.is_admin())
 *   with check (user_id = auth.uid() or public.is_admin())
 *   - JOGADOR marca SOMENTE propria linha.
 *   - ADMIN atualiza qualquer linha (aprova).
 *   - DB e fonte de verdade; UI soh OCULTA botoes por RBAC para UX.
 */

import type { PaymentRow, ProfileRow } from '@/types/database.types';

// ----- Types ----------------------------------------------------------------

/** Status UI (3 estados logicos do fluxo dupla-confirmacao). */
export type PaymentUiStatus = 'pending' | 'marked' | 'paid';

/**
 * Resultado enriquecido p/ UI Caixa/Admin: payment + profile do jogador.
 * Denormaliza username para o PaymentRow não precisar dele.
 */
export interface PaymentWithProfile extends PaymentRow {
  profile: Pick<ProfileRow, 'username' | 'user_type' | 'avatar_url'>;
}

/** Erro com codigo Postgres (Supabase PostgrestError / similar). */
interface DbLikeError {
  code?: string;
  message?: string;
}

// ----- Pure logic (testavel sem IO) ----------------------------------------

/**
 * Deriva o status UI (pending|marked|paid) dos timestamps do pagamento.
 *
 * Regra (schema enum so tem pending|paid; marked e derivado):
 *   - approved_at != null || paid_at != null => 'paid'
 *   - marked_paid_at != null (e ainda nao aprovado)         => 'marked'
 *   - caso contrario                                         => 'pending'
 */
export function deriveStatus(row: {
  marked_paid_at: string | null;
  approved_at: string | null;
  paid_at: string | null;
}): PaymentUiStatus {
  if (row.approved_at || row.paid_at) return 'paid';
  if (row.marked_paid_at) return 'marked';
  return 'pending';
}

/**
 * RLSC UI gate: jogador soh marca PROPRIA cobranca.
 * DB (cols T1.7) e fonte de verdade; isto e UX defense-in-depth.
 */
export function canUserMark(
  payment: { user_id: string },
  currentUserId: string | null | undefined,
): boolean {
  return Boolean(currentUserId) && payment.user_id === currentUserId;
}

/**
 * RLS UI gate: somente admin aprova.
 * DB (is_admin()) e fonte de verdade.
 */
export function canUserApprove(isAdmin: boolean): boolean {
  return isAdmin;
}

/**
 * Traduz erro Supabase/Postgres em mensagem PT-BR amigavel para toast.
 * Fallback: mensagem original ou texto generico.
 */
export function friendlyPaymentError(err: DbLikeError | null | undefined): string {
  if (!err || (!err.code && !err.message)) {
    return 'Erro ao atualizar pagamento. Tente novamente.';
  }
  switch (err.code) {
    case '23503':
      return 'Pagamento invalido.';
    case '42501':
      return 'Voce nao tem permissao para esta acao.';
    case 'P0002':
      return 'Pagamento nao encontrado.';
    default:
      return err.message || 'Erro ao atualizar pagamento. Tente novamente.';
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
 * Lista PAYMENTS do grupo fixo enriquecidos com profile (username,
 * user_type, avatar_url). Ordena por created_at DESC (mais recente primeiro);
 * UI agrupa por mes apos este fetch.
 *
 * PRD regra 6 (transparencia): todos do grupo veem todos pagamentos.
 * RLS payments_select_policy garante isolamento cross-group.
 */
export async function listPaymentsWithProfiles(): Promise<PaymentWithProfile[]> {
  const supabase = await getSupabase();
  const { FIXED_GROUP_ID } = await import('@/lib/matches');
  const { data, error } = await supabase
    .from('payments')
    .select('*, profile:profiles(username, user_type, avatar_url)')
    .eq('group_id', FIXED_GROUP_ID)
    .order('created_at', { ascending: false });
  if (error) throw new Error(friendlyPaymentError(error));
  return (data ?? []) as unknown as PaymentWithProfile[];
}

/**
 * JOGADOR marca pagamento como pago (1a confirmacao).
 *
 * Seta marked_paid_at = now() (nao toca em approved_at/paid_at).
 * Idempotente (UDPATE apenas reescreve o timestamp se ja marcado).
 *
 * RLS: payments_update_policy exige user_id = auth.uid(); jogadores
 * tentando marcar pagamento de OUTRO recebem erro 42501 -> friendlyPaymentError.
 */
export async function markAsPaid(paymentId: string): Promise<PaymentRow> {
  const supabase = await getSupabase();
  const stamp = nowIso();
  const { data, error } = await supabase
    .from('payments')
    .update({ marked_paid_at: stamp } as never)
    .eq('id', paymentId)
    .select()
    .single();
  if (error) throw new Error(friendlyPaymentError(error));
  return data as PaymentRow;
}

/**
 * ADMIN aprova pagamento (2a confirmacao).
 *
 * Seta approved_at = now() + paid_at = now() (snapshot final que completa
 * o enum status=paid; trigger T1.5 se existir soh refresca updated_at).
 *
 * RLS: payments_update_policy exige is_admin(); nao-admin recebe 42501.
 */
export async function approvePayment(paymentId: string): Promise<PaymentRow> {
  const supabase = await getSupabase();
  const stamp = nowIso();
  const { data, error } = await supabase
    .from('payments')
    .update({ approved_at: stamp, paid_at: stamp, status: 'paid', updated_at: stamp } as never)
    .eq('id', paymentId)
    .select()
    .single();
  if (error) throw new Error(friendlyPaymentError(error));
  return data as PaymentRow;
}
