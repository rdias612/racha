/**
 * lib/realtime.ts
 * Task: T2.1 (RSVP + Payments) + T4.3 (Expenses + reminder pos-jogo).
 *
 * Por que existir (YAGNI-aware):
 *   - Stores Zustand sao puras (sem IO). Realtime IO fica aqui para manter
 *     testabilidade das stores e duracao de vida cleanup-friendly.
 *
 * Cobertura:
 *   - subscribePresences(matchId) - escuta INSERT/UPDATE/DELETE em
 *     match_presences para o match corrente. Repassa payload para a store.
 *   - subscribePayments(groupId) - escuta mutacoes em payments do grupo.
 *   - subscribeExpenses(groupId) - escuta mutacoes em expenses do grupo (T4.3).
 *   - subscribeMatchesForReminder(groupId, opts) - detecta MATCHES.status ->
 *     finished e dispara reminder LOCAL no device (T4.3). Mantem estado
 *     prevStatus interno idempotente (evita re-disparo).
 *
 * Restricoes:
 *   - Realtime respeita RLS por padrao no Supabase (so chegam registros
 *     que o usuario poderia ler via SELECT).
 *   - Cada funcao retorna um `RealtimeChannel` em estado conectado; o caller
 *     deve chamar `.unsubscribe()` + `supabase.removeChannel(...)` no cleanup.
 *
 * Payload:
 *   - O callback `postgres_changes` entrega `new` (INSERT/UPDATE) e `old`
 *     (parcial, apenas PK por default). Suficiente para a store local.
 *   - Em DELETE sem replica identity full, so `old.id` esta disponivel.
 */

import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import { usePresenceStore } from '@/stores/presence';
import { usePaymentStore } from '@/stores/payment';
import { useExpenseStore } from '@/stores/expense';
import { shouldFireGoalkeeperReminder } from '@/lib/expenses';
import type { MatchPresenceRow, PaymentRow, ExpenseRow } from '@/types/database.types';

type PresencePayload =
  | { eventType: 'INSERT'; new: MatchPresenceRow }
  | { eventType: 'UPDATE'; new: MatchPresenceRow }
  | { eventType: 'DELETE'; old: { id: string } };

type PaymentPayload =
  | { eventType: 'INSERT'; new: PaymentRow }
  | { eventType: 'UPDATE'; new: PaymentRow }
  | { eventType: 'DELETE'; old: { id: string } };

type ExpensePayload =
  | { eventType: 'INSERT'; new: ExpenseRow }
  | { eventType: 'UPDATE'; new: ExpenseRow }
  | { eventType: 'DELETE'; old: { id: string } };

type MatchStatusPayload =
  | {
      eventType: 'INSERT';
      new: { id: string; status?: string; goalkeeper_expense?: number; date_time?: string };
    }
  | {
      eventType: 'UPDATE';
      new: { id: string; status?: string; goalkeeper_expense?: number; date_time?: string };
      old?: { status?: string };
    }
  | { eventType: 'DELETE'; old: { id: string } };

/**
 * Subscreve mutacoes de MATCH_PRESENCES filtrando por match_id.
 * Retorna o canal para que o caller faca cleanup.
 */
export function subscribePresences(matchId: string): RealtimeChannel {
  const presenceStore = usePresenceStore.getState();

  const onChange = (payload: RealtimePostgresChangesPayload<MatchPresenceRow>) => {
    const typed = payload as unknown as PresencePayload;
    switch (typed.eventType) {
      case 'INSERT':
        presenceStore.addPresence(typed.new);
        break;
      case 'UPDATE':
        presenceStore.upsertPresence(typed.new.id, typed.new);
        break;
      case 'DELETE':
        presenceStore.removePresence(typed.old.id);
        break;
    }
  };

  return supabase
    .channel(`match_presences:${matchId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'match_presences',
        filter: `match_id=eq.${matchId}`,
      },
      onChange,
    )
    .subscribe();
}

/**
 * Subscreve mutacoes de PAYMENTS filtrando por group_id.
 */
export function subscribePayments(groupId: string): RealtimeChannel {
  const paymentStore = usePaymentStore.getState();

  const onChange = (payload: RealtimePostgresChangesPayload<PaymentRow>) => {
    const typed = payload as unknown as PaymentPayload;
    switch (typed.eventType) {
      case 'INSERT':
        paymentStore.addPayment(typed.new);
        break;
      case 'UPDATE':
        paymentStore.upsertPayment(typed.new.id, typed.new);
        break;
      case 'DELETE':
        paymentStore.removePayment(typed.old.id);
        break;
    }
  };

  return supabase
    .channel(`payments:${groupId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'payments',
        filter: `group_id=eq.${groupId}`,
      },
      onChange,
    )
    .subscribe();
}

/**
 * Subscreve mutacoes de EXPENSES filtrando por group_id (T4.3).
 * Mantem a store de despesas sincronizada com ADMIN INSERT/UPDATE/DELETE;
 * UI (Caixa saldo + tela admin) reflete instantaneamente.
 */
export function subscribeExpenses(groupId: string): RealtimeChannel {
  const expenseStore = useExpenseStore.getState();

  const onChange = (payload: RealtimePostgresChangesPayload<ExpenseRow>) => {
    const typed = payload as unknown as ExpensePayload;
    switch (typed.eventType) {
      case 'INSERT':
        expenseStore.addExpense(typed.new);
        break;
      case 'UPDATE':
        expenseStore.upsertExpense(typed.new.id, typed.new);
        break;
      case 'DELETE':
        expenseStore.removeExpense(typed.old.id);
        break;
    }
  };

  return supabase
    .channel(`expenses:${groupId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'expenses',
        filter: `group_id=eq.${groupId}`,
      },
      onChange,
    )
    .subscribe();
}

/**
 * Subscreve mutacoes de MATCHES para disparar reminder LOCAL (T4.3) quando
 * status -> finished (so no device admin). Mantem estado prevStatus interno
 * para deteccao idempotente da transicao (nao re-dispara em refresh).
 *
 * `onFireReminder` e injetado (DIP) p/ testabilidade e desacoplamento de IO
 * Notifications. Em producao, callers passam fireGoalkeeperReminderNow de
 * lib/expenseReminder.ts.
 *
 * `isAdmin` (default false): se nao admin, skip silencioso (RLS ja protege;
 * mesmo recebendo o evento, nao dispara notificacao p/ nao-admin).
 */
export function subscribeMatchesForReminder(
  groupId: string,
  opts: {
    onFireReminder: (amount: number, matchDateTimeIso?: string | null) => void;
    isAdmin?: boolean;
  },
): RealtimeChannel {
  const prevStatusByMatch = new Map<string, string | undefined>();

  const onChange = (
    payload: RealtimePostgresChangesPayload<{
      id: string;
      status?: string;
      goalkeeper_expense?: number;
      date_time?: string;
    }>,
  ) => {
    if (opts.isAdmin === false) return;
    const typed = payload as unknown as MatchStatusPayload;
    if (typed.eventType === 'DELETE') return;

    const next = typed.new;
    if (!next?.id || typeof next.status !== 'string') return;

    const prev = prevStatusByMatch.get(next.id);
    if (shouldFireGoalkeeperReminder(prev ?? null, next.status)) {
      const amount = Number(next.goalkeeper_expense ?? 40);
      opts.onFireReminder(amount, next.date_time ?? null);
    }
    prevStatusByMatch.set(next.id, next.status);
  };

  return supabase
    .channel(`matches:reminder:${groupId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'matches',
        filter: `group_id=eq.${groupId}`,
      },
      onChange,
    )
    .subscribe();
}

/**
 * Cleanup helper: unsubscribe + remove do cliente Supabase.
 * Aceita undefined (no-op) para callers simplificarem o useEffect cleanup.
 */
export async function disposeChannel(channel: RealtimeChannel | undefined): Promise<void> {
  if (!channel) return;
  try {
    await supabase.removeChannel(channel);
  } catch {
    // Erros de cleanup sao nao-fatais (e.g. app sendo desmontado).
  }
}
