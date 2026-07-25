/**
 * lib/expenses.ts
 * Task: T4.3 - Gestao de EXPENSES (caixa do racha - saidas).
 *
 * Principios:
 *   - Funcoes PURAS no topo (testaveis sem IO/Supabase): deriveExpenseStatus,
 *     computeSaldo, formatBRL, friendlyExpenseError.
 *   - Acoes de IO (Supabase) abaixo: listExpenses, createExpense,
 *     toggleConfirm, deleteExpense. Mutam EXPENSES respeitando RLS T1.7:
 *       * soh admin INSERT/UPDATE/DELETE.
 *       * todos do group leem (SELECT is_group_member).
 *     Lancam Error com mensagem PT-BR (traduzida por friendlyExpenseError).
 *
 * Schema (T1.3a / migration 00000000000001_schema.sql):
 *   - EXPENSES: id, group_id, match_id?, type (goalkeeper|field|other),
 *               amount, description?, paid_at?, confirmed_at?, created_at, updated_at.
 *   - NAO ha coluna 'status'; confirmed_at != null  o snapshot final.
 *   - GROUPS.goalkeeper_expense default = R$ 40 (seed T1.3b).
 *
 * Saldo (PRD regra 6 - transparencia):
 *   saldo = SUM(payments.approved_at != null) - SUM(expenses.confirmed_at != null)
 *
 * Realtime (T4.3): _layout.tsx assina EXPENSES por group_id via lib/realtime.ts.
 *   Updates (admin criar/confirmar/remover) refletem instantaneamente na
 *   store + UI (incl. card SALDO do Caixa).
 */

import type { ExpenseRow, ExpenseType } from '@/types/database.types';

// ----- Types ----------------------------------------------------------------

/** Status UI (2 estados logicos; confirmed_at  o snapshot). */
export type ExpenseUiStatus = 'pending' | 'confirmed';

/** Subset necessario para deriveExpenseStatus / computeSaldo (testavel). */
export interface ExpenseLike {
  confirmed_at: string | null;
  amount?: number;
}

/** Subset de PaymentRow aprovado para computeSaldo. */
export interface PaymentApprovedLike {
  amount: number;
  approved_at?: string | null;
}

/**
 * Resultado enriquecido p/ UI: expense + (opcional) match snapshot.
 * Denormaliza date_time do match para a UI mostrar "Partida 24/07".
 */
export interface ExpenseWithMatch extends ExpenseRow {
  match?: Pick<import('@/types/database.types').MatchRow, 'date_time'> | null;
}

/** Input de UI para createExpense (tipo/descricao/valor/relacionamento). */
export interface CreateExpenseInput {
  type: ExpenseType;
  amount: number;
  description?: string;
  match_id?: string;
}

/** Erro com codigo Postgres (Supabase PostgrestError / similar). */
interface DbLikeError {
  code?: string;
  message?: string;
}

// ----- Pure logic (testavel sem IO) ----------------------------------------

/**
 * Deriva o status UI (pending|confirmed) do timestamp confirmed_at.
 *
 * Regra: confirmed_at != null => 'confirmed'; caso contrario 'pending'.
 */
export function deriveExpenseStatus(row: ExpenseLike): ExpenseUiStatus {
  return row.confirmed_at != null ? 'confirmed' : 'pending';
}

/**
 * Calcula saldo do caixa: SUM(payments approved) - SUM(expenses confirmed).
 *
 * - Payment conta SO se approved_at != null.
 * - Expense conta SO se confirmed_at != null.
 * - Aceita listas vazias (zero).
 * - Resultado pode ser negativo (despesa > receita).
 */
export function computeSaldo(
  approvedPayments: PaymentApprovedLike[],
  confirmedExpenses: ExpenseLike[],
): number {
  const credits = approvedPayments
    .filter((p) => (p.approved_at ?? null) != null)
    .reduce((acc, p) => acc + Number(p.amount ?? 0), 0);
  const debits = confirmedExpenses
    .filter((e) => e.confirmed_at != null)
    .reduce((acc, e) => acc + Number(e.amount ?? 0), 0);
  return credits - debits;
}

/** Formata numero como moeda PT-BR (BRL). Centralizado p/ UI. */
export function formatBRL(amount: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(amount ?? 0));
}

/**
 * Traduz erro Supabase/Postgres em mensagem PT-BR amigavel.
 * Fallback: mensagem original ou texto generico.
 */
export function friendlyExpenseError(err: DbLikeError | null | undefined): string {
  if (!err || (!err.code && !err.message)) {
    return 'Erro ao atualizar despesa. Tente novamente.';
  }
  switch (err.code) {
    case '23505':
      return 'Despesa duplicada.';
    case '23503':
      return 'Partida ou grupo invalido.';
    case '42501':
      return 'Voce nao tem permissao de admin para esta acao.';
    case 'P0002':
      return 'Despesa nao encontrada.';
    default:
      return err.message || 'Erro ao atualizar despesa. Tente novamente.';
  }
}

/**
 * Retorna a label PT-BR curta do tipo de despesa.
 */
export function expenseTypeLabel(type: ExpenseType): string {
  switch (type) {
    case 'goalkeeper':
      return 'Goleiros';
    case 'field':
      return 'Campo';
    case 'other':
    default:
      return 'Outros';
  }
}

// ----- Reminder pos-jogo (pure logic; IO em lib/expenseReminder.ts) --------

export const POST_MATCH_REMINDER_TITLE = 'Lembrete pos-jogo';

/**
 * Decide se a transicao de status do MATCH dispara o reminder de goleiros.
 *
 * Regras:
 *   - prev != finished e next == finished  => true (match recem finalizado).
 *   - prev == finished e next qualquer      => false (idempotente).
 *   - cancelled -> finished                 => false (cancelada nao jogou).
 *   - novo status undefined                 => false (safe).
 */
export function shouldFireGoalkeeperReminder(
  prev: string | null | undefined,
  next: string | null | undefined,
): boolean {
  if (next !== 'finished') return false;
  if (prev === 'finished') return false;
  if (prev === 'cancelled') return false;
  return true;
}

/** Titulo fixo PT-BR do reminder. */
export function formatReminderTitle(): string {
  return POST_MATCH_REMINDER_TITLE;
}

/** Corpo PT-BR do reminder com valor formatado (BRL). */
export function formatReminderBody(amount: number): string {
  return `Confirme o pagamento dos goleiros: ${formatBRL(Number(amount) || 0)}.`;
}

// ----- IO actions (Supabase) ----------------------------------------------

const nowIso = (): string => new Date().toISOString();

/** Helper interno: carrega cliente supabase via import dinamico. */
async function getSupabase() {
  const { supabase } = await import('@/lib/supabase');
  return supabase;
}

/**
 * Lista EXPENSES do grupo fixo (eventualmente enriquecidos com match.date_time
 * para exibir "Partida dd/MM"). Ordena por created_at DESC.
 *
 * PRD regra 6: todos do grupo veem todas as despesas (RLS Expenses SELECT).
 */
export async function listExpenses(): Promise<ExpenseWithMatch[]> {
  const supabase = await getSupabase();
  const { FIXED_GROUP_ID } = await import('@/lib/matches');
  const { data, error } = await supabase
    .from('expenses')
    .select('*, match:matches(date_time)')
    .eq('group_id', FIXED_GROUP_ID)
    .order('created_at', { ascending: false });
  if (error) throw new Error(friendlyExpenseError(error));
  return (data ?? []) as unknown as ExpenseWithMatch[];
}

/**
 * Busca GROUPS.goalkeeper_expense (default R$ 40 na seed T1.3b).
 * Usado pela UI para pre-preencher o valor quando tipo=goalkeeper.
 */
export async function getDefaultGoalkeeperExpense(): Promise<number> {
  const supabase = await getSupabase();
  const { FIXED_GROUP_ID } = await import('@/lib/matches');
  const { data, error } = await supabase
    .from('groups')
    .select('goalkeeper_expense')
    .eq('id', FIXED_GROUP_ID)
    .maybeSingle();
  if (error) throw new Error(friendlyExpenseError(error));
  const value = Array.isArray(data)
    ? 40
    : Number((data as { goalkeeper_expense?: number } | null)?.goalkeeper_expense ?? 40);
  return Number.isFinite(value) ? value : 40;
}

/**
 * ADMIN cria EXPENSE (type/amount/desc/match opcional).
 *
 * RLS expenses_insert_policy exige is_admin(); nao-admin recebe 42501.
 */
export async function createExpense(input: CreateExpenseInput): Promise<ExpenseRow> {
  const supabase = await getSupabase();
  const { FIXED_GROUP_ID } = await import('@/lib/matches');
  const payload = {
    group_id: FIXED_GROUP_ID,
    type: input.type,
    amount: Number(input.amount),
    description: input.description ?? null,
    match_id: input.match_id ?? null,
  };
  const { data, error } = await supabase
    .from('expenses')
    .insert(payload as never)
    .select()
    .single();
  if (error) throw new Error(friendlyExpenseError(error));
  return data as ExpenseRow;
}

/**
 * ADMIN toggle confirmed_at: se pendente -> seta now(); se confirmado -> null.
 * Retorna a linha atualizada.
 *
 * RLS expenses_update_policy exige is_admin().
 */
export async function toggleExpenseConfirmed(
  expenseId: string,
  currentConfirmedAt: string | null,
): Promise<ExpenseRow> {
  const supabase = await getSupabase();
  const stamp = currentConfirmedAt == null ? nowIso() : null;
  const { data, error } = await supabase
    .from('expenses')
    .update({ confirmed_at: stamp, updated_at: nowIso() } as never)
    .eq('id', expenseId)
    .select()
    .single();
  if (error) throw new Error(friendlyExpenseError(error));
  return data as ExpenseRow;
}

/**
 * ADMIN remove despesa. RLS expenses_delete_policy exige is_admin().
 */
export async function deleteExpense(expenseId: string): Promise<void> {
  const supabase = await getSupabase();
  const { error } = await supabase.from('expenses').delete().eq('id', expenseId);
  if (error) throw new Error(friendlyExpenseError(error));
}
